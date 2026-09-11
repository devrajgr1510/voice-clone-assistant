"""Help-desk chat endpoint — local rule-based FAQ assistant (see
app.services.helpdesk_kb for the honesty note on how it works)."""
from typing import Optional, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ChatMessage
from app.services import helpdesk_kb

router = APIRouter(prefix="/api/helpdesk", tags=["helpdesk"])


class AskRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: str = "en"


class AskResponse(BaseModel):
    session_id: str
    reply: str
    matched_topic: Optional[str] = None
    used_fallback_language: bool = False
    supported_languages: List[str] = helpdesk_kb.SUPPORTED_LANGS


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest, db: Session = Depends(get_db)):
    session_id = payload.session_id or helpdesk_kb.new_session_id()
    reply, topic_id, used_fallback = helpdesk_kb.answer(payload.message, payload.language)

    db.add(ChatMessage(session_id=session_id, role="user", text=payload.message,
                        language=payload.language, matched_topic=topic_id))
    db.add(ChatMessage(session_id=session_id, role="assistant", text=reply,
                        language=payload.language, matched_topic=topic_id))
    db.commit()

    return AskResponse(
        session_id=session_id, reply=reply, matched_topic=topic_id,
        used_fallback_language=used_fallback,
    )


@router.get("/languages")
def languages():
    return {"supported": helpdesk_kb.SUPPORTED_LANGS}
