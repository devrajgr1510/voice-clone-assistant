from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Alert
from app import schemas

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[schemas.AlertOut])
def list_alerts(db: Session = Depends(get_db), severity: Optional[str] = None, unread_only: bool = False):
    q = db.query(Alert).order_by(Alert.created_at.desc())
    if severity:
        q = q.filter(Alert.severity == severity)
    if unread_only:
        q = q.filter(Alert.read == False)  # noqa: E712
    return q.all()


@router.post("/{alert_id}/read", response_model=schemas.AlertOut)
def mark_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Alert).update({Alert.read: True})
    db.commit()
    return {"ok": True}
