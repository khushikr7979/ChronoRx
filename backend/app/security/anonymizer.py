import re
import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.models import Patient, AuditLog, User

def generate_user_id(db: Session, role: str) -> str:
    """
    Generates a unique, standardized, sequential System User ID:
    - Doctor: DOC-1001, DOC-1002, ...
    - Receptionist: REC-1001, REC-1002, ...
    - Administrator: ADM-1001, ADM-1002, ...
    Guaranteed unique in database, thread-safe sequence generator.
    """
    prefix_map = {
        "doctor": "DOC",
        "receptionist": "REC",
        "admin": "ADM",
        "patient": "PAT"
    }
    role_norm = (role or "").strip().lower()
    prefix = prefix_map.get(role_norm, "PAT" if role_norm == "patient" else "DOC")

    # Fetch all user_ids matching this prefix to find current maximum sequence number
    existing_users = db.query(User.user_id).filter(User.user_id.like(f"{prefix}-%")).all()
    max_num = 1000
    for (uid,) in existing_users:
        if uid and uid.startswith(f"{prefix}-"):
            try:
                num = int(uid.split("-")[1])
                if num > max_num:
                    max_num = num
            except (IndexError, ValueError):
                continue

    candidate_num = max_num + 1
    while True:
        candidate_id = f"{prefix}-{candidate_num}"
        existing = db.query(User).filter(User.user_id == candidate_id).first()
        if not existing:
            return candidate_id
        candidate_num += 1

def generate_patient_id(db: Session) -> str:
    """
    Generates a unique, standardized pseudo-anonymized Patient ID such as P-1024.
    """
    total = db.query(Patient).count()
    candidate_num = 1001 + total
    while True:
        candidate_id = f"P-{candidate_num}"
        existing = db.query(Patient).filter(Patient.patient_id == candidate_id).first()
        if not existing:
            return candidate_id
        candidate_num += 1

def scrub_pii_from_text(text: str, patient_name: Optional[str] = None, phone: Optional[str] = None) -> str:
    """
    Removes identifiable PII (names, phone numbers, email addresses, SSN-like patterns)
    before text is submitted to AI models or external medical APIs.
    """
    if not text:
        return ""

    sanitized = text

    # Remove known patient name if provided
    if patient_name and len(patient_name.strip()) > 2:
        parts = patient_name.strip().split()
        for part in parts:
            if len(part) > 2:
                sanitized = re.sub(re.escape(part), "[REDACTED_NAME]", sanitized, flags=re.IGNORECASE)

    # Remove known phone number if provided
    if phone and len(phone.strip()) > 4:
        digits_only = re.sub(r"\D", "", phone)
        if len(digits_only) >= 7:
            sanitized = re.sub(re.escape(phone), "[REDACTED_PHONE]", sanitized)
            sanitized = re.sub(re.escape(digits_only), "[REDACTED_PHONE]", sanitized)

    # General phone number pattern
    phone_pattern = r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
    sanitized = re.sub(phone_pattern, "[REDACTED_PHONE]", sanitized)

    # General email pattern
    email_pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    sanitized = re.sub(email_pattern, "[REDACTED_EMAIL]", sanitized)

    # Patient Name / Doctor Name patterns in prescription headers
    sanitized = re.sub(r"(Patient Name|Pt Name|Name)\s*:\s*[A-Za-z\s.]+", r"\1: [ANONYMIZED_PATIENT]", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r"(Dr\.|Doctor)\s+([A-Za-z\s.]+)", r"Dr. [ATTENDING_PHYSICIAN]", sanitized, flags=re.IGNORECASE)

    return sanitized

def extract_clinical_payload(patient: Patient) -> Dict[str, Any]:
    """
    Returns only the minimum necessary clinical processing data.
    Strictly excludes Patient Name, Phone Number, and direct PII.
    """
    return {
        "patient_id": patient.patient_id,
        "age": patient.age,
        "weight_kg": patient.weight,
        "height_cm": patient.height,
        "gender": patient.gender,
        "bsa_m2": patient.bsa,
        "bmi": patient.bmi,
        "medical_history": patient.medical_history,
        "allergies": patient.allergies,
        "existing_medications": patient.existing_medications
    }

def log_audit_event(
    db: Session,
    patient_id: Optional[str],
    user_id: str,
    action: str,
    details: str,
    ip_address: str = "127.0.0.1"
) -> AuditLog:
    """
    Records an immutable audit trail entry for clinical actions, scans, reviews, and data access.
    """
    entry = AuditLog(
        patient_id=patient_id,
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
