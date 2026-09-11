"""
ORM models for VAANEE SHIELD — voice cloning / impersonation detection platform.
"""
import datetime as dt
import uuid

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{dt.datetime.utcnow().strftime('%Y-%m-%d')}-{str(uuid.uuid4())[:4].upper()}"


class Speaker(Base):
    __tablename__ = "speakers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String)
    department = Column(String)
    email = Column(String)
    phone = Column(String)
    verified = Column(Boolean, default=False)
    avatar_seed = Column(String, default="default")
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    voice_samples = relationship("VoiceSample", back_populates="speaker", cascade="all, delete-orphan")
    calls = relationship("Call", back_populates="expected_speaker")


class VoiceSample(Base):
    __tablename__ = "voice_samples"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    speaker_id = Column(String, ForeignKey("speakers.id"))
    label = Column(String)
    size_kb = Column(Float)
    duration_seconds = Column(Float)
    recorded_at = Column(DateTime, default=dt.datetime.utcnow)

    speaker = relationship("Speaker", back_populates="voice_samples")


class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, default=lambda: gen_id("VS"))
    caller_number = Column(String, nullable=False)
    expected_speaker_id = Column(String, ForeignKey("speakers.id"), nullable=True)
    expected_speaker_label = Column(String)  # denormalized display label e.g. "CFO - Rajesh Kumar"
    language = Column(String, default="English")
    duration_seconds = Column(Integer, default=0)
    status = Column(String, default="analyzing")  # analyzing | allowed | verify | blocked

    risk_score = Column(Integer, default=0)
    synthetic_voice_score = Column(Integer, default=0)
    speaker_mismatch_score = Column(Integer, default=0)
    prosody_anomaly_score = Column(Integer, default=0)
    acoustic_anomaly_score = Column(Integer, default=0)
    context_risk_score = Column(Integer, default=0)
    transaction_risk_score = Column(Integer, default=0)

    recommended_action = Column(String, default="Monitor")
    transaction_amount = Column(Float, nullable=True)

    created_at = Column(DateTime, default=dt.datetime.utcnow)

    # --- Dialer / real-time calling fields ---
    direction = Column(String, default="inbound")  # inbound | outbound
    to_number = Column(String, nullable=True)
    from_number = Column(String, nullable=True)
    provider = Column(String, default="simulated")  # simulated | twilio
    provider_call_sid = Column(String, nullable=True)
    call_state = Column(String, default="ended")  # dialing | ringing | in_progress | ended | failed
    ended_at = Column(DateTime, nullable=True)

    # --- Real two-way (WebRTC) call fields ---
    channel = Column(String, default="pstn")  # pstn | webrtc
    room_code = Column(String, unique=True, nullable=True, index=True)
    responder_label = Column(String, nullable=True)

    expected_speaker = relationship("Speaker", back_populates="calls")
    risk_points = relationship("RiskPoint", back_populates="call", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="call", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="call", cascade="all, delete-orphan")


class RiskPoint(Base):
    """A single point in the risk-score-over-time waveform/chart for a call."""
    __tablename__ = "risk_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String, ForeignKey("calls.id"))
    t_seconds = Column(Integer)
    risk_score = Column(Integer)

    call = relationship("Call", back_populates="risk_points")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    call_id = Column(String, ForeignKey("calls.id"), nullable=True)
    severity = Column(String, default="medium")  # critical | high | medium | low
    title = Column(String, nullable=False)
    description = Column(Text)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    call = relationship("Call", back_populates="alerts")


class Recording(Base):
    """
    A stored audio clip: either a 'demo' voice sample recorded from the
    microphone (enrollment / test audio) or a 'call' recording captured
    during a dialer session. Raw bytes live on disk under app/media/recordings
    (or your object storage in production); only metadata + path live here.
    """
    __tablename__ = "recordings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    kind = Column(String, default="demo")  # demo | call
    label = Column(String)
    speaker_id = Column(String, ForeignKey("speakers.id"), nullable=True)
    call_id = Column(String, ForeignKey("calls.id"), nullable=True)
    file_path = Column(String, nullable=False)  # filename on disk within media/recordings
    mime_type = Column(String, default="audio/webm")
    duration_seconds = Column(Float, default=0)
    size_kb = Column(Float, default=0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    speaker = relationship("Speaker")
    call = relationship("Call", back_populates="recordings")


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    version = Column(String)
    kind = Column(String)  # synthetic_voice | speaker_verification | prosody | acoustic
    threshold = Column(Float, default=0.7)
    active = Column(Boolean, default=True)


class AdminUser(Base):
    """Admin-panel operator account (separate from Speakers, who are the
    employees the platform protects, not people who log into the console)."""
    __tablename__ = "admin_users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, default="")
    email = Column(String, default="")
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin")  # super_admin | admin | analyst
    active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class BlockedNumber(Base):
    __tablename__ = "blocked_numbers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    number = Column(String, unique=True, index=True, nullable=False)
    reason = Column(String, default="")
    blocked_by = Column(String, default="system")  # admin username, or "system" for automatic
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class ChatMessage(Base):
    """Help-desk conversation turns, kept for the admin panel's transcript view."""
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, index=True, nullable=False)
    role = Column(String)  # user | assistant
    text = Column(Text)
    language = Column(String, default="en")
    matched_topic = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
