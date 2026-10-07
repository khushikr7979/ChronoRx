import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    FollowUpSession,
    FollowUpMessage,
    Patient,
    PrescriptionReview,
    User,
)
from app.schemas.schemas import (
    FollowUpInitiateRequest,
    FollowUpMessageCreate,
    FollowUpMessageResponse,
    FollowUpSessionResponse,
    FollowUpThreadResponse,
)
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event

router = APIRouter(prefix="/followups", tags=["3-Day Patient-Doctor Follow-Up"])

FOLLOWUP_WINDOW_DAYS = 3
NON_EMERGENCY_DISCLAIMER = (
    "Follow-up communication is strictly for non-emergency post-consultation questions "
    "and side-effect reporting within 72 hours of consultation finalization. "
    "For medical emergencies, severe chest pain, or acute distress, call emergency services immediately."
)


def format_remaining_time(remaining_seconds: int, is_expired: bool) -> str:
    if is_expired or remaining_seconds <= 0:
        return "Expired — Read-Only"
    days = remaining_seconds // 86400
    hours = (remaining_seconds % 86400) // 3600
    minutes = (remaining_seconds % 3600) // 60
    if days > 0:
        return f"{days}d {hours}h remaining"
    if hours > 0:
        return f"{hours}h {minutes}m remaining"
    return f"{max(1, minutes)}m remaining"


def serialize_followup_session(session: FollowUpSession) -> FollowUpSessionResponse:
    now = datetime.datetime.utcnow()
    diff_seconds = int((session.follow_up_expires_at - now).total_seconds())
    is_expired = diff_seconds <= 0 or session.status in ("EXPIRED", "CLOSED")
    remaining_seconds = max(0, diff_seconds) if not is_expired else 0
    effective_status = "EXPIRED" if (is_expired and session.status == "ACTIVE") else session.status

    return FollowUpSessionResponse(
        id=session.id,
        session_id=session.session_id,
        consultation_ref=session.consultation_ref or session.review_id or session.billing_reference or session.session_id,
        patient_id=session.patient_id,
        patient_name=session.patient_name,
        doctor_id=session.doctor_id,
        doctor_name=session.doctor_name,
        review_id=session.review_id,
        diagnosis=session.diagnosis,
        billing_reference=session.billing_reference,
        billed_at=session.billed_at,
        follow_up_expires_at=session.follow_up_expires_at,
        status=effective_status,
        is_expired=is_expired,
        is_locked=is_expired,
        remaining_seconds=remaining_seconds,
        remaining_label=format_remaining_time(remaining_seconds, is_expired),
        non_emergency_disclaimer=NON_EMERGENCY_DISCLAIMER,
        created_at=session.created_at,
    )


