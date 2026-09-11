"""
Voice-analysis endpoints — runs the real DSP-heuristic detector
(app.services.voice_analysis) against either a fresh upload or an
already-stored recording, and optionally folds the result back into the
parent Call's risk score.
"""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Recording, Call, Alert
from app.services import voice_analysis, risk_engine

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


@router.post("/audio")
async def analyze_uploaded_audio(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty audio upload")
    result = voice_analysis.analyze_audio_bytes(data, audio.content_type or "")
    return result


@router.post("/recording/{recording_id}")
async def analyze_stored_recording(
    recording_id: str,
    apply_to_call: bool = True,
    audio: Optional[UploadFile] = File(
        None,
        description="Optional pre-decoded audio (e.g. a browser-side WAV re-encode of a "
                     "webm/opus recording). If omitted, the file already stored on disk for "
                     "this recording is analyzed as-is.",
    ),
    db: Session = Depends(get_db),
):
    import os

    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(404, "Recording not found")

    if audio is not None:
        # The caller (Analyzer page) already decoded the original webm/opus/mp4
        # recording in-browser and re-encoded it as PCM WAV — use those real
        # samples instead of re-reading the original (possibly undecodable
        # server-side) file from disk.
        data = await audio.read()
        content_type = audio.content_type or "audio/wav"
    else:
        media_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media", "recordings")
        fpath = os.path.join(media_dir, rec.file_path)
        if not os.path.exists(fpath):
            raise HTTPException(404, "Audio file missing on disk")
        with open(fpath, "rb") as f:
            data = f.read()
        content_type = rec.mime_type or ""

    result = voice_analysis.analyze_audio_bytes(data, content_type)
    result["recording_id"] = recording_id

    if apply_to_call and rec.call_id:
        call = db.query(Call).filter(Call.id == rec.call_id).first()
        if call and result.get("format_supported"):
            # Blend the real DSP reading with the existing (simulated) sub-scores
            # rather than overwrite everything, so a single short clip can't
            # wildly swing an otherwise well-supported risk profile.
            new_synthetic = result["synthetic_voice_likelihood"]
            call.synthetic_voice_score = round(0.5 * call.synthetic_voice_score + 0.5 * new_synthetic)
            weights = {
                "synthetic_voice": 0.30, "speaker_mismatch": 0.25, "prosody_anomaly": 0.15,
                "acoustic_anomaly": 0.12, "context_risk": 0.08, "transaction_risk": 0.10,
            }
            call.risk_score = risk_engine._bounded(
                call.synthetic_voice_score * weights["synthetic_voice"]
                + call.speaker_mismatch_score * weights["speaker_mismatch"]
                + call.prosody_anomaly_score * weights["prosody_anomaly"]
                + call.acoustic_anomaly_score * weights["acoustic_anomaly"]
                + call.context_risk_score * weights["context_risk"]
                + call.transaction_risk_score * weights["transaction_risk"]
            )
            call.status = risk_engine.status_from_score(call.risk_score)
            call.recommended_action = risk_engine.recommended_action(call.risk_score)
            if call.risk_score >= 60:
                sev = "critical" if call.risk_score >= 80 else "high"
                db.add(Alert(
                    call_id=call.id, severity=sev,
                    title="Voice Analysis Flagged This Recording",
                    description=f"DSP-heuristic analysis of recording {recording_id} scored "
                                 f"{new_synthetic}/100 synthetic-voice likelihood, updating call risk to {call.risk_score}.",
                    created_at=dt.datetime.utcnow(),
                ))
            db.commit()
            result["updated_call_risk_score"] = call.risk_score
            result["updated_call_status"] = call.status

    return result
