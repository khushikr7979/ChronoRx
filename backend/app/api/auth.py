import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import User, Patient
from app.schemas.schemas import UserLogin, UserCreate, UserResponse, Token, DepartmentUpdateRequest
from app.security.auth_handler import verify_password, get_password_hash, create_access_token, get_current_user
from app.security.anonymizer import generate_user_id, generate_patient_id, log_audit_event
from app.services.dose_service import calculate_dubois_bsa, calculate_bmi
from app.services.department_service import validate_department, normalize_department

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user (Doctor, Receptionist, Administrator, or Patient).
    - Checks email uniqueness with clear error message.
    - Generates a unique, standardized System User ID (DOC-1001, REC-1001, ADM-1001, PAT-1001).
    - For Patient role, links to an existing Patient profile or initializes one securely.
    - Securely hashes password before storing.
    """
    # 1. Validate role
    role_norm = user_in.role.strip().lower()
    if role_norm not in ["doctor", "receptionist", "admin", "patient"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid role specified. Allowed roles are: doctor, receptionist, admin, patient"
        )

    # 2. Check for duplicate email (strictly case-insensitive)
    clean_email = user_in.email.strip().lower()
    existing_email = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered. Please sign in or use another email."
        )

    # 3. Handle patient profile linking if role is patient
    assigned_patient_id = None
    if role_norm == "patient":
        if user_in.patient_id:
            pid = user_in.patient_id.strip()
            existing_p = db.query(Patient).filter(Patient.patient_id == pid).first()
            if not existing_p:
                raise HTTPException(status_code=404, detail=f"Patient profile '{pid}' not found.")
            existing_user_linked = db.query(User).filter(User.patient_id == pid).first()
            if existing_user_linked:
                raise HTTPException(status_code=400, detail="This patient profile is already registered to a user account.")
            assigned_patient_id = pid
        else:
            # Auto-create new Patient profile
            new_pid = generate_patient_id(db)
            pat = Patient(
                patient_id=new_pid,
                name=user_in.full_name.strip(),
                age=30,
                weight=70.0,
                height=170.0,
                gender="Unspecified",
                bsa=calculate_dubois_bsa(70.0, 170.0),
                bmi=calculate_bmi(70.0, 170.0),
                medical_history="None reported",
                allergies="None known",
                existing_medications="None",
                status="WAITING_FOR_DOCTOR"
            )
            db.add(pat)
            db.commit()
            db.refresh(pat)
            assigned_patient_id = new_pid

    # 4. Handle and validate department assignment
    assigned_dept = None
    if user_in.department and user_in.department.strip():
        is_valid_dept, canonical_dept, _ = validate_department(user_in.department)
        if not is_valid_dept:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid department '{user_in.department}'. Must match one of the 29 approved hospital departments."
            )
        assigned_dept = canonical_dept
    elif role_norm == "doctor":
        # Default department for doctors if unspecified
        assigned_dept = "General Medicine (Internal Medicine)"

    # 5. Automatically generate unique, sequential role-prefixed System User ID
    assigned_user_id = generate_user_id(db, role_norm)

    # 6. Securely store user
    user = User(
        user_id=assigned_user_id,
        username=assigned_user_id,  # System ID acts as primary handle
        email=clean_email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        role=role_norm,
        department=assigned_dept,
        patient_id=assigned_patient_id,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 6. Record audit trail
    log_audit_event(
        db,
        patient_id=assigned_patient_id,
        user_id=user.user_id,
        action="USER_REGISTERED",
        details=f"New {user.role.capitalize()} registered: {user.full_name} assigned System ID {user.user_id}" + (f" (Linked Patient: {assigned_patient_id})" if assigned_patient_id else "")
    )

    return user

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user using either their Email, System User ID (e.g. DOC-1001, PAT-1001), or Patient ID (e.g. P-1001).
    """
    identifier = (login_data.identifier or login_data.username or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Please provide your Email, System User ID, or Patient ID."
        )

    # Search by email (case-insensitive) OR user_id (case-insensitive) OR username OR patient_id
    user = db.query(User).filter(
        (func.lower(User.email) == identifier.lower()) |
        (func.upper(User.user_id) == identifier.upper()) |
        (func.lower(User.username) == identifier.lower()) |
        (func.upper(User.patient_id) == identifier.upper())
    ).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your Email or System User ID and password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User account is deactivated. Please contact the system administrator."
        )

    token = create_access_token(data={
        "sub": user.user_id,
        "role": user.role,
        "email": user.email,
        "name": user.full_name,
        "patient_id": user.patient_id
    })

    log_audit_event(
        db,
        patient_id=user.patient_id,
        user_id=user.user_id,
        action="USER_LOGIN",
        details=f"{user.role.capitalize()} {user.full_name} ({user.user_id}) logged in"
    )

    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns profile for currently authenticated user."""
    return current_user

@router.get("/staff", response_model=List[UserResponse])
def get_staff_directory(
    role: Optional[str] = Query(None, description="Filter by role: doctor, receptionist, admin"),
    department: Optional[str] = Query(None, description="Filter by hospital department name or ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves registered staff members and their System IDs.
    - Administrators can view all staff across all roles.
    - Doctors & Receptionists can view all Clinicians (e.g. for patient assignment).
    - Can be filtered by role and/or clinical department.
    """
    query = db.query(User)
    if current_user.role != "admin":
        query = query.filter(User.role == "doctor")
    elif role:
        query = query.filter(User.role == role.lower())

    if department and department.strip():
        norm = normalize_department(department)
        if norm:
            query = query.filter(func.lower(User.department) == norm.lower())
        else:
            query = query.filter(User.department.ilike(f"%{department.strip()}%"))

    return query.order_by(User.id.asc()).all()


@router.patch("/staff/{user_id}/department", response_model=UserResponse)
def update_staff_department(
    user_id: str,
    payload: DepartmentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin-only endpoint to update or reassign a staff member's department.
    Enforces RBAC and approved department validation.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Administrator privileges required to reassign staff departments."
        )

    is_valid, canonical_name, _ = validate_department(payload.department)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid department '{payload.department}'. Must match one of the 29 approved hospital departments."
        )

    target_user = db.query(User).filter(
        (User.user_id == user_id.strip()) | (User.user_id == user_id.strip().upper())
    ).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")

    prev_dept = target_user.department
    target_user.department = canonical_name
    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db,
        patient_id=target_user.patient_id,
        user_id=current_user.user_id,
        action="STAFF_DEPARTMENT_UPDATED",
        details=f"Admin {current_user.user_id} updated department for {target_user.user_id} ({target_user.full_name}) from '{prev_dept}' to '{canonical_name}'."
    )

    return target_user
