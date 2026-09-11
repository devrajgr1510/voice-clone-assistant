from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import Speaker
from app import schemas

router = APIRouter(prefix="/api/speakers", tags=["speakers"])


@router.get("", response_model=List[schemas.SpeakerOut])
def list_speakers(db: Session = Depends(get_db)):
    return db.query(Speaker).order_by(Speaker.name).all()


@router.get("/{speaker_id}")
def get_speaker(speaker_id: str, db: Session = Depends(get_db)):
    speaker = (
        db.query(Speaker)
        .options(joinedload(Speaker.voice_samples))
        .filter(Speaker.id == speaker_id)
        .first()
    )
    if not speaker:
        raise HTTPException(404, "Speaker not found")
    return {
        **schemas.SpeakerOut.model_validate(speaker).model_dump(),
        "voice_samples": [schemas.VoiceSampleOut.model_validate(v).model_dump() for v in speaker.voice_samples],
    }


@router.post("", response_model=schemas.SpeakerOut)
def create_speaker(payload: schemas.SpeakerCreate, db: Session = Depends(get_db)):
    speaker = Speaker(**payload.model_dump(), verified=False, avatar_seed=payload.name.split(" ")[0].lower())
    db.add(speaker)
    db.commit()
    db.refresh(speaker)
    return speaker
