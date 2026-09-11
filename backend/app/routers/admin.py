"""Admin-panel endpoints — all protected by a valid admin JWT (see auth.py)."""
import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AdminUser, BlockedNumber, Call, Alert, Speaker, ChatMessage
from app.routers.auth import get_current_admin
from app.services import auth_service
from app import schemas

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_super_admin(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role != "super_admin":
        raise HTTPException(403, "Requires super_admin role")
    return admin


@router.get("/stats")
def stats(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    total_calls = db.query(Call).count()
    blocked_calls = db.query(Call).filter(Call.status == "blocked").count()
    critical_alerts = db.query(Alert).filter(Alert.severity == "critical").count()
    unread_alerts = db.query(Alert).filter(Alert.read == False).count()  # noqa: E712
    speakers = db.query(Speaker).count()
    blocked_numbers = db.query(BlockedNumber).count()
    admins = db.query(AdminUser).count()
    return {
        "total_calls": total_calls,
        "blocked_calls": blocked_calls,
        "critical_alerts": critical_alerts,
        "unread_alerts": unread_alerts,
        "enrolled_speakers": speakers,
        "blocked_numbers": blocked_numbers,
        "admin_accounts": admins,
        "generated_at": dt.datetime.utcnow(),
    }


# --- Admin accounts (super_admin only) --------------------------------------

class CreateAdminRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""
    email: str = ""
    role: str = "admin"  # super_admin | admin | analyst


@router.get("/admins", response_model=List[schemas.AdminUserOut])
def list_admins(db: Session = Depends(get_db), admin: AdminUser = Depends(require_super_admin)):
    return db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()


@router.post("/admins")
def create_admin(payload: CreateAdminRequest, db: Session = Depends(get_db),
                  admin: AdminUser = Depends(require_super_admin)):
    if db.query(AdminUser).filter(AdminUser.username == payload.username).first():
        raise HTTPException(409, "Username already exists")
    if payload.role not in ("super_admin", "admin", "analyst"):
        raise HTTPException(400, "role must be super_admin, admin, or analyst")
    row = AdminUser(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        password_hash=auth_service.hash_password(payload.password),
    )
    db.add(row)
    db.commit()
    return {"created": True, "username": row.username}


@router.patch("/admins/{admin_id}/toggle-active")
def toggle_admin_active(admin_id: str, db: Session = Depends(get_db),
                         admin: AdminUser = Depends(require_super_admin)):
    row = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not row:
        raise HTTPException(404, "Admin not found")
    row.active = not row.active
    db.commit()
    return {"id": row.id, "active": row.active}


# --- Blocked numbers ----------------------------------------------------

class BlockNumberRequest(BaseModel):
    number: str
    reason: str = ""


@router.get("/blocked-numbers", response_model=List[schemas.BlockedNumberOut])
def list_blocked_numbers(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return db.query(BlockedNumber).order_by(BlockedNumber.created_at.desc()).all()


@router.post("/blocked-numbers", response_model=schemas.BlockedNumberOut)
def block_number(payload: BlockNumberRequest, db: Session = Depends(get_db),
                  admin: AdminUser = Depends(get_current_admin)):
    existing = db.query(BlockedNumber).filter(BlockedNumber.number == payload.number).first()
    if existing:
        return existing
    row = BlockedNumber(number=payload.number, reason=payload.reason, blocked_by=admin.username)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/blocked-numbers/{blocked_id}")
def unblock_number(blocked_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    row = db.query(BlockedNumber).filter(BlockedNumber.id == blocked_id).first()
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}


# --- Help-desk transcripts -----------------------------------------------

@router.get("/helpdesk/sessions")
def helpdesk_sessions(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    rows = db.query(ChatMessage.session_id).distinct().all()
    return [r[0] for r in rows]


@router.get("/helpdesk/sessions/{session_id}", response_model=List[schemas.ChatMessageOut])
def helpdesk_transcript(session_id: str, db: Session = Depends(get_db),
                         admin: AdminUser = Depends(get_current_admin)):
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return rows
