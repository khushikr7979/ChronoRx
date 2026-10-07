import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False)  # DOC-1001, REC-1001, ADM-1001
    username = Column(String(50), unique=True, index=True, nullable=True)  # Mirror of user_id for backward compatibility
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="doctor", nullable=False)  # doctor, receptionist, admin, patient
    patient_id = Column(String(50), nullable=True, index=True)   # Linked patient profile ID (e.g. P-1001)
    profile_photo = Column(String(255), nullable=True, default=None)  # Secure relative path/URL to profile photo
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g., P-1024 or DEMO-1001
    
    # Identifying fields (PII - stored locally, NEVER transmitted to external AI or medical APIs)
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=True)

    # Clinical fields
    age = Column(Integer, nullable=False)
    weight = Column(Float, nullable=False)  # in kg
    height = Column(Float, nullable=False)  # in cm
    gender = Column(String(20), nullable=False)
    bsa = Column(Float, nullable=True)      # calculated DuBois Body Surface Area (m^2)
    bmi = Column(Float, nullable=True)      # calculated BMI (kg/m^2)

    medical_history = Column(Text, default="None reported")
    allergies = Column(Text, default="None known")
    existing_medications = Column(Text, default="None")

    # Consultation & Status Fields (Tier 1 & 2 Workflow)
    # Statuses: WAITING_FOR_DOCTOR, IN_CONSULTATION, ANALYSIS_COMPLETE, PENDING_REVIEW, APPROVED, PRESCRIPTION_GENERATED
    status = Column(String(50), default="WAITING_FOR_DOCTOR", index=True)
    diagnosis = Column(Text, default="")
    clinical_notes = Column(Text, default="")
    consultation_started_at = Column(DateTime, nullable=True)
    consultation_completed_at = Column(DateTime, nullable=True)

    created_by = Column(String(50), nullable=True, index=True)          # System User ID who created/registered (e.g. REC-1001)
    assigned_doctor_id = Column(String(50), nullable=True, index=True)  # System User ID of assigned clinician (e.g. DOC-1001)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(String(50), index=True, nullable=False)
    name = Column(String(150), nullable=False)
    generic_name = Column(String(150), nullable=True)
    strength = Column(String(50), default="Standard")
    route = Column(String(50), default="Oral")
    frequency = Column(String(100), default="Once daily")
    duration = Column(String(50), default="30 days")
    instructions = Column(Text, default="As directed by physician")
    category = Column(String(50), default="Allopathic")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(String(50), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    
    extracted_raw_text = Column(Text, default="")
    edited_text = Column(Text, default="")
    structured_data = Column(Text, default="{}")  # JSON string
    confidence_score = Column(Float, default=0.0)
    status = Column(String(30), default="uploaded")  # uploaded, ocr_completed, extracted, verified

    uploaded_by = Column(String(50), nullable=True, index=True) # System User ID of staff who uploaded scan
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PrescriptionReview(Base):
    __tablename__ = "prescription_reviews"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(String(50), index=True, nullable=False)
    scan_id = Column(String(50), nullable=True)
    
    doctor_id = Column(String(50), nullable=True, index=True) # System User ID of reviewing doctor (e.g. DOC-1001)
    doctor_name = Column(String(100), default="Authorized Clinician")
    
    diagnosis = Column(Text, default="")
    medications = Column(Text, default="[]")     # JSON string of confirmed medications
    interactions = Column(Text, default="[]")    # JSON string of drug interaction findings
    schedule = Column(Text, default="[]")        # JSON string of chronopharmacology timetable
    clinician_notes = Column(Text, default="")
    
    is_reviewed = Column(Boolean, default=False) # Mandatory clinician review flag
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    pdf_path = Column(String(255), nullable=True)
    delivery_status = Column(String(50), default="NOT_SENT") # NOT_SENT, SENT_WHATSAPP, SENT_SMS, UNCONFIGURED, FAILED
    delivery_details = Column(Text, default="")
    status = Column(String(30), default="ACTIVE", index=True) # ACTIVE, ARCHIVED, VOID, INCORRECT
    archived_at = Column(DateTime, nullable=True)
    archived_by = Column(String(50), nullable=True)
    archive_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PatientHistoryEntry(Base):
    __tablename__ = "patient_history_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. HIST-1001
    patient_id = Column(String(50), index=True, nullable=False)
    entry_type = Column(String(50), default="consultation") # consultation, diagnosis, clinical_note, medical_history, lab_result
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    doctor_id = Column(String(50), nullable=True, index=True)
    doctor_name = Column(String(100), nullable=True)
    is_finalized = Column(Boolean, default=False)
    status = Column(String(30), default="ACTIVE", index=True) # ACTIVE, ARCHIVED, VOID, INCORRECT
    archived_at = Column(DateTime, nullable=True)
    archived_by = Column(String(50), nullable=True)
    archive_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(50), index=True, nullable=True)
    user_id = Column(String(50), nullable=False, index=True) # System User ID (e.g. DOC-1001, REC-1001, ADM-1001)
    action = Column(String(100), nullable=False)
    details = Column(Text, default="")
    ip_address = Column(String(50), default="127.0.0.1")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class FollowUpSession(Base):
    __tablename__ = "followup_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. FUP-1001
    consultation_ref = Column(String(80), index=True, nullable=True) # Consultation / Review / Billing reference
    patient_id = Column(String(50), index=True, nullable=False)
    patient_name = Column(String(100), nullable=True)
    doctor_id = Column(String(50), index=True, nullable=False)
    doctor_name = Column(String(100), nullable=False)
    review_id = Column(String(50), index=True, nullable=True)
    diagnosis = Column(Text, default="")
    billing_reference = Column(String(80), nullable=True)
    billed_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    follow_up_expires_at = Column(DateTime, nullable=False)
    status = Column(String(30), default="ACTIVE", index=True) # ACTIVE, EXPIRED, CLOSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class FollowUpMessage(Base):
    __tablename__ = "followup_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. FMSG-1001
    session_id = Column(String(50), index=True, nullable=False)
    patient_id = Column(String(50), index=True, nullable=False)
    doctor_id = Column(String(50), index=True, nullable=True)
    sender_id = Column(String(50), nullable=False)
    sender_role = Column(String(20), nullable=False) # patient, doctor
    sender_name = Column(String(100), nullable=False)
    message_type = Column(String(30), default="QUESTION") # QUESTION, SIDE_EFFECT, DOCTOR_REPLY
    severity = Column(String(20), nullable=True) # MILD, MODERATE, SEVERE
    side_effect_severity = Column(String(20), nullable=True) # MILD, MODERATE, SEVERE
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. APT-1001
    patient_id = Column(String(50), index=True, nullable=False)
    patient_name = Column(String(100), nullable=True)
    doctor_id = Column(String(50), index=True, nullable=False)
    doctor_name = Column(String(100), nullable=False)
    department = Column(String(100), default="Internal Medicine & Chronopharmacology")
    appointment_date = Column(String(20), index=True, nullable=False) # YYYY-MM-DD
    time_slot = Column(String(30), index=True, nullable=False) # e.g. "10:00 AM"
    appointment_time = Column(String(30), nullable=True) # Alias/mirror of time_slot
    consultation_type = Column(String(30), default="IN_PERSON")
    reason = Column(Text, default="Scheduled Clinical Consultation")
    status = Column(String(30), default="BOOKED", index=True) # BOOKED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
    qr_token = Column(String(120), unique=True, index=True, nullable=False)
    qr_payload = Column(String(255), nullable=False)
    receipt_number = Column(String(50), unique=True, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    verified_by = Column(String(50), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(String(50), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_by = Column(String(50), nullable=False, default="SYSTEM")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)



