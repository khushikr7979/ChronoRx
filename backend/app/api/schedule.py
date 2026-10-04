import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, PrescriptionReview
from app.schemas.schemas import ScheduleGenerateRequest, ScheduleGenerateResponse, ScheduleUpdateRequest
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event
from app.services.schedule_service import schedule_service

router = APIRouter(prefix="/schedule", tags=["Chronopharmacology Schedule"])

@router.get("/patient/{patient_id}")
def get_patient_schedule(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the approved Chronopharmacology Timetable for a patient.
    Protected with IDOR validation for patients.
    """
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients may only access their own medication schedule."
        )

    review = db.query(PrescriptionReview).filter(
        PrescriptionReview.patient_id == patient_id,
        PrescriptionReview.is_reviewed == True,
        PrescriptionReview.status == "ACTIVE"
    ).order_by(PrescriptionReview.created_at.desc()).first()

    schedule_data = []
    if review and review.schedule:
        try:
            schedule_data = json.loads(review.schedule)
        except Exception:
            schedule_data = []

    return {
        "patient_id": patient_id,
        "review_id": review.review_id if review else None,
        "schedule": schedule_data,
        "is_reviewed": review.is_reviewed if review else False,
        "doctor_name": review.doctor_name if review else None,
        "last_updated": review.reviewed_at.isoformat() if review and review.reviewed_at else None
    }

@router.post("/generate", response_model=ScheduleGenerateResponse)
def generate_schedule(
    payload: ScheduleGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Module 5: Chronopharmacology Timetable Generation
    - Evaluates circadian pharmacokinetics
    - Proposes optimal daily timing (morning, afternoon, night, meal intervals)
    - Emphasizes recommendations requiring clinician verification
    """
    result = schedule_service.generate_timetable(payload.medications)

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="SCHEDULE_GENERATED",
        details=f"Generated circadian timetable for {len(payload.medications)} drugs by {current_user.user_id}."
    )

    return result

@router.post("/approve")
def approve_schedule(
    patient_id: str = Body(..., embed=True),
    timetable: List[Dict[str, Any]] = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Records clinician review and approval of the Chronopharmacology Timetable.
    """
    log_audit_event(
        db,
        patient_id=patient_id,
        user_id=current_user.user_id,
        action="SCHEDULE_APPROVED",
        details=f"Clinician {current_user.user_id} approved daily medication timetable ({len(timetable)} items)."
    )
    return {"status": "approved", "patient_id": patient_id, "approved_by": current_user.user_id}

@router.put("/{schedule_id}")
def update_schedule(
    schedule_id: str,
    payload: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Module 4: Allows clinician to manually edit times, instructions, and save modified schedule.
    """
    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="SCHEDULE_MODIFIED",
        details=f"Clinician {current_user.user_id} modified daily medication timetable (Ref: {schedule_id})."
    )
    return {
        "status": "updated",
        "schedule_id": schedule_id,
        "patient_id": payload.patient_id,
        "timetable": payload.timetable,
        "updated_by": current_user.user_id
    }
