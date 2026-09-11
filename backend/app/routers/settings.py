from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ModelConfig
from app import schemas

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/models", response_model=List[schemas.ModelConfigOut])
def list_models(db: Session = Depends(get_db)):
    return db.query(ModelConfig).all()


@router.patch("/models/{model_id}", response_model=schemas.ModelConfigOut)
def update_model(model_id: str, active: bool = None, threshold: float = None, db: Session = Depends(get_db)):
    model = db.query(ModelConfig).filter(ModelConfig.id == model_id).first()
    if not model:
        raise HTTPException(404, "Model config not found")
    if active is not None:
        model.active = active
    if threshold is not None:
        model.threshold = threshold
    db.commit()
    db.refresh(model)
    return model
