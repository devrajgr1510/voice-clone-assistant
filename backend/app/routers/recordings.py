"""
Voice recordings — microphone-captured audio clips.

Two kinds are stored side by side in the same table:
  * "demo"  — a voice sample recorded from the mic to enroll/test a speaker
              (played back from the Dialer's Voice Studio panel)
  * "call"  — audio captured live during a dialer session, linked to a Call

Raw audio bytes are written to disk under backend/app/media/recordings/; only
the filename + metadata are persisted in the database. Swap this for S3/GCS
in production by changing `save_bytes`/`read_bytes` below — the router and
DB schema don't need to change.
"""
import os
import uuid
import datetime as dt
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Recording
from app import schemas

MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media", "recordings")
os.makedirs(MEDIA_DIR, exist_ok=True)

router = APIRouter(prefix="/api/recordings", tags=["recordings"])


def _extension_for(content_type: Optional[str]) -> str:
    if not content_type:
        return ".webm"
    if "wav" in content_type:
        return ".wav"
    if "mpeg" in content_type or "mp3" in content_type:
        return ".mp3"
    if "ogg" in content_type:
        return ".ogg"
    return ".webm"


@router.get("", response_model=List[schemas.RecordingOut])
def list_recordings(
    db: Session = Depends(get_db),
    kind: Optional[str] = None,
    speaker_id: Optional[str] = None,
    call_id: Optional[str] = None,
):
    q = db.query(Recording).order_by(Recording.created_at.desc())
    if kind:
        q = q.filter(Recording.kind == kind)
    if speaker_id:
        q = q.filter(Recording.speaker_id == speaker_id)
    if call_id:
        q = q.filter(Recording.call_id == call_id)
    return q.all()


@router.post("", response_model=schemas.RecordingOut)
async def create_recording(
    audio: UploadFile = File(...),
    label: str = Form("Voice Recording"),
    kind: str = Form("demo"),
    duration_seconds: float = Form(0),
    speaker_id: Optional[str] = Form(None),
    call_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty audio upload")

    fname = f"{uuid.uuid4()}{_extension_for(audio.content_type)}"
    with open(os.path.join(MEDIA_DIR, fname), "wb") as f:
        f.write(data)

    rec = Recording(
        kind=kind,
        label=label,
        speaker_id=speaker_id or None,
        call_id=call_id or None,
        file_path=fname,
        mime_type=audio.content_type or "audio/webm",
        duration_seconds=round(duration_seconds, 1),
        size_kb=round(len(data) / 1024, 1),
        created_at=dt.datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/{recording_id}/audio")
def get_recording_audio(recording_id: str, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(404, "Recording not found")
    fpath = os.path.join(MEDIA_DIR, rec.file_path)
    if not os.path.exists(fpath):
        raise HTTPException(404, "Audio file missing on disk")
    return FileResponse(fpath, media_type=rec.mime_type)


@router.delete("/{recording_id}")
def delete_recording(recording_id: str, db: Session = Depends(get_db)):
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(404, "Recording not found")
    fpath = os.path.join(MEDIA_DIR, rec.file_path)
    if os.path.exists(fpath):
        os.remove(fpath)
    db.delete(rec)
    db.commit()
    return {"deleted": True}