def create_or_get_followup_session(
    db: Session,
    patient_id: str,
    doctor_id: str,
    doctor_name: str,
    review_id: Optional[str] = None,
    diagnosis: Optional[str] = None,
    billing_reference: Optional[str] = None,
    consultation_ref: Optional[str] = None,
    billed_at: Optional[datetime.datetime] = None,
    audit_user_id: Optional[str] = None,
) -> FollowUpSession:
    """
    Creates a 3-day (72-hour) follow-up window when a consultation is billed/finalized.
    Idempotent for a given (patient_id, doctor_id, review_id).
    """
    if review_id:
        existing = (
            db.query(FollowUpSession)
            .filter(
                FollowUpSession.patient_id == patient_id,
                FollowUpSession.doctor_id == doctor_id,
                FollowUpSession.review_id == review_id,
            )
            .first()
        )
        if existing:
            return existing

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    patient_name = patient.name if patient else None
    effective_diagnosis = diagnosis or (patient.diagnosis if patient else None)

    now = billed_at or datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(days=FOLLOWUP_WINDOW_DAYS)
    session_id = f"FUP-{uuid.uuid4().hex[:8].upper()}"
    bill_ref = billing_reference or f"BILL-{uuid.uuid4().hex[:6].upper()}"
    c_ref = consultation_ref or review_id or bill_ref

    session = FollowUpSession(
        session_id=session_id,
        consultation_ref=c_ref,
        patient_id=patient_id,
        patient_name=patient_name,
        doctor_id=doctor_id,
        doctor_name=doctor_name,
        review_id=review_id,
        diagnosis=effective_diagnosis,
        billing_reference=bill_ref,
        billed_at=now,
        follow_up_expires_at=expires_at,
        status="ACTIVE",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    log_audit_event(
        db,
        patient_id=patient_id,
        user_id=audit_user_id or doctor_id,
        action="FOLLOWUP_CREATED",
        details=(
            f"3-day post-consultation follow-up window {session_id} created for patient {patient_id} "
            f"with Dr. {doctor_name} ({doctor_id}). Expires at {expires_at.isoformat()} UTC."
        ),
    )
    return session


def _sync_sessions_from_reviews(db: Session, patient_id: Optional[str] = None, doctor_id: Optional[str] = None):
    """
    Ensures any finalized/verified PrescriptionReview has a corresponding FollowUpSession
    so existing consultations seamlessly reflect their 3-day follow-up window.
    """
    query = db.query(PrescriptionReview).filter(
        PrescriptionReview.is_reviewed == True,
        PrescriptionReview.status == "ACTIVE",
        PrescriptionReview.doctor_id.isnot(None),
    )
    if patient_id:
        query = query.filter(PrescriptionReview.patient_id == patient_id)
    if doctor_id:
        query = query.filter(PrescriptionReview.doctor_id == doctor_id)

    reviews = query.order_by(PrescriptionReview.created_at.desc()).limit(25).all()
    for rev in reviews:
        if not rev.doctor_id:
            continue
        exists = (
            db.query(FollowUpSession)
            .filter(
                FollowUpSession.patient_id == rev.patient_id,
                FollowUpSession.review_id == rev.review_id,
            )
            .first()
        )
        if not exists:
            billed_time = rev.reviewed_at or rev.created_at or datetime.datetime.utcnow()
            create_or_get_followup_session(
                db=db,
                patient_id=rev.patient_id,
                doctor_id=rev.doctor_id,
                doctor_name=rev.doctor_name or rev.reviewed_by or "Attending Physician",
                review_id=rev.review_id,
                diagnosis=rev.diagnosis,
                billing_reference=f"BILL-{rev.review_id}",
                billed_at=billed_time,
                audit_user_id=rev.doctor_id,
            )


@router.post("/initiate", response_model=FollowUpSessionResponse, status_code=status.HTTP_201_CREATED)
def initiate_followup_window(
    payload: FollowUpInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"])),
):
    """
    Explicitly initiates a 3-day follow-up window when a consultation is billed/finalized.
    Also triggered automatically on E-Prescription finalization.
    """
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{payload.patient_id}' not found.",
        )

    target_doctor_id = payload.doctor_id
    target_doctor_name = payload.doctor_name

    if current_user.role == "doctor":
        target_doctor_id = current_user.user_id
        target_doctor_name = current_user.full_name
    elif target_doctor_id:
        doc = db.query(User).filter(User.user_id == target_doctor_id, User.role == "doctor").first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Doctor '{target_doctor_id}' not found.",
            )
        target_doctor_name = doc.full_name
    else:
        latest_review = (
            db.query(PrescriptionReview)
            .filter(
                PrescriptionReview.patient_id == payload.patient_id,
                PrescriptionReview.doctor_id.isnot(None),
            )
            .order_by(PrescriptionReview.created_at.desc())
            .first()
        )
        if latest_review and latest_review.doctor_id:
            target_doctor_id = latest_review.doctor_id
            target_doctor_name = latest_review.doctor_name or latest_review.reviewed_by or "Attending Physician"
        else:
            first_doc = db.query(User).filter(User.role == "doctor", User.is_active == True).first()
            if not first_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="doctor_id is required when no attending doctor is on record.",
                )
            target_doctor_id = first_doc.user_id
            target_doctor_name = first_doc.full_name

    session = create_or_get_followup_session(
        db=db,
        patient_id=payload.patient_id,
        doctor_id=target_doctor_id,
        doctor_name=target_doctor_name or "Attending Physician",
        review_id=payload.review_id,
        diagnosis=payload.diagnosis or patient.diagnosis,
        billing_reference=payload.billing_reference,
        consultation_ref=payload.consultation_ref,
        audit_user_id=current_user.user_id,
    )

    if patient.status not in ("PRESCRIPTION_GENERATED", "DISCHARGED"):
        patient.status = "PRESCRIPTION_GENERATED"
    if not patient.consultation_completed_at:
        patient.consultation_completed_at = session.billed_at
    db.commit()

    return serialize_followup_session(session)


