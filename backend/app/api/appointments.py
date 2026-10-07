import uuid
import secrets
import hashlib
import datetime
import urllib.parse
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Appointment, Patient, User
from app.schemas.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    DoctorSlotResponse,
    QRVerifyRequest,
    QRVerifyResponse,
)
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event

router = APIRouter(prefix="/appointments", tags=["Appointments & QR Receipt Verification"])

STANDARD_TIME_SLOTS = [
    "09:00 AM",
    "09:30 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "02:00 PM",
    "02:30 PM",
    "03:00 PM",
    "03:30 PM",
    "04:00 PM",
    "04:30 PM",
]


def _generate_qr_svg_data_uri(payload: str) -> str:
    """
    Generates a deterministic, high-contrast 21x21 QR-style matrix SVG data URI
    from the opaque verification payload without any external network requests
    and with zero PII exposure.
    """
    size = 21
    grid = [[0 for _ in range(size)] for _ in range(size)]

    def draw_finder(r0: int, c0: int):
        for r in range(7):
            for c in range(7):
                if r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4):
                    grid[r0 + r][c0 + c] = 1
                else:
                    grid[r0 + r][c0 + c] = 0

    draw_finder(0, 0)
    draw_finder(0, size - 7)
    draw_finder(size - 7, 0)

    # Timing patterns
    for i in range(8, size - 8):
        grid[6][i] = 1 if i % 2 == 0 else 0
        grid[i][6] = 1 if i % 2 == 0 else 0

    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    bit_idx = 0
    for r in range(size):
        for c in range(size):
            # Skip finder pattern & separator zones
            if (r < 8 and c < 8) or (r < 8 and c >= size - 8) or (r >= size - 8 and c < 8):
                continue
            if r == 6 or c == 6:
                continue
            byte_val = digest[(bit_idx // 8) % len(digest)]
            bit_val = (byte_val >> (bit_idx % 8)) & 1
            grid[r][c] = bit_val
            bit_idx += 1

    cell = 8
    margin = 16
    total = size * cell + margin * 2
    rects = []
    for r in range(size):
        for c in range(size):
            if grid[r][c]:
                x = margin + c * cell
                y = margin + r * cell
                rects.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" rx="1.2" fill="#0f172a"/>')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" width="200" height="200">'
        f'<rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>'
        f'{"".join(rects)}'
        f"</svg>"
    )
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def _serialize_appointment(appt: Appointment) -> AppointmentResponse:
    """
    Serializes an Appointment record into AppointmentResponse.
    Strictly ensures QR payload contains ONLY the opaque appointment verification token
    and never raw patient PII (no name, phone, medical history, or diagnosis).
    """
    qr_payload = f"CRX-APT:{appt.appointment_id}:{appt.qr_token}"
    return AppointmentResponse(
        id=appt.id,
        appointment_id=appt.appointment_id,
        receipt_number=appt.receipt_number,
        patient_id=appt.patient_id,
        patient_name=appt.patient_name,
        doctor_id=appt.doctor_id,
        doctor_name=appt.doctor_name,
        department=appt.department,
        appointment_date=appt.appointment_date,
        time_slot=appt.time_slot,
        appointment_time=appt.appointment_time or appt.time_slot,
        consultation_type=appt.consultation_type,
        reason=appt.reason,
        status=appt.status,
        qr_token=appt.qr_token,
        qr_payload=qr_payload,
        qr_svg_data_uri=_generate_qr_svg_data_uri(qr_payload),
        verified_at=appt.verified_at,
        verified_by=appt.verified_by,
        cancelled_at=appt.cancelled_at,
        cancelled_by=appt.cancelled_by,
        cancel_reason=appt.cancel_reason,
        created_by=appt.created_by or "SYSTEM",
        created_at=appt.created_at,
        updated_at=appt.updated_at or appt.created_at,
    )


def _infer_department(doctor: User) -> str:
    name_lower = (doctor.full_name or "").lower()
    if "cardio" in name_lower:
        return "Cardiology & Chronotherapy"
    if "neuro" in name_lower:
        return "Neurology & Sleep Medicine"
    if "onco" in name_lower:
        return "Clinical Oncology"
    return "Internal Medicine & Chronopharmacology"


@router.get("/doctors", response_model=List[DoctorSlotResponse])
@router.get("/slots", response_model=List[DoctorSlotResponse])
def list_available_doctors_and_slots(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    doctor_id: Optional[str] = Query(None, description="Optional filter by doctor_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns active doctors and their available vs booked time slots for a target date.
    Accessible to authenticated patients, doctors, receptionists, and admins.
    """
    target_date = (date or datetime.date.today().isoformat()).strip()

    doc_query = db.query(User).filter(User.role == "doctor", User.is_active == True)
    if doctor_id:
        doc_query = doc_query.filter(User.user_id == doctor_id)
    doctors = doc_query.order_by(User.id.asc()).all()

    booked_records = (
        db.query(Appointment)
        .filter(
            Appointment.appointment_date == target_date,
            Appointment.status != "CANCELLED",
        )
        .all()
    )
    booked_by_doc = {}
    for b in booked_records:
        booked_by_doc.setdefault(b.doctor_id, set()).add(b.time_slot)

    result: List[DoctorSlotResponse] = []
    for doc in doctors:
        doc_booked = sorted(list(booked_by_doc.get(doc.user_id, set())))
        doc_available = [s for s in STANDARD_TIME_SLOTS if s not in doc_booked]
        result.append(
            DoctorSlotResponse(
                doctor_id=doc.user_id,
                doctor_name=doc.full_name,
                department=_infer_department(doc),
                date=target_date,
                available_slots=doc_available,
                booked_slots=doc_booked,
            )
        )
    return result


@router.post("/book", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Books a clinical appointment and generates a digital receipt with a PII-free QR verification token.
    - Enforces IDOR protection: Patients can only book for their own patient_id.
    - Prevents double-booking of the same (doctor_id, appointment_date, time_slot).
    - Logs APPOINTMENT_BOOKED audit event.
    """
    # Resolve and authorize patient_id
    if current_user.role == "patient":
        if not current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is not linked to a valid clinical patient_id.",
            )
        if payload.patient_id and payload.patient_id != current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only book appointments for themselves.",
            )
        target_patient_id = current_user.patient_id
    else:
        target_patient_id = payload.patient_id
        if not target_patient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id is required when booking on behalf of a patient.",
            )

    patient = db.query(Patient).filter(Patient.patient_id == target_patient_id).first()
    patient_name = patient.name if patient else current_user.full_name

    # Validate doctor
    doctor = (
        db.query(User)
        .filter(User.user_id == payload.doctor_id, User.role == "doctor", User.is_active == True)
        .first()
    )
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active doctor '{payload.doctor_id}' not found.",
        )

    appt_date = (payload.appointment_date or "").strip()
    slot = (payload.time_slot or payload.appointment_time or "").strip()
    if not appt_date or not slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both appointment_date and time_slot (or appointment_time) are required.",
        )

    # Duplicate / double-booking check for the same doctor + date + time_slot
    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.user_id,
            Appointment.appointment_date == appt_date,
            Appointment.time_slot == slot,
            Appointment.status != "CANCELLED",
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Time slot '{slot}' on {appt_date} with {doctor.full_name} is already booked. "
                "Please select another available slot."
            ),
        )

    appointment_id = f"APT-{uuid.uuid4().hex[:8].upper()}"
    receipt_number = f"RCP-{datetime.date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    # Opaque server-verified token — zero patient PII
    qr_token = f"CRX-VRF-{secrets.token_hex(12).upper()}"
    qr_payload = f"CRX-APT:{appointment_id}:{qr_token}"
    now_dt = datetime.datetime.utcnow()

    new_appt = Appointment(
        appointment_id=appointment_id,
        receipt_number=receipt_number,
        patient_id=target_patient_id,
        patient_name=patient_name,
        doctor_id=doctor.user_id,
        doctor_name=doctor.full_name,
        department=payload.department or _infer_department(doctor),
        appointment_date=appt_date,
        time_slot=slot,
        appointment_time=slot,
        consultation_type=payload.consultation_type or "IN_PERSON",
        reason=payload.reason or "Scheduled Clinical Consultation",
        status="BOOKED",
        qr_token=qr_token,
        qr_payload=qr_payload,
        created_by=current_user.user_id,
        created_at=now_dt,
        updated_at=now_dt,
    )
    db.add(new_appt)
    db.commit()
    db.refresh(new_appt)

    log_audit_event(
        db,
        patient_id=target_patient_id,
        user_id=current_user.user_id,
        action="APPOINTMENT_BOOKED",
        details=(
            f"Appointment {appointment_id} (Receipt {receipt_number}) booked for patient {target_patient_id} "
            f"with {doctor.full_name} ({doctor.user_id}) on {appt_date} at {slot}."
        ),
    )

    return _serialize_appointment(new_appt)


