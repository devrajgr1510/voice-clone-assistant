"""
Risk scoring engine.

This module simulates the multi-layer voice authenticity analysis described
in the product spec (synthetic-voice detection, speaker verification,
prosody analysis, acoustic analysis, contextual risk, transaction risk).

In production, `synthetic_voice_score` would come from a spectrogram-based
classifier (e.g. an AASIST/RawNet2-style anti-spoofing model), and
`speaker_mismatch_score` from a speaker-verification embedding model
(e.g. ECAPA-TDNN) compared against enrolled voice prints. Here we generate
plausible, internally-consistent scores so the API and UI have real,
explorable data to work with without requiring an audio pipeline.
"""
import random
from typing import Dict, List, Tuple


def _bounded(v: float, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, round(v)))


def score_call(
    *,
    is_high_risk_hint: bool = None,
    transaction_amount: float = None,
    known_speaker: bool = True,
) -> Dict[str, int]:
    """
    Produce a coherent set of sub-scores and an overall impersonation risk
    score, weighted the same way the product spec's risk engine is described:
    synthetic voice + speaker mismatch carry the most weight, prosody/acoustic
    are supporting signals, context/transaction modulate final severity.
    """
    if is_high_risk_hint is None:
        # Skew towards a realistic mix: most calls are low risk.
        is_high_risk_hint = random.random() < 0.22

    base = random.uniform(55, 95) if is_high_risk_hint else random.uniform(3, 45)

    synthetic_voice = _bounded(base + random.uniform(-8, 10))
    speaker_mismatch = _bounded(base + random.uniform(-20, 5)) if known_speaker else _bounded(base + 10)
    prosody_anomaly = _bounded(base + random.uniform(-15, 5))
    acoustic_anomaly = _bounded(base + random.uniform(-25, 5))
    context_risk = _bounded(base * 0.6 + random.uniform(-10, 20))

    if transaction_amount:
        tx_bump = min(30, transaction_amount / 100000)  # bigger transfer -> higher stakes
        transaction_risk = _bounded(base + tx_bump)
    else:
        transaction_risk = _bounded(base * 0.4 + random.uniform(-10, 10))

    weights = {
        "synthetic_voice": 0.30,
        "speaker_mismatch": 0.25,
        "prosody_anomaly": 0.15,
        "acoustic_anomaly": 0.12,
        "context_risk": 0.08,
        "transaction_risk": 0.10,
    }
    overall = (
        synthetic_voice * weights["synthetic_voice"]
        + speaker_mismatch * weights["speaker_mismatch"]
        + prosody_anomaly * weights["prosody_anomaly"]
        + acoustic_anomaly * weights["acoustic_anomaly"]
        + context_risk * weights["context_risk"]
        + transaction_risk * weights["transaction_risk"]
    )
    overall = _bounded(overall)

    return {
        "risk_score": overall,
        "synthetic_voice_score": synthetic_voice,
        "speaker_mismatch_score": speaker_mismatch,
        "prosody_anomaly_score": prosody_anomaly,
        "acoustic_anomaly_score": acoustic_anomaly,
        "context_risk_score": context_risk,
        "transaction_risk_score": transaction_risk,
    }


def risk_band(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def recommended_action(score: int) -> str:
    if score >= 80:
        return "Block / Pause Transaction"
    if score >= 60:
        return "Require Secondary Verification"
    if score >= 30:
        return "Monitor & Flag"
    return "Allow"


def status_from_score(score: int) -> str:
    if score >= 80:
        return "blocked"
    if score >= 60:
        return "verify"
    return "allowed"


def generate_risk_curve(final_score: int, duration_seconds: int = 24) -> List[Tuple[int, int]]:
    """Generate a rising/noisy risk-over-time curve that lands on final_score,
    mirroring the 'Risk Score Over Time' chart in the live call view."""
    points = []
    start = max(2, final_score - random.randint(35, 55))
    steps = max(4, duration_seconds // 3)
    for i in range(steps + 1):
        t = round(i * duration_seconds / steps)
        progress = i / steps
        value = start + (final_score - start) * (progress ** 1.3)
        value += random.uniform(-4, 4)
        points.append((t, _bounded(value)))
    points[-1] = (duration_seconds, final_score)
    return points
