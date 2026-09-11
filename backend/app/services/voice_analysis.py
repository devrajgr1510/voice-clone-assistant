"""
Real signal-processing based voice analysis engine.

HONESTY NOTE (read this before presenting the app as "AI-trained"):
---------------------------------------------------------------------------
This module performs genuine digital-signal-processing analysis on the
actual bytes of the uploaded audio (pitch/F0 tracking, jitter & shimmer,
spectral flatness, high-frequency roll-off, zero-crossing statistics) and
combines them with a hand-tuned scoring rule. That is a real, deterministic
analysis of the specific recording you feed it — it is NOT a neural network
and was NOT trained on a labelled genuine-vs-synthetic-speech dataset, so
its accuracy will not match a production anti-spoofing model such as
AASIST, RawNet2 or ECAPA-TDNN. Building one of those requires: (1) a
licensed dataset of real + AI-generated speech (e.g. ASVspoof), (2) a GPU
training pipeline, (3) offline evaluation against held-out attacks. None of
that is possible inside this sandbox (no network access, no dataset).

What you get here instead is a legitimate acoustic-heuristic detector:
jitter/shimmer and spectral-flatness features are the same families of
features real anti-spoofing papers use, just combined with hand-set
weights instead of learned ones. Treat its output as "signal-processing
red flags", not a certified AI verdict — the README explains this to end
users too, and the API always reports `"engine": "dsp-heuristic-v1"` so
callers can tell it apart from a trained model.
---------------------------------------------------------------------------
"""
import io
import wave
import math
from typing import Dict, List, Optional

import numpy as np