@router.get("", response_model=List[AppointmentResponse])
def list_appointments(
    patient_id: Optional[str] = Query(None, description="Optional filter by patient_id"),
    doctor_id: Optional[str] = Query(None, description="Optional filter by doctor_id"),
    date: Optional[str] = Query(None, description="Optional filter by appointment_date"),
    status_filter: Optional[str] = Query(None, alias="status", description="Optional filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists appointments with strict RBAC and IDOR enforcement:
    - Patient: Sees ONLY their own appointments.
    - Doctor: Sees appointments assigned to them (or filtered by patient_id).
    - Receptionist / Admin: Sees all clinic appointments for scheduling & QR check-in.
    """
    query = db.query(Appointment)

    if current_user.role == "patient":
        if not current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patient account is not linked to a valid patient_id.",
            )
        if patient_id and patient_id != current_user.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only view their own appointments.",
            )
        query = query.filter(Appointment.patient_id == current_user.patient_id)
    elif current_user.role == "doctor":
        if doctor_id and doctor_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Doctors may only view their own appointment schedule.",
            )
        query = query.filter(Appointment.doctor_id == current_user.user_id)
        if patient_id:
            query = query.filter(Appointment.patient_id == patient_id)
    else:
        if patient_id:
            query = query.filter(Appointment.patient_id == patient_id)
        if doctor_id:
            query = query.filter(Appointment.doctor_id == doctor_id)

    if date:
        query = query.filter(Appointment.appointment_date == date.strip())
    if status_filter:
        query = query.filter(Appointment.status == status_filter.upper().strip())

    records = query.order_by(Appointment.created_at.desc(), Appointment.id.desc()).all()
    return [_serialize_appointment(a) for a in records]


@router.get("/{appointment_id}/receipt", response_model=AppointmentResponse)
@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment_receipt(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves a specific appointment and its digital QR receipt.
    Enforces IDOR protection so patients can only access their own receipt.
    """
    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment '{appointment_id}' not found.",
        )

    if current_user.role == "patient" and current_user.patient_id != appt.patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients may only access their own appointment receipts.",
        )
    if current_user.role == "doctor" and current_user.user_id != appt.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctors may only access appointments assigned to them.",
        )

    return _serialize_appointment(appt)


