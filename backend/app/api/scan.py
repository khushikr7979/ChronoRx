import os
import uuid
import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.models import ScanRecord, Patient, User, PrescriptionReview
from app.schemas.schemas import OCRRequest, OCRResponse, ExtractRequest, StructuredExtractionResponse, ReportDeleteResponse
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event
from app.services.ocr_service import ocr_service
from app.services.ai_service import ai_service
from app.services.rxnorm_service import rxnorm_service
from app.services.openfda_service import openfda_service

router = APIRouter(prefix="/scan", tags=["Scan & OCR"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

@router.post("/upload")
async def upload_prescription_scan(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"]))
):
    """
    Step 1 & 2: Handles image upload from file or live browser camera capture.
    Performs file type and size validation.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    scan_id = f"SCAN-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{scan_id}_{file.filename}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    with open(filepath, "wb") as f:
        f.write(contents)

    scan_record = ScanRecord(
        scan_id=scan_id,
        patient_id=patient_id,
        filename=filename,
        file_path=filepath,
        status="uploaded",
        uploaded_by=current_user.user_id
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    log_audit_event(
        db,
        patient_id=patient_id,
        user_id=current_user.user_id,
        action="PRESCRIPTION_IMAGE_UPLOADED",
        details=f"Scan ID {scan_id} uploaded by {current_user.user_id}. File: {file.filename}, Size: {len(contents)} bytes"
    )

    return {
        "scan_id": scan_id,
        "patient_id": patient_id,
        "filename": filename,
        "status": "uploaded",
        "file_url": f"/uploads/{filename}",
        "message": "Prescription image received successfully. Ready for OCR preprocessing."
    }

@router.post("/ocr", response_model=OCRResponse)
def perform_ocr(
    payload: OCRRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"]))
):
    """
    Step 3: Preprocesses image (rotate, contrast, noise reduction)
    and extracts visible text using OCR engine abstraction.
    """
    record = db.query(ScanRecord).filter(ScanRecord.scan_id == payload.scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")

    rotate_deg = payload.options.rotate_deg if payload.options else 0
    enhance_contrast = payload.options.enhance_contrast if payload.options else True
    denoise = payload.options.denoise if payload.options else True
    
    try:
        ocr_result = ocr_service.extract_text(
            record.file_path,
            rotate_deg=rotate_deg,
            enhance_contrast=enhance_contrast,
            denoise=denoise
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR engine failed during text extraction: {str(e)}"
        )

    record.extracted_raw_text = ocr_result["raw_text"]
    record.edited_text = ocr_result["raw_text"]
    record.confidence_score = ocr_result["confidence_score"] or 0.0
    record.status = "ocr_completed"
    db.commit()

    log_audit_event(
        db,
        patient_id=record.patient_id,
        user_id=current_user.user_id,
        action="OCR_PERFORMED",
        details=f"OCR completed for {record.scan_id} by {current_user.user_id}. Engine: {ocr_result['engine']}, Confidence: {ocr_result['confidence_score']}"
    )

    return {
        "scan_id": record.scan_id,
        "patient_id": record.patient_id,
        "raw_text": ocr_result["raw_text"],
        "confidence_score": ocr_result["confidence_score"],
        "status": record.status,
        "source_engine": ocr_result["engine"],
        "error_message": ocr_result.get("error_message"),
        "timestamp": ocr_result["timestamp"]
    }

@router.post("/extract", response_model=StructuredExtractionResponse)
def extract_structured_prescription(
    payload: ExtractRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Step 4 & 5: AI Structured Prescription Extraction & Drug Normalization.
    Takes OCR text (or doctor's manually edited text), strips PII, extracts fields,
    normalizes drugs with RxNorm, and attaches openFDA medical reference alerts.
    """
    record = db.query(ScanRecord).filter(ScanRecord.scan_id == payload.scan_id).first()
    if not record:
        record = ScanRecord(
            scan_id=payload.scan_id or f"SCAN-{uuid.uuid4().hex[:8].upper()}",
            patient_id=payload.patient_id or "P-1001",
            filename="manual_prescription.txt",
            file_path="",
            extracted_raw_text=payload.edited_text or "",
            edited_text=payload.edited_text or "",
            status="ocr_completed",
            uploaded_by=current_user.user_id
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    text_to_process = payload.edited_text if payload.edited_text is not None else (record.edited_text or record.extracted_raw_text or "")

    # Update edited text in db
    record.edited_text = text_to_process

    # Run AI structured extraction with PII scrubbing
    extracted_data = ai_service.extract_structured_prescription(
        text=text_to_process,
        patient_id=payload.patient_id
    )

    # Save to record
    record.structured_data = json.dumps(extracted_data)
    record.status = "extracted"
    db.commit()

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="PRESCRIPTION_STRUCTURED_EXTRACTION",
        details=f"Structured extraction completed for {payload.scan_id} by {current_user.user_id}. Extracted {len(extracted_data.get('medicines', []))} medicines."
    )

    return extracted_data

@router.get("/patient/{patient_id}")
def list_patient_scans(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all scanned reports/documents uploaded for a patient."""
    if current_user.role == "patient" and current_user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patients may only access their own reports."
        )

    scans = db.query(ScanRecord).filter(
        ScanRecord.patient_id == patient_id
    ).order_by(ScanRecord.created_at.desc()).all()
    return scans

@router.delete("/{scan_id}", response_model=ReportDeleteResponse)
def delete_scan_report(
    scan_id: str,
    reason: Optional[str] = Query("Wrong document uploaded", description="Reason for deletion"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "receptionist", "admin"]))
):
    """
    Deletes an uploaded report/scan securely:
    - Enforces RBAC (Doctor, Receptionist, Admin)
    - Verifies report exists
    - Checks that prescription is NOT approved/finalized (finalized records protected)
    - Deletes physical file from storage safely
    - Removes temporary scan and unapproved draft data
    - Preserves patient profile
    - Preserves other reports and prescriptions
    - Logs audit event: REPORT_DELETED
    """
    record = db.query(ScanRecord).filter(ScanRecord.scan_id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Report with scan_id '{scan_id}' not found.")

    # Check if this scan is linked to an approved prescription
    linked_review = db.query(PrescriptionReview).filter(
        PrescriptionReview.scan_id == scan_id,
        PrescriptionReview.is_reviewed == True
    ).first()
    if linked_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete report: This prescription is linked to an approved clinical prescription. Finalized clinical records are protected."
        )

    patient_id = record.patient_id
    filename = record.filename
    file_path = record.file_path

    # Clean up associated unreviewed draft review if any
    draft_review = db.query(PrescriptionReview).filter(
        PrescriptionReview.scan_id == scan_id,
        PrescriptionReview.is_reviewed == False
    ).first()
    if draft_review:
        db.delete(draft_review)

    # Delete physical file
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        base, _ = os.path.splitext(file_path)
        preprocessed_path = f"{base}_preprocessed.png"
        if os.path.exists(preprocessed_path):
            os.remove(preprocessed_path)
    except Exception:
        # Do not fail if file already removed
        pass

    # Delete ScanRecord
    db.delete(record)
    db.commit()

    # Audit log
    log_audit_event(
        db,
        patient_id=patient_id,
        user_id=current_user.user_id,
        action="REPORT_DELETED",
        details=f"Scan report {scan_id} ({filename}) deleted by {current_user.user_id} ({current_user.role}). Reason: {reason}"
    )

    return {
        "status": "deleted",
        "scan_id": scan_id,
        "patient_id": patient_id,
        "message": "Report and temporary OCR data deleted successfully. Patient record preserved."
    }

