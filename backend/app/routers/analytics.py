import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Call
from app import schemas
from app.services.risk_engine import risk_band

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=schemas.AnalyticsSummary)
def summary(db: Session = Depends(get_db)):
    calls = db.query(Call).all()
    total = len(calls) or 1

    bands = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for c in calls:
        bands[risk_band(c.risk_score)] += 1

    high_risk = bands["high"] + bands["critical"]
    blocked = sum(1 for c in calls if c.status == "blocked")
    prevented_loss = sum(c.transaction_amount or 0 for c in calls if c.status == "blocked")

    # Build a 7-day trend by bucketing calls' created_at into risk bands per day.
    today = dt.datetime.utcnow().date()
    days = [today - dt.timedelta(days=i) for i in range(6, -1, -1)]
    trend = []
    for d in days:
        day_calls = [c for c in calls if c.created_at.date() == d]
        row = {"date": d.strftime("%d %b"), "low": 0, "medium": 0, "high": 0, "critical": 0}
        for c in day_calls:
            row[risk_band(c.risk_score)] += 1
        trend.append(row)

    return schemas.AnalyticsSummary(
        total_calls_analyzed=len(calls),
        total_calls_delta_pct=12.5,
        high_risk_calls=high_risk,
        high_risk_delta_pct=18.7,
        blocked_transactions=blocked,
        blocked_delta_pct=33.3,
        prevented_loss_inr=prevented_loss,
        prevented_loss_delta_pct=25.6,
        risk_distribution={
            "low": round(bands["low"] / total * 100),
            "medium": round(bands["medium"] / total * 100),
            "high": round(bands["high"] / total * 100),
            "critical": round(bands["critical"] / total * 100),
            "total": len(calls),
        },
        risk_trend=trend,
    )