@router.post("/verify-qr", response_model=QRVerifyResponse)
def verify_appointment_qr(
    payload: QRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["receptionist", "doctor", "admin"])),
):
    """
    Receptionist / Clinical Staff QR Verification Endpoint:
    - Validates the opaque QR verification payload or token against the server database.
    - Returns ONLY the minimum required check-in verification metadata.
    - Optionally transitions BOOKED appointments to CONFIRMED upon check-in.
    - Logs APPOINTMENT_QR_VERIFIED in the audit log.
    """
    raw = (payload.qr_data or "").strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR verification payload cannot be empty.",
        )

    appt = None
    # Parse format "CRX-APT:{appointment_id}:{qr_token}"
    if raw.startswith("CRX-APT:"):
        parts = raw.split(":")
        if len(parts) >= 3:
            extracted_appt_id = parts[1].strip()
            extracted_token = parts[2].strip()
            appt = (
                db.query(Appointment)
                .filter(
                    Appointment.appointment_id == extracted_appt_id,
                    Appointment.qr_token == extracted_token,
                )
                .first()
            )
    if not appt:
        appt = (
            db.query(Appointment)
            .filter(
                (Appointment.qr_token == raw)
                | (Appointment.appointment_id == raw)
                | (Appointment.receipt_number == raw)
            )
            .first()
        )

    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unrecognized appointment QR verification token.",
        )

    if appt.status == "CANCELLED":
        log_audit_event(
            db,
            patient_id=appt.patient_id,
            user_id=current_user.user_id,
            action="APPOINTMENT_QR_VERIFIED",
            details=f"QR verification rejected for CANCELLED appointment {appt.appointment_id} by {current_user.user_id}.",
        )
        return QRVerifyResponse(
            valid=False,
            verification_status="CANCELLED",
            appointment_id=appt.appointment_id,
            receipt_number=appt.receipt_number,
            patient_id=appt.patient_id,
            patient_display_ref=f"Patient #{appt.patient_id}",
            doctor_id=appt.doctor_id,
            doctor_name=appt.doctor_name,
            department=appt.department,
            appointment_date=appt.appointment_date,
            time_slot=appt.time_slot,
            consultation_type=appt.consultation_type,
            status=appt.status,
            appointment_status=appt.status,
            verified_at=appt.verified_at,
            verified_by=appt.verified_by,
            message="This appointment was cancelled and cannot be checked in.",
        )

    now = datetime.datetime.utcnow()
    should_confirm = payload.confirm_checkin if payload.confirm_checkin is not None else payload.mark_confirmed
    if should_confirm and appt.status == "BOOKED":
        appt.status = "CONFIRMED"
    appt.verified_at = now
    appt.verified_by = current_user.user_id
    db.commit()
    db.refresh(appt)

    first_initial = (appt.patient_name.split()[0] if appt.patient_name else "Verified")
    patient_display_ref = f"{first_initial} ({appt.patient_id})"

    log_audit_event(
        db,
        patient_id=appt.patient_id,
        user_id=current_user.user_id,
        action="APPOINTMENT_QR_VERIFIED",
        details=(
            f"Appointment {appt.appointment_id} (Receipt {appt.receipt_number}) QR verified "
            f"by {current_user.full_name} ({current_user.user_id}). Status: {appt.status}."
        ),
    )

    return QRVerifyResponse(
        valid=True,
        verification_status="VERIFIED",
        appointment_id=appt.appointment_id,
        receipt_number=appt.receipt_number,
        patient_id=appt.patient_id,
        patient_display_ref=patient_display_ref,
        doctor_id=appt.doctor_id,
        doctor_name=appt.doctor_name,
        department=appt.department,
        appointment_date=appt.appointment_date,
        time_slot=appt.time_slot,
        consultation_type=appt.consultation_type,
        status=appt.status,
        appointment_status=appt.status,
        verified_at=appt.verified_at,
        verified_by=appt.verified_by,
        message=f"Appointment verified for {appt.appointment_date} at {appt.time_slot} with {appt.doctor_name}.",
    )


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates appointment status (BOOKED, CONFIRMED, COMPLETED, CANCELLED) without hard deletion.
    - Patients may ONLY cancel ('CANCELLED') their own appointments (IDOR & RBAC enforced).
    - Receptionists, Doctors, and Admins may transition status across lifecycle states.
    """
    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appointment '{appointment_id}' not found.",
        )

    target_status = (payload.status or "").upper().strip()
    if target_status not in ("BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: BOOKED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW.",
        )

    if current_user.role == "patient":
        if current_user.patient_id != appt.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only modify their own appointments.",
            )
        if target_status != "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Patients may only cancel their appointments.",
            )
    elif current_user.role == "doctor":
        if current_user.user_id != appt.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Doctors may only update appointments assigned to them.",
            )

    now = datetime.datetime.utcnow()
    appt.status = target_status
    appt.updated_at = now
    if target_status == "CANCELLED":
        appt.cancelled_at = now
        appt.cancelled_by = current_user.user_id
        appt.cancel_reason = (payload.reason or "Cancelled by user").strip()
        audit_action = "APPOINTMENT_CANCELLED"
    elif target_status == "CONFIRMED":
        appt.verified_at = appt.verified_at or now
        appt.verified_by = appt.verified_by or current_user.user_id
        audit_action = "APPOINTMENT_STATUS_UPDATED"
    else:
        audit_action = "APPOINTMENT_STATUS_UPDATED"

    db.commit()
    db.refresh(appt)

    log_audit_event(
        db,
        patient_id=appt.patient_id,
        user_id=current_user.user_id,
        action=audit_action,
        details=(
            f"Appointment {appt.appointment_id} status updated to {target_status} "
            f"by {current_user.user_id} ({current_user.role})."
            + (f" Reason: {appt.cancel_reason}" if target_status == "CANCELLED" and appt.cancel_reason else "")
        ),
    )

    return _serialize_appointment(appt)
