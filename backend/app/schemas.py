"""Pydantic schemas — API-facing shapes, decoupled from the ORM models."""
import datetime as dt
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class SpeakerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_id: Optional[str] = None
    name: str
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    verified: bool
    avatar_seed: Optional[str] = None


class SpeakerCreate(BaseModel):
    employee_id: str
    name: str
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class VoiceSampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: Optional[str]
    size_kb: Optional[float]
    duration_seconds: Optional[float]
    recorded_at: dt.datetime


class RiskPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    t_seconds: int
    risk_score: int


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    caller_number: str
    expected_speaker_label: Optional[str]
    language: Optional[str]
    duration_seconds: int
    status: str
    risk_score: int
    synthetic_voice_score: int
    speaker_mismatch_score: int
    prosody_anomaly_score: int
    acoustic_anomaly_score: int
    context_risk_score: int
    transaction_risk_score: int
    recommended_action: str
    transaction_amount: Optional[float]
    created_at: dt.datetime


class CallDetailOut(CallOut):
    risk_points: List[RiskPointOut] = []


class CallCreate(BaseModel):
    caller_number: str
    expected_speaker_id: Optional[str] = None
    expected_speaker_label: Optional[str] = None
    language: str = "English"
    transaction_amount: Optional[float] = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    call_id: Optional[str]
    severity: str
    title: str
    description: Optional[str]
    read: bool
    created_at: dt.datetime


class AnalyticsSummary(BaseModel):
    total_calls_analyzed: int
    total_calls_delta_pct: float
    high_risk_calls: int
    high_risk_delta_pct: float
    blocked_transactions: int
    blocked_delta_pct: float
    prevented_loss_inr: float
    prevented_loss_delta_pct: float
    risk_distribution: dict
    risk_trend: List[dict]


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    kind: str
    label: Optional[str] = None
    speaker_id: Optional[str] = None
    call_id: Optional[str] = None
    mime_type: str
    duration_seconds: float
    size_kb: float
    created_at: dt.datetime


class DialerCallCreate(BaseModel):
    to_number: str
    from_number: Optional[str] = None
    contact_label: Optional[str] = None
    speaker_id: Optional[str] = None


class DialerCallOut(CallOut):
    direction: str
    to_number: Optional[str] = None
    from_number: Optional[str] = None
    provider: str
    provider_call_sid: Optional[str] = None
    call_state: str


class DialerStartOut(BaseModel):
    call: DialerCallOut
    live: bool
    message: str


class DialerEndIn(BaseModel):
    duration_seconds: int
    recording_id: Optional[str] = None


class RoomCreateIn(BaseModel):
    caller_label: Optional[str] = None
    speaker_id: Optional[str] = None


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    room_code: str
    channel: str
    call_state: str
    caller_number: str
    expected_speaker_label: Optional[str] = None
    responder_label: Optional[str] = None
    created_at: dt.datetime


class RoomJoinIn(BaseModel):
    responder_label: Optional[str] = None


class ModelConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    version: str
    kind: str
    threshold: float
    active: bool


class BlockedNumberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    number: str
    reason: Optional[str] = None
    blocked_by: Optional[str] = None
    created_at: dt.datetime


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    session_id: str
    role: str
    text: str
    language: str
    matched_topic: Optional[str] = None
    created_at: dt.datetime


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    active: bool
    last_login: Optional[dt.datetime] = None
    created_at: dt.datetime
