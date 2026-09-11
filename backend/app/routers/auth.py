"""Admin authentication — login issues a JWT, protected routes depend on
`get_current_admin` to verify it."""
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AdminUser
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str


def get_current_admin(authorization: str = Header(None), db: Session = Depends(get_db)) -> AdminUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = auth_service.decode_access_token(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    admin = db.query(AdminUser).filter(AdminUser.username == payload.get("sub")).first()
    if not admin or not admin.active:
        raise HTTPException(401, "Admin account not found or disabled")
    return admin


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.username == payload.username).first()
    if not admin or not auth_service.verify_password(payload.password, admin.password_hash):
        raise HTTPException(401, "Incorrect username or password")
    if not admin.active:
        raise HTTPException(403, "This admin account has been disabled")
    admin.last_login = dt.datetime.utcnow()
    db.commit()
    token = auth_service.create_access_token(sub=admin.username, role=admin.role)
    return LoginResponse(
        access_token=token, username=admin.username, full_name=admin.full_name, role=admin.role,
    )


@router.get("/me")
def me(admin: AdminUser = Depends(get_current_admin)):
    return {
        "username": admin.username,
        "full_name": admin.full_name,
        "email": admin.email,
        "role": admin.role,
        "last_login": admin.last_login,
    }
