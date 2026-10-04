from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr
import datetime

# --- Auth Schemas ---
class UserLogin(BaseModel):
    identifier: Optional[str] = Field(None, description="Email or System User ID (e.g. DOC-1001, REC-1001, ADM-1001)")
    username: Optional[str] = Field(None, description="Fallback identifier")
    password: str

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, description="User full legal name")
    email: EmailStr = Field(..., description="User official unique email address")
    password: str = Field(..., min_length=4, description="Secure password")
    role: str = Field(..., description="Role: doctor, receptionist, admin, or patient")
    username: Optional[str] = None
    patient_id: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    user_id: str
    username: Optional[str] = None
    email: str
    full_name: str
    role: str
    patient_id: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    sub: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    patient_id: Optional[str] = None

# --- Patient Schemas ---
class PatientCreate(BaseModel):
    name: str = Field(..., description="Patient full name (PII, stored securely)")
    phone: Optional[str] = Field(None, description="Patient contact number (PII)")
    age: int = Field(..., gt=0, lt=130)
    weight: float = Field(..., gt=0, lt=500, description="Weight in kg")
    height: float = Field(..., gt=0, lt=300, description="Height in cm")
    gender: str = Field(..., description="Male, Female, or Other")
    medical_history: Optional[str] = "None reported"
    allergies: Optional[str] = "None known"
    existing_medications: Optional[str] = "None"
    assigned_doctor_id: Optional[str] = Field(None, description="Assigned Clinician System ID (e.g. DOC-1001)")
    status: Optional[str] = "WAITING_FOR_DOCTOR"
    diagnosis: Optional[str] = ""
    clinical_notes: Optional[str] = ""

class PatientResponse(BaseModel):
    id: int
    patient_id: str
    name: str
    phone: Optional[str] = None
    age: int
    weight: float
    height: float
    gender: str
    bsa: Optional[float] = None
    bmi: Optional[float] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    existing_medications: Optional[str] = None
    created_by: Optional[str] = None
    assigned_doctor_id: Optional[str] = None
    status: str = "WAITING_FOR_DOCTOR"
    diagnosis: Optional[str] = ""
    clinical_notes: Optional[str] = ""
    consultation_started_at: Optional[datetime.datetime] = None
    consultation_completed_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class PatientStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: WAITING_FOR_DOCTOR, IN_CONSULTATION, ANALYSIS_COMPLETE, PENDING_REVIEW, APPROVED, PRESCRIPTION_GENERATED")
    diagnosis: Optional[str] = None
    clinical_notes: Optional[str] = None

# --- OCR & Scanning Schemas ---
class PreprocessOptions(BaseModel):
    crop: bool = False
    rotate_deg: int = 0
    enhance_contrast: bool = True
    denoise: bool = True

class OCRRequest(BaseModel):
    scan_id: str
    options: Optional[PreprocessOptions] = None

class OCRResponse(BaseModel):
    scan_id: str
    patient_id: str
    raw_text: str
    confidence_score: Optional[float] = None
    status: str
    source_engine: str
    error_message: Optional[str] = None
    timestamp: str

class ExtractedMedicine(BaseModel):
    raw_name: str
    normalized_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_text: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = "Oral"
    duration: Optional[str] = None
    confidence: float = 0.85
    needs_manual_review: bool = False

class ExtractRequest(BaseModel):
    scan_id: str
    patient_id: str
    edited_text: Optional[str] = None

class StructuredExtractionResponse(BaseModel):
    patient_id_if_visible: Optional[str] = None
    patient_name_if_visible: Optional[str] = None
    patient_age_if_visible: Optional[str] = None
    patient_weight_if_visible: Optional[str] = None
    patient_gender_if_visible: Optional[str] = None
    date_if_visible: Optional[str] = None
    doctor_name_if_visible: Optional[str] = None
    medicines: List[ExtractedMedicine] = []
    investigations: List[str] = []
    instructions: List[str] = []
    allergies_if_visible: List[str] = []
    warnings: List[str] = []
    disclaimer: str = "AI-assisted reference information — verify with an authorized healthcare professional."

# --- Drug Normalization & Reference Schemas ---
class DrugNormalizeRequest(BaseModel):
    drug_names: List[str]

class NormalizedDrugResult(BaseModel):
    query_name: str
    matched_name: str
    rxcui: Optional[str] = None
    confidence: float
    active_ingredients: List[str] = []
    dosage_form: Optional[str] = None
    status: str = "identified"  # identified, manual_verification_required
    requires_manual_verification: bool = False
    source: str = "RxNorm/RxNav API (NIH)"