@router.get("", response_model=List[FollowUpSessionResponse])
def list_followup_sessions(
    patient_id: Optional[str] = Query(None, description="Optional filter by patient_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists 3-day follow-up sessions visible to the authenticated user:
    - Patient: ONLY their own follow-up sessions (IDOR protected).
    - Doctor: ONLY follow-up sessions where they are the associated doctor.
    - Admin/Receptionist: Clinic-wide sessions (read metadata only for receptionist).
    """
    if current_user.role == "patient":
        if not current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is not linked to a valid patient_id.",
            )
        if patient_id and patient_id != current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only view their own follow-up sessions.",
            )
        _sync_sessions_from_reviews(db, patient_id=current_user.patient_id)
        sessions = (
            db.query(FollowUpSession)
            .filter(FollowUpSession.patient_id == current_user.patient_id)
            .order_by(FollowUpSession.billed_at.desc())
            .all()
        )
        return [serialize_followup_session(s) for s in sessions]

    if current_user.role == "doctor":
        _sync_sessions_from_reviews(db, patient_id=patient_id, doctor_id=current_user.user_id)
        query = db.query(FollowUpSession).filter(FollowUpSession.doctor_id == current_user.user_id)
        if patient_id:
            query = query.filter(FollowUpSession.patient_id == patient_id)
        sessions = query.order_by(FollowUpSession.billed_at.desc()).all()
        return [serialize_followup_session(s) for s in sessions]

    # Admin or Receptionist
    _sync_sessions_from_reviews(db, patient_id=patient_id)
    query = db.query(FollowUpSession)
    if patient_id:
        query = query.filter(FollowUpSession.patient_id == patient_id)
    sessions = query.order_by(FollowUpSession.billed_at.desc()).all()
    return [serialize_followup_session(s) for s in sessions]


@router.get("/{session_id}", response_model=FollowUpThreadResponse)
def get_followup_thread(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves a specific follow-up session and its message history.
    Enforces strict IDOR and doctor-association rules:
    - Unrelated patients -> 403 Forbidden
    - Unrelated doctors -> 403 Forbidden
    - Receptionists -> 403 Forbidden (clinical message privacy)
    """
    session = db.query(FollowUpSession).filter(FollowUpSession.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up session '{session_id}' not found.",
        )

    if current_user.role == "patient":
        if current_user.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only access their own follow-up consultations.",
            )
    elif current_user.role == "doctor":
        if current_user.user_id != session.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Only the prescribing doctor associated with this consultation may access this follow-up.",
            )
    elif current_user.role == "receptionist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Clinical follow-up messages are restricted to the patient and their prescribing doctor.",
        )

    messages = (
        db.query(FollowUpMessage)
        .filter(FollowUpMessage.session_id == session.session_id)
        .order_by(FollowUpMessage.created_at.asc(), FollowUpMessage.id.asc())
        .all()
    )

    log_audit_event(
        db,
        patient_id=session.patient_id,
        user_id=current_user.user_id,
        action="FOLLOWUP_VIEWED",
        details=f"Follow-up thread {session.session_id} viewed by {current_user.user_id} ({current_user.role}).",
    )

    return FollowUpThreadResponse(
        session=serialize_followup_session(session),
        messages=[FollowUpMessageResponse.model_validate(m) for m in messages],
    )


@router.post("/{session_id}/messages", response_model=FollowUpMessageResponse, status_code=status.HTTP_201_CREATED)
def post_followup_message(
    session_id: str,
    payload: FollowUpMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Posts a follow-up message or doctor reply within an active 3-day follow-up window:
    - Blocks unrelated patients (IDOR -> 403)
    - Blocks unrelated doctors (403)
    - Blocks receptionists (403)
    - Blocks messaging after the 3-day follow_up_expires_at timestamp (403 read-only lock)
    - Logs audit trail for both patient questions/side-effects and doctor replies
    """
    session = db.query(FollowUpSession).filter(FollowUpSession.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up session '{session_id}' not found.",
        )

    # Authorization & relationship verification
    if current_user.role == "patient":
        if current_user.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot send messages in another patient's follow-up consultation.",
            )
    elif current_user.role == "doctor":
        if current_user.user_id != session.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Only the doctor associated with this consultation may reply.",
            )
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Your role is not permitted to post in clinical follow-up threads.",
        )

    # Check 3-day window expiration
    now = datetime.datetime.utcnow()
    if now > session.follow_up_expires_at or session.status in ("EXPIRED", "CLOSED"):
        if session.status == "ACTIVE":
            session.status = "EXPIRED"
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "The 3-day free follow-up window for this consultation has expired. "
                "Messaging is now locked and read-only. Please book a new appointment for further care."
            ),
        )

    # Determine message classification
    if current_user.role in ("doctor", "admin"):
        msg_type = "DOCTOR_REPLY"
        severity = None
    else:
        raw_type = (payload.message_type or "QUESTION").upper().strip()
        msg_type = raw_type if raw_type in ("QUESTION", "SIDE_EFFECT") else "QUESTION"
        raw_sev = payload.side_effect_severity or payload.severity or ""
        severity = raw_sev.upper().strip() or None
        if msg_type == "SIDE_EFFECT" and severity not in ("MILD", "MODERATE", "SEVERE", None):
            severity = "MODERATE"

    msg_record = FollowUpMessage(
        message_id=f"FMSG-{uuid.uuid4().hex[:8].upper()}",
        session_id=session.session_id,
        patient_id=session.patient_id,
        doctor_id=session.doctor_id,
        sender_id=current_user.user_id,
        sender_role=current_user.role,
        sender_name=current_user.full_name,
        message_type=msg_type,
        severity=severity,
        side_effect_severity=severity,
        content=payload.content.strip(),
    )
    db.add(msg_record)
    db.commit()
    db.refresh(msg_record)

    audit_action = "FOLLOWUP_DOCTOR_REPLY" if current_user.role in ("doctor", "admin") else "FOLLOWUP_MESSAGE_SENT"
    severity_note = f" [Severity: {severity}]" if severity else ""
    log_audit_event(
        db,
        patient_id=session.patient_id,
        user_id=current_user.user_id,
        action=audit_action,
        details=(
            f"Follow-up {msg_type}{severity_note} posted in session {session.session_id} "
            f"by {current_user.full_name} ({current_user.user_id})."
        ),
    )

    return FollowUpMessageResponse.model_validate(msg_record)
