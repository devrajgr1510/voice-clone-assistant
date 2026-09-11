"""
Outbound dialer — lets an operator place a call to any mobile number from the
Dialer page, tracks its lifecycle (dialing -> ringing -> in_progress -> ended)
in the same `calls` table used by the rest of the platform, and runs it
through the same impersonation-risk pipeline once it ends.

Real-vs-simulated calling is decided entirely inside `services/telephony.py`
— this router doesn't need to know which mode it's in.
"""
import datetime as dt
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import Call, RiskPoint, Alert, Recording
from app import schemas
from app.services import risk_engine, telephony

router = APIRouter(prefix="/api/dialer", tags=["dialer"])

# Unambiguous alphabet for spoken/typed room codes (no 0/O/1/I).
_CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1I")


def _generate_room_code(db: Session, length: int = 6) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
        if not db.query(Call).filter(Call.room_code == code).first():
            return code
    raise HTTPException(500, "Could not generate a unique room code, please retry")


@router.post("/call", response_model=schemas.DialerStartOut)
def start_call(payload: schemas.DialerCallCreate, db: Session = Depends(get_db)):
    result = telephony.place_call(payload.to_number, payload.from_number)

    call = Call(
        caller_number=payload.from_number or "VAANEE SHIELD Softphone",
        expected_speaker_id=payload.speaker_id,
        expected_speaker_label=payload.contact_label or payload.to_number,
        language="English",
        direction="outbound",
        to_number=payload.to_number,
        from_number=payload.from_number,
        provider=result["provider"],
        provider_call_sid=result["provider_call_sid"],
        call_state="failed" if result["state"] == "failed" else "ringing",
        status="analyzing",
        duration_seconds=0,
        created_at=dt.datetime.utcnow(),
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    return schemas.DialerStartOut(
        call=schemas.DialerCallOut.model_validate(call),
        live=telephony.is_live_configured(),
        message=result["message"],
    )


@router.post("/room", response_model=schemas.RoomOut)
def create_room(payload: schemas.RoomCreateIn, db: Session = Depends(get_db)):
    """Creates a real two-way (WebRTC) call room. The creator becomes the
    'caller' and gets back a room id + short room_code to share with the
    'responder' (via a link to /dialer/join/{id} or by reading the code
    aloud). No phone number or telephony provider is involved — audio flows
    browser-to-browser once both sides connect to the signaling socket at
    /ws/webrtc/{id}."""
    call = Call(
        caller_number=payload.caller_label or "Caller",
        expected_speaker_id=payload.speaker_id,
        expected_speaker_label=payload.caller_label,
        language="English",
        direction="outbound",
        channel="webrtc",
        room_code=_generate_room_code(db),
        provider="webrtc",
        call_state="ringing",  # waiting for the responder to join
        status="analyzing",
        duration_seconds=0,
        created_at=dt.datetime.utcnow(),
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


@router.get("/room/{room_id}", response_model=schemas.RoomOut)
def get_room(room_id: str, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == room_id, Call.channel == "webrtc").first()
    if not call:
        raise HTTPException(404, "This call link isn't valid or has expired")
    return call


@router.post("/room/{room_id}/join", response_model=schemas.RoomOut)
def join_room(room_id: str, payload: schemas.RoomJoinIn, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == room_id, Call.channel == "webrtc").first()
    if not call:
        raise HTTPException(404, "This call link isn't valid or has expired")
    if call.call_state == "ended":
        raise HTTPException(409, "This call has already ended")
    call.responder_label = payload.responder_label or "Responder"
    call.call_state = "in_progress"
    db.commit()
    db.refresh(call)
    return call


@router.post("/{call_id}/answer", response_model=schemas.DialerCallOut)
def answer_call(call_id: str, db: Session = Depends(get_db)):
    """Marks the callee as having picked up. In simulation mode the frontend
    calls this after a short ring delay; in live mode this would instead be
    driven by your provider's call-status webhook (e.g. Twilio's
    `answered` status callback)."""
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")
    if call.call_state == "failed":
        raise HTTPException(409, "Call failed to connect")
    call.call_state = "in_progress"
    db.commit()
    db.refresh(call)
    return call


@router.post("/{call_id}/end", response_model=schemas.CallDetailOut)
def end_call(call_id: str, payload: schemas.DialerEndIn, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")

    if call.call_state == "ended":
        # Idempotent: in a two-way real call either side may hang up first
        # and both sides call this endpoint — only score/save once.
        return (
            db.query(Call)
            .options(joinedload(Call.risk_points))
            .filter(Call.id == call_id)
            .first()
        )

    telephony.end_call(call.provider_call_sid)

    scores = risk_engine.score_call(known_speaker=bool(call.expected_speaker_id))
    duration = max(1, payload.duration_seconds)

    call.duration_seconds = duration
    call.call_state = "ended"
    call.ended_at = dt.datetime.utcnow()
    call.status = risk_engine.status_from_score(scores["risk_score"])
    call.recommended_action = risk_engine.recommended_action(scores["risk_score"])
    for k, v in scores.items():
        setattr(call, k, v)

    for t, v in risk_engine.generate_risk_curve(scores["risk_score"], min(duration, 60)):
        db.add(RiskPoint(call_id=call.id, t_seconds=t, risk_score=v))

    if scores["risk_score"] >= 60:
        sev = "critical" if scores["risk_score"] >= 80 else "high"
        db.add(Alert(
            call_id=call.id,
            severity=sev,
            title="High Risk Voice Impersonation Detected" if sev == "critical" else "Elevated Impersonation Risk Detected",
            description=f"Outbound call {call.id} to {call.to_number} scored {scores['risk_score']}/100 impersonation risk.",
        ))

    if payload.recording_id:
        rec = db.query(Recording).filter(Recording.id == payload.recording_id).first()
        if rec:
            rec.call_id = call.id
            rec.kind = "call"

    db.commit()

    call = (
        db.query(Call)
        .options(joinedload(Call.risk_points))
        .filter(Call.id == call_id)
        .first()
    )
    return call


@router.get("/{call_id}", response_model=schemas.DialerCallOut)
def get_call_status(call_id: str, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")
    return call
