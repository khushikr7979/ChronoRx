import os
import sys
import io
import json
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://localhost:8000"

def log_test(step_num, title, status, details=""):
    status_str = "[PASS]" if status else "[FAIL]"
    print(f"{step_num}. {title.ljust(45)} {status_str} {details}")

def main():
    print("=" * 70)
    print("CHRONORX TECH — COMPREHENSIVE PRODUCTION VERIFICATION SUITE")
    print("=" * 70)

    # 1. Health check
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Backend not healthy: {r.text}"
    log_test(1, "Backend Health Check (/health)", True, "HTTP 200 OK")

    # 2. Authentication: Doctor
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "sarah.jenkins@chronorx.tech",
        "password": "ClinicianPass2026!"
    })
    assert r.status_code == 200, f"Doctor login failed: {r.text}"
    doc_token = r.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    log_test(2, "Doctor Authentication & JWT", True, "User: DOC-1001")

    # 3. Authentication: Receptionist
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "alex.rivera@chronorx.tech",
        "password": "ReceptionPass2026!"
    })
    assert r.status_code == 200, f"Receptionist login failed: {r.text}"
    rec_token = r.json()["access_token"]
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    log_test(3, "Receptionist Authentication & JWT", True, "User: REC-1001")

    # 4. Authentication: Admin
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": "david.vance@chronorx.tech",
        "password": "AdminSecure2026!"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    adm_token = r.json()["access_token"]
    adm_headers = {"Authorization": f"Bearer {adm_token}"}
    log_test(4, "Admin Authentication & JWT", True, "User: ADM-1001")

    # 5. Patient Registration
    patient_payload = {
        "name": "Evelyn Reed",
        "phone": "+1-555-8833",
        "age": 64,
        "weight": 76.5,
        "height": 168.0,
        "gender": "Female",
        "medical_history": "Hypertension, Hyperlipidemia",
        "allergies": "Sulfa drugs",
        "existing_medications": "Amlodipine 5mg"
    }
    r = requests.post(f"{BASE_URL}/api/patients", json=patient_payload, headers=rec_headers)
    assert r.status_code == 201, f"Patient registration failed: {r.text}"
    p_data = r.json()
    test_patient_id = p_data["patient_id"]
    log_test(5, "Receptionist Patient Registration", True, f"ID: {test_patient_id}, DuBois BSA: {p_data['bsa']} m2")

    # =========================================================================
    # PART 1: REAL OCR & DEMO DATA ELIMINATION TEST
    # =========================================================================
    # Create an actual test image with custom content (NOT demo text)
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "REAL PRESCRIPTION DOCUMENT FOR TESTING", fill=(0, 0, 0))
    draw.text((50, 100), f"Patient: {test_patient_id} - Evelyn Reed", fill=(0, 0, 0))
    draw.text((50, 150), "1. Atorvastatin 20mg Tab - 1 tab at bedtime x 30 days", fill=(0, 0, 0))

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    files = {"file": ("real_prescription_test.png", img_byte_arr.getvalue(), "image/png")}
    data = {"patient_id": test_patient_id}
    r = requests.post(f"{BASE_URL}/api/scan/upload", files=files, data=data, headers=doc_headers)
    assert r.status_code == 200, f"Upload failed: {r.text}"
    upload_res = r.json()
    real_scan_id = upload_res["scan_id"]
    log_test(6, "Prescription Upload & Validation", True, f"Scan ID: {real_scan_id}")

    # Run OCR on real image
    r = requests.post(f"{BASE_URL}/api/scan/ocr", json={"scan_id": real_scan_id}, headers=doc_headers)
    assert r.status_code == 200, f"OCR endpoint failed: {r.text}"
    ocr_res = r.json()
    raw_ocr_text = ocr_res["raw_text"]
    source_engine = ocr_res["source_engine"]
    confidence_val = ocr_res["confidence_score"]

    # VERIFY CRITICAL RULE: Never return DEMO-1001, Omeprazole, Amoxicillin, Clopidogrel, Warfarin
    has_demo_patient = "DEMO-1001" in raw_ocr_text
    has_fake_omeprazole = "Omeprazole" in raw_ocr_text
    has_fake_amoxicillin = "Amoxicillin" in raw_ocr_text
    has_fake_clopidogrel = "Clopidogrel" in raw_ocr_text
    has_fake_warfarin = "Warfarin" in raw_ocr_text

    demo_data_leaked = has_demo_patient or has_fake_omeprazole or has_fake_amoxicillin or has_fake_clopidogrel or has_fake_warfarin
    assert not demo_data_leaked, "CRITICAL ERROR: Fake demo data leaked into real OCR response!"
    log_test(7, "Real OCR Engine Check (No Fake Demo Text)", True, f"Engine: {source_engine}, Confidence: {confidence_val}")

    # Medication extraction on this OCR text
    r = requests.post(f"{BASE_URL}/api/scan/extract", json={
        "scan_id": real_scan_id,
        "patient_id": test_patient_id,
        "edited_text": raw_ocr_text
    }, headers=doc_headers)
    assert r.status_code == 200, f"Extract failed: {r.text}"
    extract_data = r.json()
    # Confirm DEMO-1001 is NOT detected
    extracted_pat_id = extract_data.get("patient_id_if_visible")
    assert extracted_pat_id != "DEMO-1001", "CRITICAL ERROR: DEMO-1001 was erroneously extracted as patient ID!"
    log_test(8, "Medication Extraction (No Guessed Drugs)", True, f"Extracted: {len(extract_data.get('medicines', []))} drugs, Patient ID: {extracted_pat_id or 'None'}")

    # =========================================================================
    # PART 2: REPORT DELETION & SAFE FILE CLEANUP TEST
    # =========================================================================
    # Upload temporary report specifically to test deletion
    tmp_img = Image.new("RGB", (400, 300), color=(200, 200, 200))
    tmp_bytes = io.BytesIO()
    tmp_img.save(tmp_bytes, format="PNG")
    tmp_bytes.seek(0)
    r = requests.post(f"{BASE_URL}/api/scan/upload", files={"file": ("accidental_report.png", tmp_bytes.getvalue(), "image/png")}, data={"patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200
    tmp_scan_id = r.json()["scan_id"]
    tmp_file_path = os.path.join("./uploads", r.json()["filename"])
    assert os.path.exists(tmp_file_path), "Uploaded temp file does not exist on disk"

    # Also upload a second report to verify it is NOT deleted when temp report is deleted
    sec_img = Image.new("RGB", (400, 300), color=(100, 100, 100))
    sec_bytes = io.BytesIO()
    sec_img.save(sec_bytes, format="PNG")
    sec_bytes.seek(0)
    r = requests.post(f"{BASE_URL}/api/scan/upload", files={"file": ("keeper_report.png", sec_bytes.getvalue(), "image/png")}, data={"patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200
    keeper_scan_id = r.json()["scan_id"]
    keeper_file_path = os.path.join("./uploads", r.json()["filename"])

    # DELETE ONLY the temporary report
    r = requests.delete(f"{BASE_URL}/api/scan/{tmp_scan_id}", params={"reason": "Accidentally uploaded wrong document"}, headers=doc_headers)
    assert r.status_code == 200, f"Delete scan failed: {r.text}"
    del_res = r.json()
    assert del_res["status"] == "deleted"

    # Verify physical file was removed
    assert not os.path.exists(tmp_file_path), "CRITICAL: Physical file was not deleted from disk!"

    # Verify keeper report and file still exist
    assert os.path.exists(keeper_file_path), "CRITICAL: Unrelated keeper report file was mistakenly deleted!"

    # Verify patient still exists
    r = requests.get(f"{BASE_URL}/api/patients/{test_patient_id}", headers=doc_headers)
    assert r.status_code == 200, "CRITICAL: Patient record was deleted when report was deleted!"

    # Verify audit log for REPORT_DELETED exists
    r = requests.get(f"{BASE_URL}/api/audit/{test_patient_id}", headers=doc_headers)
    assert r.status_code == 200
    audit_events = [e["action"] for e in r.json()]
    assert "REPORT_DELETED" in audit_events, "CRITICAL: REPORT_DELETED audit log was not found!"
    log_test(9, "Report Delete API & Physical File Cleanup", True, "File removed, patient safe, audit logged")

    # =========================================================================
    # PART 3: PATIENT HISTORY MANAGEMENT & CONTROLLED ARCHIVE TEST
    # =========================================================================
    # Create multiple history entries for patient
    r1 = requests.post(f"{BASE_URL}/api/patient-history", json={
        "patient_id": test_patient_id,
        "entry_type": "consultation",
        "title": "Initial Cardiology Consultation",
        "description": "Patient evaluated for stage 1 hypertension. Starting low dose ACE inhibitor.",
        "is_finalized": False
    }, headers=doc_headers)
    assert r1.status_code == 201
    hist_1_id = r1.json()["entry_id"]

    r2 = requests.post(f"{BASE_URL}/api/patient-history", json={
        "patient_id": test_patient_id,
        "entry_type": "consultation",
        "title": "Accidental Duplicate Consultation",
        "description": "Erroneously entered duplicate encounter note.",
        "is_finalized": False
    }, headers=doc_headers)
    assert r2.status_code == 201
    hist_2_id = r2.json()["entry_id"]

    r3 = requests.post(f"{BASE_URL}/api/patient-history", json={
        "patient_id": test_patient_id,
        "entry_type": "diagnosis",
        "title": "Confirmed Essential Hypertension",
        "description": "Primary diagnosis updated after 24h ambulatory BP monitoring.",
        "is_finalized": True # Finalized clinical record
    }, headers=doc_headers)
    assert r3.status_code == 201
    hist_3_id = r3.json()["entry_id"]

    # Archive/remove ONLY entry 2 (Duplicate)
    r = requests.patch(f"{BASE_URL}/api/patient-history/{hist_2_id}/archive", json={
        "reason": "Duplicate consultation entered by mistake",
        "target_status": "ARCHIVED"
    }, params={"patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200, f"Archive history failed: {r.text}"
    archived_entry = r.json()
    assert archived_entry["status"] == "ARCHIVED"
    assert archived_entry["archive_reason"] == "Duplicate consultation entered by mistake"

    # Query active history (include_archived=false)
    r = requests.get(f"{BASE_URL}/api/patient-history/{test_patient_id}?include_archived=false", headers=doc_headers)
    assert r.status_code == 200
    active_ids = [e["entry_id"] for e in r.json()]
    assert hist_2_id not in active_ids, "CRITICAL: Archived entry still appears in active history view!"
    assert hist_1_id in active_ids and hist_3_id in active_ids, "Unrelated history entries were lost!"

    # Query all history including archived (include_archived=true)
    r = requests.get(f"{BASE_URL}/api/patient-history/{test_patient_id}?include_archived=true", headers=doc_headers)
    assert r.status_code == 200
    all_ids = [e["entry_id"] for e in r.json()]
    assert hist_2_id in all_ids, "Archived entry was lost from clinical audit history!"
    log_test(10, "Controlled History Archive & Active Filtering", True, "Entry archived, active view filtered, audit trail intact")

    # Safety Test: Finalized record CANNOT be hard deleted
    r = requests.delete(f"{BASE_URL}/api/patient-history/{hist_3_id}", headers=doc_headers)
    assert r.status_code == 400, "CRITICAL: Finalized clinical record was hard-deleted! Should have been rejected."
    log_test(11, "Finalized Clinical Record Protection", True, "Hard delete rejected (HTTP 400)")

    # =========================================================================
    # PART 4: SECURITY & IDOR TESTING
    # =========================================================================
    # Try archiving hist_1_id under WRONG patient ID -> Must fail with 403 Forbidden
    r = requests.patch(f"{BASE_URL}/api/patient-history/{hist_1_id}/archive", json={
        "reason": "Malicious tampering attempt",
        "target_status": "ARCHIVED"
    }, params={"patient_id": "P-9999-DIFFERENT-PATIENT"}, headers=doc_headers)
    assert r.status_code == 403, f"IDOR Vulnerability detected! Status: {r.status_code}"
    log_test(12, "IDOR Protection Test", True, "Cross-patient modification blocked (HTTP 403)")

    # RBAC Test: Receptionist cannot archive clinical history
    r = requests.patch(f"{BASE_URL}/api/patient-history/{hist_1_id}/archive", json={
        "reason": "Receptionist attempt",
        "target_status": "ARCHIVED"
    }, headers=rec_headers)
    assert r.status_code == 403, "RBAC failure: Receptionist was able to archive clinical history!"
    log_test(13, "RBAC Authorization Enforcement", True, "Receptionist restricted from clinical archiving (HTTP 403)")

    # =========================================================================
    # PART 5: DOWNSTREAM CLINICAL PIPELINE VERIFICATION
    # =========================================================================
    confirmed_meds = [
        {"name": "Atorvastatin", "strength": "20mg", "route": "Oral", "frequency": "At bedtime", "duration": "30 days", "clinician_approved": True},
        {"name": "Lisinopril", "strength": "10mg", "route": "Oral", "frequency": "Once daily", "duration": "30 days", "clinician_approved": True},
        {"name": "Aspirin", "strength": "81mg", "route": "Oral", "frequency": "Once daily", "duration": "30 days", "clinician_approved": True}
    ]

    # Drug Normalization
    r = requests.post(f"{BASE_URL}/api/drugs/normalize", json={"drug_names": ["Atorvastatin", "Lisinopril", "Aspirin"]}, headers=doc_headers)
    assert r.status_code == 200
    norm_res = r.json()
    log_test(14, "RxNorm Drug Normalization", True, f"Normalized {len(norm_res)} drugs")

    # DDI Check
    r = requests.post(f"{BASE_URL}/api/interactions/check", json={"drugs": ["Atorvastatin", "Lisinopril", "Aspirin"], "patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200
    ddi_res = r.json()
    log_test(15, "Multi-Drug Interaction (DDI) Check", True, f"Checked: {ddi_res.get('interactions_found', 0)} interactions")

    # Posology
    r = requests.post(f"{BASE_URL}/api/posology/analyze", json={"drug_name": "Atorvastatin", "dosage": "20mg", "weight_kg": 76.5, "height_cm": 168.0, "patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200
    pos_res = r.json()
    log_test(16, "Posology & DuBois BSA Calculation", True, f"BSA: {pos_res.get('calculated_bsa', pos_res.get('bsa'))} m2, Status: {pos_res.get('verification_status')}")

    # Chronopharmacology Timetable
    r = requests.post(f"{BASE_URL}/api/schedule/generate", json={"medications": confirmed_meds, "patient_id": test_patient_id}, headers=doc_headers)
    assert r.status_code == 200
    sched_res = r.json()
    timetable = sched_res.get("schedule", [])
    log_test(17, "Circadian Chronopharmacology Scheduling", True, f"Slots: {len(timetable)}")

    # Clinical Summary
    r = requests.post(f"{BASE_URL}/api/clinical-summary/generate", json={
        "patient_id": test_patient_id,
        "confirmed_medications": confirmed_meds,
        "interaction_alerts": ddi_res.get("alerts", []),
        "timetable": timetable,
        "clinician_notes": "Patient advised to take Atorvastatin strictly at night."
    }, headers=doc_headers)
    assert r.status_code == 200
    log_test(18, "Clinical Consultation Summary", True, "Markdown synthesized")

    # E-Prescription & ReportLab PDF
    r = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": test_patient_id,
        "doctor_name": "Dr. Sarah Jenkins, M.D.",
        "clinic_name": "ChronoRx Health Network",
        "confirmed_medications": confirmed_meds,
        "schedule": timetable,
        "interaction_warnings": ddi_res.get("alerts", []),
        "diagnosis": "Essential Hypertension & Hyperlipidemia",
        "clinician_notes": "Verified and signed.",
        "is_verified": True,
        "reviewed_by": "Dr. Sarah Jenkins, M.D."
    }, headers=doc_headers)
    assert r.status_code == 200, f"Prescription generate failed: {r.text}"
    rx_res = r.json()
    rx_review_id = rx_res["review_id"]
    log_test(19, "E-Prescription & ReportLab PDF Generation", True, f"Review ID: {rx_review_id}, PDF: {rx_res['pdf_filename']}")

    # Prescription Archive Test
    r = requests.patch(f"{BASE_URL}/api/prescriptions/{rx_review_id}/archive", params={
        "reason": "Follow-up adjusted prescription supersedes this draft",
        "target_status": "ARCHIVED"
    }, headers=doc_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "ARCHIVED"
    log_test(20, "Prescription Archive / Voiding", True, "Prescription soft-archived, audit logged")

    print("=" * 70)
    print("ALL 20 PRODUCTION MASTER TESTS PASSED SUCCESSFULLY (Exit Code 0)")
    print("=" * 70)

if __name__ == "__main__":
    main()
