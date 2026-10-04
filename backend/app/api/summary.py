from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Patient, User
from app.schemas.schemas import ClinicalSummaryRequest, ClinicalSummaryResponse
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event, extract_clinical_payload
from app.services.ai_service import ai_service

router = APIRouter(prefix="/clinical-summary", tags=["Clinical Summary"])

@router.post("/generate", response_model=ClinicalSummaryResponse)
def generate_clinical_summary(
    payload: ClinicalSummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Module 6: AI Clinical Report Generator
    Synthesizes clinical vitals, confirmed medications, interaction warnings,
    and chronopharmacology schedules into a structured clinical summary.
    """
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        patient_data = {
            "age": "N/A", "weight": "N/A", "height": "N/A", "gender": "N/A",
            "bsa": "N/A", "bmi": "N/A", "allergies": "None known", "medical_history": "None"
        }
    else:
        # Extract clinical payload (strictly excludes Name and Phone PII)
        raw_payload = extract_clinical_payload(patient)
        patient_data = {
            "age": raw_payload["age"],
            "weight": raw_payload["weight_kg"],
            "height": raw_payload["height_cm"],
            "gender": raw_payload["gender"],
            "bsa": raw_payload["bsa_m2"],
            "bmi": raw_payload["bmi"],
            "allergies": raw_payload["allergies"],
            "medical_history": raw_payload["medical_history"]
        }

    summary_result = ai_service.generate_clinical_summary(
        patient_id=payload.patient_id,
        patient_data=patient_data,
        confirmed_medications=payload.confirmed_medications,
        interaction_alerts=payload.interaction_alerts or [],
        timetable=payload.timetable or [],
        clinician_notes=payload.clinician_notes
    )

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.username,
        action="CLINICAL_SUMMARY_GENERATED",
        details=f"Clinical summary compiled for {payload.patient_id} with {len(payload.confirmed_medications)} verified medications."
    )

    return summary_result
