import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.database import get_db
from app.models.models import Patient, User
from app.schemas.schemas import PatientCreate, PatientResponse, PatientStatusUpdate
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import generate_patient_id, log_audit_event
from app.services.dose_service import calculate_dubois_bsa, calculate_bmi

router = APIRouter(prefix="/patients", tags=["Patients"])

VALID_STATUSES = {
    "WAITING_FOR_DOCTOR",
    "IN_CONSULTATION",
    "ANALYSIS_COMPLETE",
    "PENDING_REVIEW",
    "APPROVED",
    "PRESCRIPTION_GENERATED"
}

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"]))
):
    """
    Tier 1: Receptionist / Front Desk Patient Registration
    - Validates form
    - Generates unique standardized Patient_ID (e.g., P-1024)
    - Calculates DuBois BSA and BMI
    - Stores identifying PII securely in isolated record
    - Automatically sets status to WAITING_FOR_DOCTOR
    - Adds patient to Doctor Queue
    - Associates record with creator's System User ID (e.g. REC-1001)
    """
    new_patient_id = generate_patient_id(db)

    bsa_val = calculate_dubois_bsa(patient_in.weight, patient_in.height)
    bmi_val = calculate_bmi(patient_in.weight, patient_in.height)

    # Determine assigned doctor
    assigned_doc = patient_in.assigned_doctor_id
    if not assigned_doc and current_user.role == "doctor":
        assigned_doc = current_user.user_id

    patient = Patient(
        patient_id=new_patient_id,
        name=patient_in.name,
        phone=patient_in.phone,
        age=patient_in.age,
        weight=patient_in.weight,
        height=patient_in.height,
        gender=patient_in.gender,
        bsa=bsa_val,
        bmi=bmi_val,
        medical_history=patient_in.medical_history or "None reported",
        allergies=patient_in.allergies or "None known",
        existing_medications=patient_in.existing_medications or "None",
        status="WAITING_FOR_DOCTOR",
        diagnosis=patient_in.diagnosis or "",
        clinical_notes=patient_in.clinical_notes or "",
        created_by=current_user.user_id,
        assigned_doctor_id=assigned_doc
    )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Audit events
    log_audit_event(
        db,
        patient_id=patient.patient_id,
        user_id=current_user.user_id,
        action="PATIENT_REGISTERED",
        details=f"Patient {patient.patient_id} registered by {current_user.user_id}."
    )
    log_audit_event(
        db,
        patient_id=patient.patient_id,
        user_id=current_user.user_id,
        action="PATIENT_ASSIGNED_TO_QUEUE",
        details=f"Patient {patient.patient_id} entered Doctor Queue with status WAITING_FOR_DOCTOR."
    )

    return patient

@router.get("/queue", response_model=List[PatientResponse])
def get_doctor_queue(
    status_filter: Optional[str] = Query(None, description="Filter queue by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tier 2: Doctor Patient Queue
    Retrieves active clinical queue sorted by registration urgency.
    """
    # Patient role cannot view doctor queue
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients cannot access clinical queue."
        )

    query = db.query(Patient)
    if status_filter:
        query = query.filter(Patient.status == status_filter.upper())
    
    # Non-admins: doctors see patients assigned to them or unassigned waiting patients
    if current_user.role == "doctor":
        query = query.filter(
            or_(
                Patient.assigned_doctor_id == current_user.user_id,
                Patient.assigned_doctor_id == None,
                Patient.status.in_(["WAITING_FOR_DOCTOR", "IN_CONSULTATION", "PENDING_REVIEW"])
            )
        )
    
    return query.order_by(Patient.id.desc()).all()

@router.get("", response_model=List[PatientResponse])
def list_patients(
    skip: int = 0,
    limit: int = 100,
    my_only: bool = Query(False, description="Filter only to patients created by or assigned to current user"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search by Patient ID or Name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Patient)

    # Patients can ONLY ever see their own profile
    if current_user.role == "patient":
        query = query.filter(Patient.patient_id == current_user.patient_id)
        return query.all()

    if my_only:
        if current_user.role == "doctor":
            query = query.filter(
                or_(
                    Patient.assigned_doctor_id == current_user.user_id,
                    Patient.created_by == current_user.user_id
                )
            )
        elif current_user.role == "receptionist":
            query = query.filter(Patient.created_by == current_user.user_id)

    if status_filter:
        query = query.filter(Patient.status == status_filter.upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Patient.patient_id.ilike(s),
                Patient.name.ilike(s)
            )
        )

    patients = query.order_by(Patient.id.desc()).offset(skip).limit(limit).all()
    return patients

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # IDOR protection for Patient role
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients can only access their own profile."
        )

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID '{patient_id}' not found")
    
    log_audit_event(
        db,
        patient_id=patient_id,
        user_id=current_user.user_id,
        action="PATIENT_ACCESSED",
        details=f"Clinical demographics accessed for patient {patient_id} by {current_user.user_id}"
    )
    return patient

@router.put("/{patient_id}/status", response_model=PatientResponse)
def update_patient_status(
    patient_id: str,
    payload: PatientStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tier 2 Doctor Consultation Status Transition:
    WAITING_FOR_DOCTOR -> IN_CONSULTATION -> ANALYSIS_COMPLETE -> PENDING_REVIEW -> APPROVED -> PRESCRIPTION_GENERATED
    Also updates clinical notes and primary diagnosis.
    """
    # Patients cannot modify clinical status
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients cannot modify clinical consultation status."
        )
    new_status = payload.status.upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(VALID_STATUSES)}"
        )

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID '{patient_id}' not found")

    # Receptionist cannot transition into clinical consultation or approve prescription
    if current_user.role == "receptionist" and new_status in ["IN_CONSULTATION", "ANALYSIS_COMPLETE", "APPROVED", "PRESCRIPTION_GENERATED"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: Receptionist cannot transition patient into clinical status '{new_status}'."
        )

    old_status = patient.status
    patient.status = new_status

    # If doctor opens patient for consultation
    if new_status == "IN_CONSULTATION" and old_status != "IN_CONSULTATION":
        if not patient.consultation_started_at:
            patient.consultation_started_at = datetime.datetime.utcnow()
        if current_user.role == "doctor":
            patient.assigned_doctor_id = current_user.user_id
        log_audit_event(
            db,
            patient_id=patient_id,
            user_id=current_user.user_id,
            action="DOCTOR_OPENED_PATIENT",
            details=f"Doctor {current_user.user_id} ({current_user.full_name}) opened patient {patient_id} for consultation."
        )

    # Update diagnosis if provided
    if payload.diagnosis is not None and payload.diagnosis.strip():
        patient.diagnosis = payload.diagnosis.strip()
        log_audit_event(
            db,
            patient_id=patient_id,
            user_id=current_user.user_id,
            action="DIAGNOSIS_ENTERED",
            details=f"Primary diagnosis entered for patient {patient_id}."
        )

    # Update clinical notes if provided
    if payload.clinical_notes is not None:
        patient.clinical_notes = payload.clinical_notes.strip()
        log_audit_event(
            db,
            patient_id=patient_id,
            user_id=current_user.user_id,
            action="CLINICAL_NOTES_ENTERED",
            details=f"Clinical symptoms/notes recorded for patient {patient_id}."
        )

    if new_status == "APPROVED":
        log_audit_event(
            db,
            patient_id=patient_id,
            user_id=current_user.user_id,
            action="SCHEDULE_APPROVED",
            details=f"Clinician {current_user.user_id} approved medication timetable and clinical orders."
        )

    if new_status == "PRESCRIPTION_GENERATED":
        patient.consultation_completed_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(patient)
    return patient
