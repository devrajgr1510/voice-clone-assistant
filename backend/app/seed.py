"""Seed the database with demo speakers, calls, alerts so the UI has data
to render on first run. Safe to re-run — it only seeds when tables are empty.
"""
import datetime as dt
import random

import os

from app.database import SessionLocal, engine, Base
from app.models.models import Speaker, VoiceSample, Call, RiskPoint, Alert, ModelConfig, AdminUser
from app.services import risk_engine, auth_service

DEFAULT_ADMIN_USERNAME = os.environ.get("VAANEE_DEFAULT_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.environ.get("VAANEE_DEFAULT_ADMIN_PASSWORD", "VaaneeAdmin@123")

SPEAKERS = [
    dict(employee_id="EMP001", name="Rajesh Kumar", role="CFO", department="Finance",
         email="rajesh.kumar@company.com", phone="+91 98765 43210", verified=True, avatar_seed="rajesh"),
    dict(employee_id="EMP002", name="Amit Sharma", role="CEO", department="Executive",
         email="amit.sharma@company.com", phone="+91 87654 32109", verified=True, avatar_seed="amit"),
    dict(employee_id="EMP003", name="Priya Singh", role="Manager", department="Operations",
         email="priya.singh@company.com", phone="+91 76543 21098", verified=True, avatar_seed="priya"),
    dict(employee_id="EMP004", name="Anjali Mehta", role="Head of HR", department="Human Resources",
         email="anjali.mehta@company.com", phone="+91 65432 10987", verified=True, avatar_seed="anjali"),
]

CALL_TEMPLATES = [
    ("+91 98765 43210", "CFO - Rajesh Kumar", "English", 250000),
    ("+91 87654 32109", "CEO - Amit Sharma", "Hindi", None),
    ("+91 76543 21098", "Manager - Priya Singh", "English", None),
    ("+91 65432 10987", "CFO - Rajesh Kumar", "English", 1200000),
    ("+91 54321 09876", "CEO - Amit Sharma", "Marathi", 80000),
]


def seed_admin(db):
    """Idempotent — creates the default super_admin only if no admin exists yet."""
    if db.query(AdminUser).count() > 0:
        return
    db.add(AdminUser(
        username=DEFAULT_ADMIN_USERNAME,
        full_name="Default Super Admin",
        email="admin@vaanee.local",
        role="super_admin",
        password_hash=auth_service.hash_password(DEFAULT_ADMIN_PASSWORD),
    ))
    db.commit()
    print(
        f"[seed] Created default admin account -> username: {DEFAULT_ADMIN_USERNAME!r}  "
        f"password: {DEFAULT_ADMIN_PASSWORD!r}  (CHANGE THIS after first login)"
    )


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_admin(db)
        if db.query(Speaker).count() > 0:
            return  # already seeded

        speakers = []
        for s in SPEAKERS:
            speaker = Speaker(**s)
            db.add(speaker)
            db.flush()
            speakers.append(speaker)
            for i in range(3):
                db.add(VoiceSample(
                    speaker_id=speaker.id,
                    label=f"Sample {i + 1}",
                    size_kb=round(random.uniform(1.8, 3.4), 1),
                    duration_seconds=round(random.uniform(8, 25), 1),
                    recorded_at=dt.datetime.utcnow() - dt.timedelta(days=random.randint(1, 90)),
                ))

        # Model configuration defaults, mirroring the Settings > AI Models panel
        db.add_all([
            ModelConfig(name="Synthetic Voice Detection Model", version="AASIST (v1.2.3)",
                        kind="synthetic_voice", threshold=0.70, active=True),
            ModelConfig(name="Speaker Verification Model", version="ECAPA-TDNN (v2.1.0)",
                        kind="speaker_verification", threshold=0.75, active=True),
            ModelConfig(name="Prosody Analysis Model", version="ProsodyNet (v1.0.5)",
                        kind="prosody", threshold=0.60, active=True),
            ModelConfig(name="Acoustic Analysis Model", version="RawNet2 (v1.1.0)",
                        kind="acoustic", threshold=0.65, active=True),
        ])

        now = dt.datetime.utcnow()
        for i, (caller, label, lang, amount) in enumerate(CALL_TEMPLATES):
            high_risk = i in (0, 3)
            scores = risk_engine.score_call(
                is_high_risk_hint=high_risk, transaction_amount=amount
            )
            duration = random.randint(20, 190)
            call = Call(
                caller_number=caller,
                expected_speaker_label=label,
                language=lang,
                duration_seconds=duration,
                status=risk_engine.status_from_score(scores["risk_score"]),
                recommended_action=risk_engine.recommended_action(scores["risk_score"]),
                transaction_amount=amount,
                created_at=now - dt.timedelta(minutes=(len(CALL_TEMPLATES) - i) * 12),
                **scores,
            )
            db.add(call)
            db.flush()

            for t, v in risk_engine.generate_risk_curve(scores["risk_score"], min(duration, 24)):
                db.add(RiskPoint(call_id=call.id, t_seconds=t, risk_score=v))

            if scores["risk_score"] >= 60:
                sev = "critical" if scores["risk_score"] >= 80 else "high"
                db.add(Alert(
                    call_id=call.id,
                    severity=sev,
                    title="High Risk Voice Impersonation Detected" if sev == "critical" else "Elevated Impersonation Risk Detected",
                    description=f"Call {call.id} from {caller} scored {scores['risk_score']}/100 impersonation risk.",
                    created_at=call.created_at,
                ))

        # A few extra non-call alerts (device/login/location), matching the UI mock
        extra_alerts = [
            ("high", "Unusual Transaction Request", "A transfer request for \u20b92,50,000 was flagged for manual review."),
            ("medium", "New Device Login Detected", "User rajesh.kumar@company.com signed in from an unrecognized device."),
            ("high", "Multiple Failed Verifications", "3 consecutive callback verification attempts failed for the same caller ID."),
            ("medium", "Unusual Location Detected", "Login detected from Mumbai, India — outside the usual access pattern."),
        ]
        for sev, title, desc in extra_alerts:
            db.add(Alert(severity=sev, title=title, description=desc,
                          created_at=now - dt.timedelta(minutes=random.randint(5, 90))))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Database seeded.")