class DrugReferenceRequest(BaseModel):
    drug_name: str
    rxcui: Optional[str] = None

class DrugReferenceResponse(BaseModel):
    drug_name: str
    rxcui: Optional[str] = None
    brand_names: List[str] = []
    generic_names: List[str] = []
    indications: str
    dosage_and_administration: str
    boxed_warning: Optional[str] = None
    warnings_and_precautions: str
    contraindications: str
    adverse_reactions: Optional[str] = None
    drug_interactions_summary: Optional[str] = None
    source: str
    retrieval_timestamp: str

# --- Dose / Posology Schemas ---
class DoseAnalyzeRequest(BaseModel):
    patient_id: Optional[str] = None
    drug_name: str
    strength: Optional[str] = None
    dosage: Optional[str] = None
    age: Optional[int] = 50
    weight: Optional[float] = 70.0
    height: Optional[float] = 170.0
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    bsa: Optional[float] = None
    route: Optional[str] = "Oral"
    frequency: Optional[str] = "Once daily"
    clinical_parameters: Optional[Dict[str, Any]] = None

class DoseAnalyzeResponse(BaseModel):
    drug: str
    normalized_name: str
    rxcui: Optional[str] = None
    available_strength: Optional[str] = None
    calculated_bsa: float
    bsa_formula: str = "DuBois: BSA = 0.007184 * W^0.425 * H^0.725"
    calculated_bmi: float
    reference_dosing_info: str
    calculation_details: str
    warnings: List[str] = []
    source: str
    verification_status: str = "Pending Clinician Review"
    clinician_reviewed: bool = False
    disclaimer: str = "AI-assisted reference information — verify with an authorized healthcare professional."

# --- Interaction Schemas ---
class InteractionCheckRequest(BaseModel):
    patient_id: Optional[str] = None
    drugs: Optional[List[str]] = None
    drug_names: Optional[List[str]] = None

class InteractionAlert(BaseModel):
    drug_a: str
    drug_b: str
    severity: str  # HIGH, MODERATE, LOW, NO_INTERACTION
    issue: str
    explanation: str
    clinical_recommendation: Optional[str] = None
    source: str
    last_checked_timestamp: str
    clinician_reviewed: bool = False

class FoodInteraction(BaseModel):
    drug: str
    food_factor: str
    warning: str
    recommendation: str
    source: str

class DuplicateTherapy(BaseModel):
    drug_a: str
    drug_b: str
    therapeutic_class: str
    warning: str

class InteractionCheckResponse(BaseModel):
    alerts: List[InteractionAlert] = []
    food_interactions: List[FoodInteraction] = []
    duplicate_therapies: List[DuplicateTherapy] = []
    checked_drugs_count: int
    sources: List[str]
    checked_timestamp: str
    summary_message: str
    disclaimer: str = "AI-assisted reference information — verify with an authorized healthcare professional."

# --- Schedule / Timetable Schemas ---
class MedicationScheduleItem(BaseModel):
    drug_name: str
    dosage: str
    route: str = "Oral"
    frequency: str = "Once daily"
    time_slot: str  # e.g., "08:00 AM", "01:00 PM", "08:00 PM", "10:00 PM"
    timing_description: str  # e.g., "Morning - Before breakfast"
    food_relation: str  # "Before meal", "With meal", "After meal", "Empty stomach", "Unrestricted"
    chronopharmacology_rationale: Optional[str] = None
    clinician_approved: bool = True

class ScheduleGenerateRequest(BaseModel):
    patient_id: Optional[str] = None
    medications: List[Dict[str, Any]]

class ScheduleGenerateResponse(BaseModel):
    timetable: List[MedicationScheduleItem]
    chronopharmacology_recommendations: List[str] = []
    disclaimer: str = "AI-assisted reference information — verify with an authorized healthcare professional."

# --- Clinical Summary Schemas ---
class ClinicalSummaryRequest(BaseModel):
    patient_id: str
    scan_id: Optional[str] = None
    confirmed_medications: List[Dict[str, Any]]
    interaction_alerts: Optional[List[Dict[str, Any]]] = []
    timetable: Optional[List[Dict[str, Any]]] = []
    clinician_notes: Optional[str] = ""

class ClinicalSummaryResponse(BaseModel):
    patient_id: str
    generated_at: str
    sections: Dict[str, Any]
    formatted_markdown: str
    disclaimer: str = "AI-assisted summary — verify all clinical information before use."

