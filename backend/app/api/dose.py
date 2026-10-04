from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Patient, User
from app.schemas.schemas import DoseAnalyzeRequest, DoseAnalyzeResponse
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event
from app.services.dose_service import dose_service

router = APIRouter(prefix="/dose", tags=["Dose / Posology Support"])
posology_router = APIRouter(prefix="/posology", tags=["Dose / Posology Support"])

@posology_router.post("/analyze", response_model=DoseAnalyzeResponse)
@router.post("/analyze", response_model=DoseAnalyzeResponse)
def analyze_dose(
    payload: DoseAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Module 2: AI-Assisted Posology / Dose Support
    - Calculates DuBois BSA and BMI
    - Identifies and normalizes drug using RxNorm
    - Cross-references official openFDA monograph dosing
    - Flags pediatric/geriatric/renal safety alerts
    - Disallows blind use of Clark's/Young's rules
    - Explicitly marks calculation as an estimate requiring clinician confirmation
    """
    # If patient_id provided, fetch baseline vitals if not supplied
    age = payload.age
    weight = payload.weight_kg or payload.weight
    height = payload.height_cm or payload.height
    strength = payload.strength or payload.dosage

    if payload.patient_id:
        patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
        if patient:
            age = patient.age or age
            weight = patient.weight or weight
            height = patient.height or height

    result = dose_service.analyze_posology(
        drug_name=payload.drug_name,
        age=age,
        weight=weight,
        height=height,
        strength=strength,
        route=payload.route,
        frequency=payload.frequency,
        clinical_parameters=payload.clinical_parameters
    )

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="POSOLOGY_CHECKED",
        details=f"Dose posology analyzed for {payload.drug_name} by {current_user.user_id}. Calculated BSA: {result.get('calculated_bsa')} m²"
    )

    return result
