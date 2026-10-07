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

    return _attach_consultation_context(patient, current_user.user_id)


def _attach_consultation_context(
    patient: Patient,
    fallback_doctor_id: Optional[str] = None,
    explicit_consultation_id: Optional[str] = None
) -> Patient:
    """
    Ensures safe non-null fields and attaches active consultation context identifiers
    (consultation_id, consultation_ref, doctor_id) onto the ORM instance for serialization.
    """
    if not patient.status:
        patient.status = "WAITING_FOR_DOCTOR"
    if patient.diagnosis is None:
        patient.diagnosis = ""
    if patient.clinical_notes is None:
        patient.clinical_notes = ""
    if not patient.created_at:
        patient.created_at = datetime.datetime.utcnow()

    ref_time = patient.consultation_started_at or patient.created_at
    ts_part = int(ref_time.timestamp()) if ref_time else 1001
    c_ref = explicit_consultation_id or f"CON-{patient.patient_id}-{ts_part}"

    patient.consultation_id = c_ref
    patient.consultation_ref = c_ref
    patient.doctor_id = patient.assigned_doctor_id or fallback_doctor_id
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
                Patient.assigned_doctor_id == "",
                Patient.created_by == current_user.user_id
            )
        )
    
    patients = query.order_by(Patient.id.desc()).all()
    return [_attach_consultation_context(p, current_user.user_id) for p in patients]

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
        return [_attach_consultation_context(p) for p in query.all()]

    # Doctors see patients assigned to them, unassigned patients, or patients they registered
    if current_user.role == "doctor":
        if my_only:
            query = query.filter(
                or_(
                    Patient.assigned_doctor_id == current_user.user_id,
                    Patient.created_by == current_user.user_id
                )
            )
        else:
            query = query.filter(
                or_(
                    Patient.assigned_doctor_id == current_user.user_id,
                    Patient.assigned_doctor_id == None,
                    Patient.assigned_doctor_id == "",
                    Patient.created_by == current_user.user_id
                )
            )
    elif my_only and current_user.role == "receptionist":
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
    return [_attach_consultation_context(p, current_user.user_id if current_user.role == "doctor" else None) for p in patients]

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
    return _attach_consultation_context(patient, current_user.user_id if current_user.role == "doctor" else None)

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
    Saves primary clinical diagnosis and consultation notes, enforces RBAC and doctor ownership,
    and returns the active consultation context for Step 2 (Medicines & Posology).
    """
    # 1. RBAC: Patients cannot modify clinical status or diagnosis
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients cannot modify clinical consultation status."
        )

    new_status = (payload.status or "IN_CONSULTATION").strip().upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(VALID_STATUSES)}"
        )

    # 2. Verify patient exists
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID '{patient_id}' not found")

    # 3. RBAC: Receptionist cannot transition into clinical consultation or approve prescription
    if current_user.role == "receptionist" and new_status in ["IN_CONSULTATION", "ANALYSIS_COMPLETE", "PENDING_REVIEW", "APPROVED", "PRESCRIPTION_GENERATED"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: Receptionist cannot transition patient into clinical status '{new_status}'."
        )

    # 4. Doctor Authorization & Patient Ownership check
    if current_user.role == "doctor":
        if payload.doctor_id and payload.doctor_id.strip() and payload.doctor_id.strip().upper() != current_user.user_id.upper():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Doctor ID mismatch with authenticated clinician."
            )
        if (
            patient.assigned_doctor_id
            and patient.assigned_doctor_id.strip() != ""
            and patient.assigned_doctor_id.strip().upper() != current_user.user_id.upper()
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Patient {patient_id} is assigned to clinician {patient.assigned_doctor_id}. Unauthorized doctor cannot modify this consultation."
            )

    # 5. Resolve diagnosis and consultation notes fields (supporting aliases)
    raw_diagnosis = payload.diagnosis if payload.diagnosis is not None else payload.primary_diagnosis
    raw_notes = (
        payload.clinical_notes
        if payload.clinical_notes is not None
        else (payload.consultation_notes if payload.consultation_notes is not None else payload.notes)
    )

    # 6. Validate required diagnosis when saving Step 1 consultation (unless open_only=True)
    if new_status == "IN_CONSULTATION" and not payload.open_only:
        clean_diagnosis = (raw_diagnosis or "").strip()
        if not clean_diagnosis:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Primary clinical diagnosis is required before proceeding to medicines."
            )

    old_status = patient.status
    patient.status = new_status
    now_utc = datetime.datetime.utcnow()

    audit_events = []

    # 7. Handle consultation start and doctor assignment
    if new_status == "IN_CONSULTATION":
        if not patient.consultation_started_at:
            patient.consultation_started_at = now_utc
        if current_user.role == "doctor" and not patient.assigned_doctor_id:
            patient.assigned_doctor_id = current_user.user_id
        if old_status != "IN_CONSULTATION":
            audit_events.append((
                "DOCTOR_OPENED_PATIENT",
                f"Doctor {current_user.user_id} ({current_user.full_name}) opened patient {patient_id} for consultation."
            ))

    # 8. Persist diagnosis if provided
    if raw_diagnosis is not None and raw_diagnosis.strip():
        patient.diagnosis = raw_diagnosis.strip()
        audit_events.append((
            "DIAGNOSIS_ENTERED",
            f"Primary diagnosis entered for patient {patient_id}: {patient.diagnosis}"
        ))

    # 9. Persist clinical notes if provided
    if raw_notes is not None:
        patient.clinical_notes = raw_notes.strip()
        if patient.clinical_notes or not payload.open_only:
            audit_events.append((
                "CLINICAL_NOTES_ENTERED",
                f"Clinical symptoms/notes recorded for patient {patient_id}."
            ))

    if new_status == "APPROVED":
        audit_events.append((
            "SCHEDULE_APPROVED",
            f"Clinician {current_user.user_id} approved medication timetable and clinical orders."
        ))

    if new_status == "PRESCRIPTION_GENERATED":
        patient.consultation_completed_at = now_utc

    patient.updated_at = now_utc
    if not patient.created_at:
        patient.created_at = now_utc

    # Commit patient update atomically
    db.commit()
    db.refresh(patient)

    # Record audit events
    for action_name, action_details in audit_events:
        log_audit_event(
            db,
            patient_id=patient_id,
            user_id=current_user.user_id,
            action=action_name,
            details=action_details
        )

    return _attach_consultation_context(
        patient,
        fallback_doctor_id=current_user.user_id if current_user.role == "doctor" else None,
        explicit_consultation_id=payload.consultation_id
    )

