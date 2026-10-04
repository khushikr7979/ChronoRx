import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.models import PatientHistoryEntry, PrescriptionReview, Patient, User
from app.schemas.schemas import (
    PatientHistoryCreate,
    PatientHistoryResponse,
    PatientHistoryArchiveRequest
)
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event

router = APIRouter(prefix="/patient-history", tags=["Patient History Management"])

def generate_history_id(db: Session) -> str:
    total = db.query(PatientHistoryEntry).count()
    candidate_num = 1001 + total
    while True:
        candidate_id = f"HIST-{candidate_num}"
        if not db.query(PatientHistoryEntry).filter(PatientHistoryEntry.entry_id == candidate_id).first():
            return candidate_id
        candidate_num += 1

@router.get("/{patient_id}", response_model=List[PatientHistoryResponse])
def get_patient_history(
    patient_id: str,
    include_archived: bool = Query(False, description="Whether to include archived/void entries"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves clinical history entries for a given patient.
    By default, returns only ACTIVE records.
    Authorized users can inspect archived records by setting include_archived=true.
    """
    if current_user.role == "patient":
        if current_user.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only access their own medical history."
            )
        include_archived = False

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")

    query = db.query(PatientHistoryEntry).filter(PatientHistoryEntry.patient_id == patient_id)
    if not include_archived:
        query = query.filter(PatientHistoryEntry.status == "ACTIVE")

    entries = query.order_by(PatientHistoryEntry.created_at.desc()).all()
    return entries

@router.post("", response_model=PatientHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_patient_history_entry(
    payload: PatientHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"]))
):
    """Creates a new patient clinical history entry."""
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {payload.patient_id} not found.")

    entry_id = generate_history_id(db)
    doc_id = current_user.user_id if current_user.role == "doctor" else None
    doc_name = payload.doctor_name or (current_user.full_name if current_user.role == "doctor" else "Attending Clinician")

    entry = PatientHistoryEntry(
        entry_id=entry_id,
        patient_id=payload.patient_id,
        entry_type=payload.entry_type,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        doctor_id=doc_id,
        doctor_name=doc_name,
        is_finalized=payload.is_finalized,
        status="ACTIVE"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="PATIENT_HISTORY_CREATED",
        details=f"History entry {entry_id} ('{entry.title}') created by {current_user.user_id}."
    )
    return entry

@router.patch("/{entry_id}/archive", response_model=PatientHistoryResponse)
def archive_patient_history_entry(
    entry_id: str,
    payload: PatientHistoryArchiveRequest,
    patient_id: Optional[str] = Query(None, description="Optional patient_id for ownership and IDOR validation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Controlled History Archive / Void:
    - Verifies entry exists
    - Enforces IDOR security: if patient_id is provided, validates relationship
    - Finalized clinical records are NEVER hard-deleted; marked ARCHIVED or VOID
    - Patient record itself is NEVER deleted
    - Stores archive reason, timestamp, and user ID
    - Logs audit event: PATIENT_HISTORY_ARCHIVED or PATIENT_HISTORY_VOIDED
    """
    entry = db.query(PatientHistoryEntry).filter(PatientHistoryEntry.entry_id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"History entry {entry_id} not found.")

    # IDOR Security Check
    if patient_id and entry.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IDOR violation: history entry does not belong to the specified patient."
        )

    target_status = payload.target_status.upper()
    if target_status not in ["ARCHIVED", "VOID", "INCORRECT"]:
        target_status = "ARCHIVED"

    entry.status = target_status
    entry.archived_at = datetime.datetime.utcnow()
    entry.archived_by = current_user.user_id
    entry.archive_reason = payload.reason.strip()
    db.commit()
    db.refresh(entry)

    action_name = "PATIENT_HISTORY_VOIDED" if target_status == "VOID" else "PATIENT_HISTORY_ARCHIVED"
    log_audit_event(
        db,
        patient_id=entry.patient_id,
        user_id=current_user.user_id,
        action=action_name,
        details=f"History entry {entry_id} ('{entry.title}') set to {target_status} by {current_user.user_id}. Reason: {payload.reason}"
    )

    return entry

@router.delete("/{entry_id}")
def delete_patient_history_entry(
    entry_id: str,
    reason: Optional[str] = Query("Draft removed", description="Reason for deletion"),
    patient_id: Optional[str] = Query(None, description="Optional patient_id for IDOR validation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Deletes an unfinalized/draft history entry.
    CRITICAL: If the entry is finalized, hard deletion is prohibited and client
    must use the archive endpoint instead.
    """
    entry = db.query(PatientHistoryEntry).filter(PatientHistoryEntry.entry_id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"History entry {entry_id} not found.")

    if patient_id and entry.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IDOR violation: history entry does not belong to the specified patient."
        )

    if entry.is_finalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Finalized clinical records cannot be permanently deleted. Please use the archive/void endpoint to preserve clinical auditability."
        )

    p_id = entry.patient_id
    title = entry.title
    db.delete(entry)
    db.commit()

    log_audit_event(
        db,
        patient_id=p_id,
        user_id=current_user.user_id,
        action="PATIENT_HISTORY_DELETED",
        details=f"Draft history entry {entry_id} ('{title}') deleted by {current_user.user_id}. Reason: {reason}"
    )

    return {
        "status": "deleted",
        "entry_id": entry_id,
        "patient_id": p_id,
        "message": "Draft history entry deleted successfully. Patient record preserved."
    }