# --- Prescription / PDF Schemas ---
class PrescriptionGenerateRequest(BaseModel):
    patient_id: str
    doctor_name: str = "Dr. Authorized Clinician, M.D."
    clinic_name: str = "ChronoRx Clinical Center"
    diagnosis: Optional[str] = "Primary Clinical Diagnosis"
    confirmed_medications: List[Dict[str, Any]]
    schedule: Optional[List[Dict[str, Any]]] = []
    interaction_warnings: Optional[List[Dict[str, Any]]] = []
    dietary_instructions: Optional[List[str]] = []
    ocr_summary: Optional[str] = None
    clinician_notes: Optional[str] = None
    is_verified: bool = False
    reviewed_by: Optional[str] = None

class PrescriptionGenerateResponse(BaseModel):
    review_id: str
    patient_id: str
    pdf_filename: str
    pdf_url: str
    generated_at: str
    verification_status: str
    disclaimer: str = "AI-assisted reference information — verify with an authorized healthcare professional."

# --- Delivery Schemas (Tier 3) ---
class DeliveryRequest(BaseModel):
    patient_id: str
    review_id: Optional[str] = None
    phone: Optional[str] = None
    delivery_channel: str = "whatsapp"  # "whatsapp" or "sms"
    notes: Optional[str] = None

class DeliveryResponse(BaseModel):
    success: bool
    status: str  # "SENT", "UNCONFIGURED", "FAILED"
    message: str
    delivery_channel: str
    destination: Optional[str] = None
    timestamp: str

# --- Audit Schema ---
class AuditLogResponse(BaseModel):
    id: int
    patient_id: Optional[str] = None
    user_id: str
    action: str
    details: str
    ip_address: str
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

# --- Medication Schemas ---
class MedicationCreate(BaseModel):
    patient_id: str
    name: str = Field(..., min_length=1, description="Medication commercial or generic name")
    generic_name: Optional[str] = None
    strength: Optional[str] = "Standard"
    route: Optional[str] = "Oral"
    frequency: Optional[str] = "Once daily"
    duration: Optional[str] = "30 days"
    instructions: Optional[str] = "As directed by physician"
    category: Optional[str] = "Allopathic"

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class MedicationResponse(BaseModel):
    id: int
    medication_id: str
    patient_id: str
    name: str
    generic_name: Optional[str] = None
    strength: str
    route: str
    frequency: str
    duration: str
    instructions: str
    category: str
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ScheduleUpdateRequest(BaseModel):
    patient_id: Optional[str] = None
    timetable: List[Dict[str, Any]]
    clinician_approved: Optional[bool] = True

class PrescriptionReviewResponse(BaseModel):
    id: int
    review_id: str
    patient_id: str
    doctor_id: Optional[str] = None
    doctor_name: str
    diagnosis: Optional[str] = ""
    medications: str
    interactions: str
    schedule: str
    clinician_notes: Optional[str] = ""
    is_reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime.datetime] = None
    pdf_path: Optional[str] = None
    delivery_status: Optional[str] = "NOT_SENT"
    delivery_details: Optional[str] = ""
    status: Optional[str] = "ACTIVE"
    archived_at: Optional[datetime.datetime] = None
    archived_by: Optional[str] = None
    archive_reason: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# --- Report Delete Schemas ---
class ReportDeleteRequest(BaseModel):
    reason: Optional[str] = "Wrong document uploaded"

class ReportDeleteResponse(BaseModel):
    status: str
    scan_id: str
    message: str
    patient_id: str

# --- Patient History Management Schemas ---
class PatientHistoryCreate(BaseModel):
    patient_id: str
    entry_type: str = "consultation" # consultation, diagnosis, clinical_note, medical_history, lab_result
    title: str
    description: Optional[str] = None
    doctor_name: Optional[str] = None
    is_finalized: bool = False

class PatientHistoryArchiveRequest(BaseModel):
    reason: str = Field(..., description="Reason for removing or archiving history entry")
    target_status: str = Field("ARCHIVED", description="ARCHIVED, VOID, or INCORRECT")

class PatientHistoryResponse(BaseModel):
    id: int
    entry_id: str
    patient_id: str
    entry_type: str
    title: str
    description: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    is_finalized: bool
    status: str
    archived_at: Optional[datetime.datetime] = None
    archived_by: Optional[str] = None
    archive_reason: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True
