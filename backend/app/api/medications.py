import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Medication, Patient, User
from app.schemas.schemas import MedicationCreate, MedicationUpdate, MedicationResponse
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event

router = APIRouter(prefix="/medications", tags=["Medications"])

def generate_medication_id(db: Session) -> str:
    total = db.query(Medication).count()
    candidate_num = 1001 + total
    while True:
        candidate_id = f"MED-{candidate_num}"
        if not db.query(Medication).filter(Medication.medication_id == candidate_id).first():
            return candidate_id
        candidate_num += 1

@router.post("", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def create_medication(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """Adds a prescribed medication to a patient's active clinical profile."""
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {payload.patient_id} not found.")

    med_id = generate_medication_id(db)
    med = Medication(
        medication_id=med_id,
        patient_id=payload.patient_id,
        name=payload.name.strip(),
        generic_name=payload.generic_name.strip() if payload.generic_name else None,
        strength=payload.strength or "Standard",
        route=payload.route or "Oral",
        frequency=payload.frequency or "Once daily",
        duration=payload.duration or "30 days",
        instructions=payload.instructions or "As directed by physician",
        category=payload.category or "Allopathic",
        is_active=True
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="MEDICATION_ADDED",
        details=f"Medication {med.name} ({med.strength}) added by {current_user.user_id}."
    )
    return med

@router.get("/{patient_id}", response_model=List[MedicationResponse])
def get_patient_medications(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all prescribed medications for a given pseudo-anonymized Patient ID."""
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients may only access their own medications."
        )

    meds = db.query(Medication).filter(
        Medication.patient_id == patient_id,
        Medication.is_active == True
    ).order_by(Medication.created_at.desc()).all()
    return meds

@router.put("/{medication_id}", response_model=MedicationResponse)
def update_medication(
    medication_id: str,
    payload: MedicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """Updates an existing medication record (dosage, route, frequency, instructions)."""
    med = db.query(Medication).filter(Medication.medication_id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail=f"Medication {medication_id} not found.")

    update_data = payload.dict(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(med, field, val)

    db.commit()
    db.refresh(med)

    log_audit_event(
        db,
        patient_id=med.patient_id,
        user_id=current_user.user_id,
        action="MEDICATION_UPDATED",
        details=f"Medication {med.medication_id} updated by {current_user.user_id}."
    )
    return med

@router.delete("/{medication_id}")
def delete_medication(
    medication_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """Deletes / deactivates a medication from a patient profile."""
    med = db.query(Medication).filter(Medication.medication_id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail=f"Medication {medication_id} not found.")

    med.is_active = False
    db.commit()

    log_audit_event(
        db,
        patient_id=med.patient_id,
        user_id=current_user.user_id,
        action="MEDICATION_DELETED",
        details=f"Medication {med.medication_id} ({med.name}) discontinued/deleted by {current_user.user_id}."
    )
    return {"status": "deleted", "medication_id": medication_id}