def _read_wav(raw: bytes) -> Optional[Dict]:
    try:
        with wave.open(io.BytesIO(raw), "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            frames = wf.readframes(n_frames)
    except (wave.Error, EOFError, ValueError):
        return None

    if sampwidth == 1:
        dtype = np.uint8
        offset = 128
        scale = 128.0
    elif sampwidth == 2:
        dtype = np.int16
        offset = 0
        scale = 32768.0
    elif sampwidth == 4:
        dtype = np.int32
        offset = 0
        scale = 2147483648.0
    else:
        return None

    data = np.frombuffer(frames, dtype=dtype).astype(np.float64)
    if data.size == 0:
        return None
    data = (data - offset) / scale
    if n_channels > 1:
        data = data.reshape(-1, n_channels).mean(axis=1)
    return {"samples": data, "sample_rate": framerate}


def _frame_signal(x: np.ndarray, sr: int, frame_ms: float = 30, hop_ms: float = 15):
    frame_len = max(1, int(sr * frame_ms / 1000))
    hop_len = max(1, int(sr * hop_ms / 1000))
    frames = []
    for start in range(0, max(1, len(x) - frame_len), hop_len):
        frames.append(x[start:start + frame_len])
    return frames, frame_len, hop_len


def _autocorr_pitch(frame: np.ndarray, sr: int, fmin=60, fmax=500) -> Optional[float]:
    frame = frame - frame.mean()
    if np.max(np.abs(frame)) < 1e-4:
        return None  # near-silence
    corr = np.correlate(frame, frame, mode="full")
    corr = corr[len(corr) // 2:]
    lag_min = int(sr / fmax)
    lag_max = min(int(sr / fmin), len(corr) - 1)
    if lag_max <= lag_min:
        return None
    segment = corr[lag_min:lag_max]
    if segment.size == 0 or np.max(segment) <= 0:
        return None
    peak_lag = lag_min + int(np.argmax(segment))
    if corr[0] == 0:
        return None
    periodicity = segment[peak_lag - lag_min] / corr[0]
    if periodicity < 0.3:
        return None  # not voiced / too noisy to trust
    return sr / peak_lag


def _spectral_flatness(frame: np.ndarray) -> float:
    windowed = frame * np.hanning(len(frame))
    spectrum = np.abs(np.fft.rfft(windowed)) + 1e-12
    geo_mean = np.exp(np.mean(np.log(spectrum)))
    arith_mean = np.mean(spectrum)
    return float(geo_mean / arith_mean)


def _hf_energy_ratio(frame: np.ndarray, sr: int) -> float:
    windowed = frame * np.hanning(len(frame))
    spectrum = np.abs(np.fft.rfft(windowed)) ** 2
    freqs = np.fft.rfftfreq(len(frame), d=1 / sr)
    total = spectrum.sum() + 1e-12
    hf = spectrum[freqs > 4000].sum()
    return float(hf / total)


def _zcr(frame: np.ndarray) -> float:
    signs = np.sign(frame)
    signs[signs == 0] = 1
    return float(np.mean(signs[:-1] != signs[1:]))


def analyze_pcm(samples: np.ndarray, sr: int) -> Dict:
    frames, frame_len, hop_len = _frame_signal(samples, sr)
    pitches: List[float] = []
    energies: List[float] = []
    flatness: List[float] = []
    hf_ratios: List[float] = []
    zcrs: List[float] = []

    for frame in frames:
        if len(frame) < 32:
            continue
        rms = float(np.sqrt(np.mean(frame ** 2)))
        energies.append(rms)
        if rms < 0.005:
            continue  # silence — skip pitch/spectral stats for this frame
        f0 = _autocorr_pitch(frame, sr)
        if f0:
            pitches.append(f0)
        flatness.append(_spectral_flatness(frame))
        hf_ratios.append(_hf_energy_ratio(frame, sr))
        zcrs.append(_zcr(frame))

    duration = len(samples) / sr if sr else 0.0
    silence_ratio = 1.0 - (len(pitches) / max(1, len(frames)))

    indicators: List[str] = []
    sub_scores: Dict[str, float] = {}

    # --- Jitter: frame-to-frame pitch variability. Natural voices wobble;
    # concatenative/neural TTS is often *too* smooth (very low jitter) or,
    # conversely, glitchy vocoders show erratic jumps (very high jitter).
    if len(pitches) >= 4:
        diffs = np.abs(np.diff(pitches))
        mean_pitch = np.mean(pitches)
        jitter = float(np.mean(diffs) / mean_pitch) if mean_pitch else 0.0
        if jitter < 0.01:
            sub_scores["unnatural_pitch_stability"] = 70
            indicators.append("Unusually stable pitch contour (low natural micro-variation)")
        elif jitter > 0.18:
            sub_scores["unnatural_pitch_stability"] = 55
            indicators.append("Erratic pitch jumps atypical of natural speech")
        else:
            sub_scores["unnatural_pitch_stability"] = float(np.clip(20 + jitter * 60, 5, 40))
    else:
        sub_scores["unnatural_pitch_stability"] = 35
        indicators.append("Insufficient voiced audio to reliably track pitch")

    # --- Shimmer: frame-to-frame amplitude variability.
    if len(energies) >= 4:
        e = np.array(energies)
        e = e[e > 0.005]
        if len(e) >= 4:
            amp_diffs = np.abs(np.diff(e))
            shimmer = float(np.mean(amp_diffs) / np.mean(e)) if np.mean(e) else 0.0
            if shimmer < 0.03:
                sub_scores["unnatural_amplitude_stability"] = 65
                indicators.append("Amplitude envelope unusually smooth frame-to-frame")
            else:
                sub_scores["unnatural_amplitude_stability"] = float(np.clip(shimmer * 120, 5, 45))
        else:
            sub_scores["unnatural_amplitude_stability"] = 30
    else:
        sub_scores["unnatural_amplitude_stability"] = 30

    # --- Spectral flatness: many vocoders leave a distinctive, very
    # consistent flatness signature across frames (low variance).
    if len(flatness) >= 4:
        fl = np.array(flatness)
        fl_var = float(np.var(fl))
        fl_mean = float(np.mean(fl))
        if fl_var < 0.0008:
            sub_scores["spectral_consistency"] = 60
            indicators.append("Spectral texture unusually consistent across frames (possible vocoder artifact)")
        else:
            sub_scores["spectral_consistency"] = float(np.clip(fl_mean * 80, 5, 40))
    else:
        sub_scores["spectral_consistency"] = 30

    # --- High-frequency roll-off: some TTS/vocoder pipelines band-limit
    # output more sharply than an open acoustic recording.
    if hf_ratios:
        hf_mean = float(np.mean(hf_ratios))
        if hf_mean < 0.01:
            sub_scores["hf_rolloff"] = 55
            indicators.append("Sharp high-frequency roll-off, consistent with band-limited synthetic audio")
        else:
            sub_scores["hf_rolloff"] = float(np.clip(hf_mean * 300, 5, 35))
    else:
        sub_scores["hf_rolloff"] = 30

    # --- Background noise floor: fully synthetic clips are often
    # suspiciously clean (near-zero noise floor in "silent" frames).
    silent_frames = [e for e in energies if e < 0.005]
    if len(silent_frames) >= 2:
        noise_floor = float(np.mean(silent_frames))
        if noise_floor < 0.0008:
            sub_scores["clean_noise_floor"] = 50
            indicators.append("Near-zero background noise floor (very clean silence, atypical of live calls)")
        else:
            sub_scores["clean_noise_floor"] = 15
    else:
        sub_scores["clean_noise_floor"] = 20
        indicators.append("Little to no silence detected to assess background noise floor")

    weights = {
        "unnatural_pitch_stability": 0.30,
        "unnatural_amplitude_stability": 0.20,
        "spectral_consistency": 0.25,
        "hf_rolloff": 0.15,
        "clean_noise_floor": 0.10,
    }
    overall = sum(sub_scores[k] * w for k, w in weights.items())
    overall = int(max(0, min(100, round(overall))))

    if duration < 1.5 or silence_ratio > 0.85:
        confidence = "low"
    elif duration < 4:
        confidence = "medium"
    else:
        confidence = "high"

    if not indicators:
        indicators.append("No strong synthetic-speech indicators detected in this clip")

    return {
        "engine": "dsp-heuristic-v1",
        "format_supported": True,
        "duration_seconds": round(duration, 2),
        "sample_rate": sr,
        "synthetic_voice_likelihood": overall,
        "confidence": confidence,
        "silence_ratio": round(silence_ratio, 2),
        "mean_pitch_hz": round(float(np.mean(pitches)), 1) if pitches else None,
        "sub_scores": {k: round(v, 1) for k, v in sub_scores.items()},
        "indicators": indicators[:5],
    }


def _fallback_byte_analysis(raw: bytes, content_type: str) -> Dict:
    """
    Used when the upload isn't a plain PCM WAV file (e.g. browser-recorded
    webm/opus) and no decoder is available. Still a real, deterministic
    read of the actual uploaded bytes (entropy + size heuristics) rather
    than a random number, but it cannot do pitch/spectral analysis without
    decoding the audio first — flagged clearly via `format_supported`.
    """
    if not raw:
        return {
            "engine": "dsp-heuristic-v1",
            "format_supported": False,
            "duration_seconds": 0,
            "synthetic_voice_likelihood": 0,
            "confidence": "low",
            "indicators": ["Empty upload — nothing to analyze"],
            "sub_scores": {},
        }
    arr = np.frombuffer(raw, dtype=np.uint8)
    # Shannon entropy of the raw byte stream as a very rough compressibility
    # proxy — not a substitute for real decoding, kept low-weight on purpose.
    counts = np.bincount(arr, minlength=256).astype(np.float64)
    probs = counts[counts > 0] / counts.sum()
    entropy = float(-np.sum(probs * np.log2(probs)))
    score = int(max(10, min(40, round((entropy / 8) * 40))))
    return {
        "engine": "dsp-heuristic-v1",
        "format_supported": False,
        "duration_seconds": None,
        "synthetic_voice_likelihood": score,
        "confidence": "low",
        "indicators": [
            f"Uploaded format ({content_type or 'unknown'}) isn't PCM WAV — full pitch/spectral "
            "analysis was skipped; convert to WAV for a reliable reading.",
        ],
        "sub_scores": {"byte_entropy_proxy": round(entropy, 2)},
    }


def analyze_audio_bytes(raw: bytes, content_type: str = "") -> Dict:
    parsed = _read_wav(raw)
    if parsed is None:
        return _fallback_byte_analysis(raw, content_type)
    return analyze_pcm(parsed["samples"], parsed["sample_rate"])
