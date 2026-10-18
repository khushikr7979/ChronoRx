"""
ChronoRx Multilingual Translation Endpoints
Supports 22 Eighth Schedule Indian Languages with clinical parameter safety and clinician verification.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import uuid
import datetime

from app.database import get_db
from app.models.models import (
    User,
    Patient,
    TranslationVerification,
    TranslationFeedback,
    AuditLog,
)
from app.schemas.schemas import (
    LanguageInfo,
    TranslationRequest,
    TranslationResponse,
    InstructionsTranslationRequest,
    InstructionsTranslationResponse,
    TranslationVerifyRequest,
    TranslationVerifyResponse,
    TranslationFeedbackRequest,
    TranslationFeedbackResponse,
    PatientLanguageUpdateRequest,
)
from app.security.auth_handler import get_current_active_user, get_current_user
from app.services.subscription_service import require_active_subscription
from app.services.translation_service import (
    INDIAN_SCHEDULED_LANGUAGES,
    compute_content_hash,
    get_language_info,
    translate_clinical_text,
    translate_instructions_list,
)

router = APIRouter(prefix="/translations", tags=["Multilingual Patient Instructions"])

@router.get("/languages", response_model=List[LanguageInfo])
def get_supported_languages():
    """
    Returns all 22 official Eighth Schedule languages of the Constitution of India,
    along with native script labels and reading directions (LTR/RTL).
    Publicly accessible for language picker.
    """
    return INDIAN_SCHEDULED_LANGUAGES

@router.post("/translate", response_model=TranslationResponse)
def translate_text(
    payload: TranslationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Translates medical text or patient instruction into the target Indian language.
    Strictly masks and unmasks drug names, dosages, units, and clinical parameters.
    """
    result = translate_clinical_text(
        text=payload.text,
        target_language=payload.target_language,
        source_language=payload.source_language or "en",
        preserve_medical_terms=payload.preserve_medical_terms if payload.preserve_medical_terms is not None else True,
        db=db
    )
    return result

