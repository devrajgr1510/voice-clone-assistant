import datetime as dt
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.models import Call, RiskPoint, Alert
from app import schemas
from app.services import risk_engine

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("", response_model=List[schemas.CallOut])
def list_calls(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
):
    q = db.query(Call).order_by(Call.created_at.desc())
    if status:
        q = q.filter(Call.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Call.id.ilike(like))
            | (Call.caller_number.ilike(like))
            | (Call.expected_speaker_label.ilike(like))
        )
    return q.limit(limit).all()


@router.get("/latest", response_model=schemas.CallDetailOut)
def latest_call(db: Session = Depends(get_db)):
    """Most recent call — used to populate the Live Call Protection screen."""
    call = (
        db.query(Call)
        .options(joinedload(Call.risk_points))
        .order_by(Call.created_at.desc())
        .first()
    )
    if not call:
        raise HTTPException(404, "No calls yet")
    return call


@router.get("/{call_id}", response_model=schemas.CallDetailOut)
def get_call(call_id: str, db: Session = Depends(get_db)):
    call = (
        db.query(Call)
        .options(joinedload(Call.risk_points))
        .filter(Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(404, "Call not found")
    return call


@router.post("", response_model=schemas.CallDetailOut)
def create_call(payload: schemas.CallCreate, db: Session = Depends(get_db)):
    """
    Simulates a new incoming call being analyzed in real time. In production
    this would be triggered by the telephony/VoIP integration streaming audio
    into the analysis pipeline; here we synthesize a coherent risk profile.
    """
    scores = risk_engine.score_call(transaction_amount=payload.transaction_amount)
    duration = 24
    call = Call(
        caller_number=payload.caller_number,
        expected_speaker_id=payload.expected_speaker_id,
        expected_speaker_label=payload.expected_speaker_label,
        language=payload.language,
        duration_seconds=duration,
        status=risk_engine.status_from_score(scores["risk_score"]),
        recommended_action=risk_engine.recommended_action(scores["risk_score"]),
        transaction_amount=payload.transaction_amount,
        created_at=dt.datetime.utcnow(),
        **scores,
    )
    db.add(call)
    db.flush()

    for t, v in risk_engine.generate_risk_curve(scores["risk_score"], duration):
        db.add(RiskPoint(call_id=call.id, t_seconds=t, risk_score=v))

    if scores["risk_score"] >= 60:
        sev = "critical" if scores["risk_score"] >= 80 else "high"
        db.add(Alert(
            call_id=call.id,
            severity=sev,
            title="High Risk Voice Impersonation Detected" if sev == "critical" else "Elevated Impersonation Risk Detected",
            description=f"Call {call.id} from {payload.caller_number} scored {scores['risk_score']}/100 impersonation risk.",
        ))

    db.commit()
    db.refresh(call)
    return get_call(call.id, db)


@router.post("/{call_id}/action")
def execute_action(call_id: str, db: Session = Depends(get_db)):
    """Executes the recommended action (block/verify/allow) for a call."""
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")
    call.status = risk_engine.status_from_score(call.risk_score)
    db.commit()
    return {"call_id": call.id, "status": call.status, "action": call.recommended_action}