@router.post("/instructions", response_model=InstructionsTranslationResponse)
def translate_prescription_instructions(
    payload: InstructionsTranslationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Batch-translates structured medication instructions and schedule timetable.
    Checks for clinician verification on each translated sentence.
    """
    target_lang = payload.target_language.lower().strip()
    lang_info = get_language_info(target_lang)

    translated_list = []
    has_unverified = False

    for inst in payload.instructions:
        res = translate_clinical_text(
            text=inst,
            target_language=target_lang,
            db=db
        )
        translated_list.append(res["translated_text"])
        if res.get("status") != "Clinician-Verified":
            has_unverified = True

    # Translate medication items if provided
    translated_meds = []
    if payload.medication_items:
        for med in payload.medication_items:
            m_copy = dict(med)
            if "instructions" in m_copy and m_copy["instructions"]:
                t_inst = translate_clinical_text(
                    text=m_copy["instructions"],
                    target_language=target_lang,
                    db=db
                )
                m_copy["translated_instructions"] = t_inst["translated_text"]
                m_copy["translation_status"] = t_inst["status"]
            if "timing_description" in m_copy and m_copy["timing_description"]:
                t_timing = translate_clinical_text(
                    text=m_copy["timing_description"],
                    target_language=target_lang,
                    db=db
                )
                m_copy["translated_timing"] = t_timing["translated_text"]
            translated_meds.append(m_copy)

    overall_status = "Clinician-Verified" if (translated_list and not has_unverified) else "Machine-Translated"

    return InstructionsTranslationResponse(
        target_language=target_lang,
        language_name=lang_info.get("name", target_lang),
        direction=lang_info.get("direction", "ltr"),
        original_instructions=payload.instructions,
        translated_instructions=translated_list,
        translated_medications=translated_meds,
        status=overall_status,
        verification_status=overall_status,
        is_verified=(overall_status == "Clinician-Verified"),
        disclaimer="Original clinician-approved English instructions remain the authoritative legal medical reference."
    )

@router.post("/verify", response_model=TranslationVerifyResponse)
def verify_translation(
    payload: TranslationVerifyRequest,
    current_user: User = Depends(require_active_subscription),
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Authorizes a clinician (Doctor or Admin) to review and stamp an approved translation.
    Stores the verification record and writes an audit log.
    """
    if current_user.role not in ["doctor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only licensed clinicians (Doctor or Admin) can verify medical translations."
        )

    target_lang = payload.target_language.lower().strip()
    content_hash = compute_content_hash(payload.original_text, target_lang)

    existing = db.query(TranslationVerification).filter(
        TranslationVerification.content_hash == content_hash
    ).first()

    now = datetime.datetime.utcnow()

    if existing:
        existing.translated_text = payload.translated_text
        existing.status = payload.status or "Clinician-Verified"
        existing.verified_by = current_user.user_id
        existing.verified_by_name = current_user.full_name
        existing.verified_at = now
        existing.notes = payload.notes
        db.commit()
        ver_id = existing.verification_id
    else:
        ver_id = f"TVER-{uuid.uuid4().hex[:8].upper()}"
        new_ver = TranslationVerification(
            verification_id=ver_id,
            content_hash=content_hash,
            target_language=target_lang,
            original_text=payload.original_text,
            translated_text=payload.translated_text,
            status=payload.status or "Clinician-Verified",
            verified_by=current_user.user_id,
            verified_by_name=current_user.full_name,
            verified_at=now,
            notes=payload.notes
        )
        db.add(new_ver)
        db.commit()

    # Audit Log
    ip = request.client.host if request and request.client else "127.0.0.1"
    audit = AuditLog(
        user_id=current_user.user_id,
        action="TRANSLATION_VERIFIED",
        details=f"Clinician {current_user.user_id} verified translation for {target_lang} (ID: {ver_id})",
        ip_address=ip
    )
    db.add(audit)
    db.commit()

    return TranslationVerifyResponse(
        verification_id=ver_id,
        status="Clinician-Verified",
        target_language=target_lang,
        verified_by=current_user.user_id,
        verified_at=now,
        message=f"Medical translation successfully verified by {current_user.full_name}."
    )

@router.post("/feedback", response_model=TranslationFeedbackResponse)
def submit_translation_feedback(
    payload: TranslationFeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Allows any authenticated user (patient, doctor, receptionist) to flag a translation discrepancy.
    """
    fb_id = f"TFB-{uuid.uuid4().hex[:8].upper()}"
    fb = TranslationFeedback(
        feedback_id=fb_id,
        user_id=current_user.user_id,
        target_language=payload.target_language,
        original_text=payload.original_text,
        reported_text=payload.reported_text,
        issue_description=payload.issue_description,
        status="OPEN"
    )
    db.add(fb)
    db.commit()

    return TranslationFeedbackResponse(
        feedback_id=fb_id,
        status="OPEN",
        message="Thank you. Your translation report has been submitted to clinical review.",
        created_at=datetime.datetime.utcnow()
    )

@router.put("/patient-language/{patient_id}")
def update_patient_language(
    patient_id: str,
    payload: PatientLanguageUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Updates the preferred mother tongue / language for a patient.
    Protected with IDOR checks:
    - Patients can only update their own linked patient profile.
    - Receptionist, Doctor, Admin can update for clinical care.
    """
    if current_user.role == "patient":
        if current_user.patient_id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only update your own patient profile."
            )

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient {patient_id} not found."
        )

    patient.preferred_language = payload.preferred_language.lower().strip()
    
    # Also update linked user profile if exists
    linked_user = db.query(User).filter(User.patient_id == patient_id).first()
    if linked_user:
        linked_user.preferred_language = patient.preferred_language

    db.commit()

    lang_info = get_language_info(patient.preferred_language)
    return {
        "status": "success",
        "patient_id": patient_id,
        "preferred_language": patient.preferred_language,
        "language_name": lang_info.get("name", patient.preferred_language),
        "message": f"Preferred mother tongue updated to {lang_info.get('name')}."
    }
