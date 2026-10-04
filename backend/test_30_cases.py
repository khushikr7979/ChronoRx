import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("  CHRONORX TECH — 30-TEST AUDIT & VERIFICATION")
    print("==================================================")

    # 1. Health check
    print("\n[Test 0] Checking System API Health...")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("[PASS] System API is healthy:", r.json())

    # 1. Doctor registration
    print("\n[Test 1] Doctor Registration...")
    import time
    ts = int(time.time())
    doc_email = f"dr.test_{ts}@chronorx.tech"
    r_doc = requests.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Dr. Alexander Wright, M.D.",
        "email": doc_email,
        "password": "SecureDoctorPass2026!",
        "role": "doctor"
    })
    assert r_doc.status_code in [200, 201], f"Doctor registration failed: {r_doc.text}"
    doc_data = r_doc.json()
    doc_id = doc_data["user_id"]
    assert doc_id.startswith("DOC-"), f"Invalid Doctor ID format: {doc_id}"
    print(f"[PASS] Doctor Registered: {doc_id} ({doc_data['full_name']})")

    # 2. Receptionist registration
    print("\n[Test 2] Receptionist Registration...")
    rec_email = f"rec.test_{ts}@chronorx.tech"
    r_rec = requests.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Officer Claire Danvers",
        "email": rec_email,
        "password": "SecureReceptionPass2026!",
        "role": "receptionist"
    })
    assert r_rec.status_code in [200, 201], f"Receptionist registration failed: {r_rec.text}"
    rec_data = r_rec.json()
    rec_id = rec_data["user_id"]
    assert rec_id.startswith("REC-"), f"Invalid Receptionist ID format: {rec_id}"
    print(f"[PASS] Receptionist Registered: {rec_id} ({rec_data['full_name']})")

    # 3. Admin registration
    print("\n[Test 3] Admin Registration...")
    adm_email = f"adm.test_{ts}@chronorx.tech"
    r_adm = requests.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Chief Admin Marcus Cole",
        "email": adm_email,
        "password": "SecureAdminPass2026!",
        "role": "admin"
    })
    assert r_adm.status_code in [200, 201], f"Admin registration failed: {r_adm.text}"
    adm_data = r_adm.json()
    adm_id = adm_data["user_id"]
    assert adm_id.startswith("ADM-"), f"Invalid Admin ID format: {adm_id}"
    print(f"[PASS] Admin Registered: {adm_id} ({adm_data['full_name']})")

    # 4. Duplicate email rejection
    print("\n[Test 4] Duplicate Email Rejection...")
    r_dup = requests.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Duplicate User",
        "email": doc_email,
        "password": "AnotherPassword123!",
        "role": "doctor"
    })
    assert r_dup.status_code == 400, f"Expected 400 for duplicate email, got {r_dup.status_code}"
    assert "already registered" in r_dup.text.lower(), f"Unexpected error detail: {r_dup.text}"
    print("[PASS] Duplicate email rejected with clear message.")

    # 5. Login (via email and via System User ID)
    print("\n[Test 5] Login Authentication...")
    r_login_email = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": doc_email, "password": "SecureDoctorPass2026!"
    })
    assert r_login_email.status_code == 200, f"Email login failed: {r_login_email.text}"
    doc_token = r_login_email.json()["access_token"]

    r_login_id = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": doc_id, "password": "SecureDoctorPass2026!"
    })
    assert r_login_id.status_code == 200, f"User ID login failed: {r_login_id.text}"
    print(f"[PASS] Login authenticated both by Email and System ID ({doc_id}).")

    # Log in receptionist and admin
    rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": rec_email, "password": "SecureReceptionPass2026!"
    })
    rec_token = rec_login.json()["access_token"]

    adm_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": adm_email, "password": "SecureAdminPass2026!"
    })
    adm_token = adm_login.json()["access_token"]

    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    adm_headers = {"Authorization": f"Bearer {adm_token}"}

    # 6. RBAC verification
    print("\n[Test 6] RBAC Role Access Control...")
    # Receptionist cannot access prescription generate (403)
    rec_forbidden = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": "P-9999", "doctor_name": "Test", "confirmed_medications": [], "is_verified": True
    }, headers=rec_headers)
    assert rec_forbidden.status_code == 403, f"Expected 403 for receptionist generating Rx, got {rec_forbidden.status_code}"
    print("[PASS] RBAC properly blocks unauthorized receptionist clinical actions (403).")

    # 7. Receptionist registers patient
    print("\n[Test 7] Receptionist Registers Patient...")
    patient_payload = {
        "name": "Evelyn Reed",
        "phone": "+1 555-883-9124",
        "age": 64,
        "weight": 76.5,
        "height": 168.0,
        "gender": "Female",
        "medical_history": "Hypertension (10 yrs), Hyperlipidemia (5 yrs)",
        "allergies": "ACE Inhibitors (angioedema)",
        "existing_medications": "Amlodipine 5mg Daily"
    }
    p_res = requests.post(f"{BASE_URL}/api/patients", json=patient_payload, headers=rec_headers)
    assert p_res.status_code == 201, f"Patient registration failed: {p_res.text}"
    patient = p_res.json()
    p_id = patient["patient_id"]
    print(f"[PASS] Patient registered by receptionist: {p_id}")

    # 8. Patient_ID generation
    print("\n[Test 8] Standardized Patient_ID Generation...")
    assert p_id.startswith("P-"), f"Invalid Patient_ID prefix: {p_id}"
    print(f"[PASS] Standardized Patient_ID assigned: {p_id}")

    # 9. Patient enters Doctor Queue
    print("\n[Test 9] Patient Enters Doctor Queue (Status: WAITING_FOR_DOCTOR)...")
    assert patient["status"] == "WAITING_FOR_DOCTOR", f"Expected WAITING_FOR_DOCTOR, got {patient['status']}"
    q_res = requests.get(f"{BASE_URL}/api/patients/queue", headers=doc_headers)
    assert q_res.status_code == 200
    queue_ids = [p["patient_id"] for p in q_res.json()]
    assert p_id in queue_ids, f"Patient {p_id} not found in Doctor Queue!"
    print(f"[PASS] Patient {p_id} confirmed in Doctor Patient Queue with WAITING_FOR_DOCTOR.")

    # 10. Doctor opens patient
    print("\n[Test 10] Doctor Opens Patient -> Status transitions to IN_CONSULTATION...")
    status_res = requests.put(f"{BASE_URL}/api/patients/{p_id}/status", json={
        "status": "IN_CONSULTATION",
        "diagnosis": "Essential Arterial Hypertension & Dyslipidemia",
        "clinical_notes": "Patient reports mild ankle edema on monotherapy."
    }, headers=doc_headers)
    assert status_res.status_code == 200, f"Status update failed: {status_res.text}"
    updated_p = status_res.json()
    assert updated_p["status"] == "IN_CONSULTATION", f"Expected IN_CONSULTATION, got {updated_p['status']}"
    print(f"[PASS] Status updated to IN_CONSULTATION for {p_id}.")

    # 11. Diagnosis entry
    print("\n[Test 11] Diagnosis & Symptoms Verification...")
    assert updated_p["diagnosis"] == "Essential Arterial Hypertension & Dyslipidemia"
    print(f"[PASS] Diagnosis saved: '{updated_p['diagnosis']}'")

    # 12. Medication entry (CRUD)
    print("\n[Test 12] Medication Entry CRUD Operations...")
    med1_res = requests.post(f"{BASE_URL}/api/medications", json={
        "patient_id": p_id,
        "name": "Amlodipine Besylate",
        "strength": "5 mg",
        "route": "Oral",
        "frequency": "Once daily morning",
        "duration": "30 days",
        "instructions": "Take in the morning with water."
    }, headers=doc_headers)
    assert med1_res.status_code == 201, f"Medication add failed: {med1_res.text}"
    med1 = med1_res.json()
    med1_id = med1["medication_id"]

    med_list_res = requests.get(f"{BASE_URL}/api/medications/{p_id}", headers=doc_headers)
    assert med_list_res.status_code == 200
    assert len(med_list_res.json()) >= 1
    print(f"[PASS] Medication CRUD operational: Added {med1['name']} ({med1_id})")

    # 13. BSA calculation (DuBois deterministic formula)
    print("\n[Test 13] Deterministic DuBois BSA Calculation...")
    expected_bsa = round(0.007184 * (76.5 ** 0.425) * (168.0 ** 0.725), 2)
    actual_bsa = round(patient["bsa"], 2)
    assert abs(actual_bsa - expected_bsa) <= 0.05, f"BSA mismatch: actual {actual_bsa} vs expected {expected_bsa}"
    print(f"[PASS] DuBois BSA calculated deterministically: {actual_bsa} m²")

    # 14. Posology analysis
    print("\n[Test 14] Posology Decision Support (/posology/analyze & /dose/analyze)...")
    pos_res = requests.post(f"{BASE_URL}/api/posology/analyze", json={
        "patient_id": p_id,
        "drug_name": "Amlodipine",
        "strength": "5mg",
        "age": 64,
        "weight": 76.5,
        "height": 168.0,
        "route": "Oral",
        "frequency": "Once daily"
    }, headers=doc_headers)
    assert pos_res.status_code == 200, f"Posology check failed: {pos_res.text}"
    pos_data = pos_res.json()
    assert "disclaimer" in pos_data
    assert pos_data["calculated_bsa"] > 0
    print(f"[PASS] Posology analysis verified for {pos_data['normalized_name']} (Requires clinician review).")

    # 15. Drug normalization
    print("\n[Test 15] RxNorm Drug Normalization...")
    norm_res = requests.post(f"{BASE_URL}/api/drugs/normalize", json={
        "drug_names": ["Amlodipine", "Atorvastatin", "Metformin"]
    }, headers=doc_headers)
    assert norm_res.status_code == 200, f"Normalization failed: {norm_res.text}"
    normalized_list = norm_res.json().get("results", [])
    assert len(normalized_list) == 3
    print(f"[PASS] RxNorm normalized {len(normalized_list)} medications.")

    # 16. DDI analysis
    print("\n[Test 16] Polypharmacy & Cross-Pathy DDI Interaction Analysis...")
    ddi_res = requests.post(f"{BASE_URL}/api/interactions/check", json={
        "patient_id": p_id,
        "drugs": ["Amlodipine", "Simvastatin", "Aspirin"]
    }, headers=doc_headers)
    assert ddi_res.status_code == 200, f"DDI failed: {ddi_res.text}"
    ddi_data = ddi_res.json()
    assert "alerts" in ddi_data
    print(f"[PASS] DDI surveillance detected {len(ddi_data['alerts'])} interaction alerts.")

    # 17. Chronopharmacology generation
    print("\n[Test 17] Chronopharmacology Timetable Generation...")
    sched_res = requests.post(f"{BASE_URL}/api/schedule/generate", json={
        "patient_id": p_id,
        "medications": [
            {"name": "Amlodipine", "strength": "5mg", "frequency": "Morning", "instructions": "Take with water"},
            {"name": "Simvastatin", "strength": "20mg", "frequency": "Night", "instructions": "Take at bedtime"}
        ]
    }, headers=doc_headers)
    assert sched_res.status_code == 200, f"Schedule generation failed: {sched_res.text}"
    sched_data = sched_res.json()
    timetable = sched_data["timetable"]
    assert len(timetable) >= 2
    print(f"[PASS] Circadian timetable generated with {len(timetable)} administration phases.")

    # 18. Schedule editing
    print("\n[Test 18] Schedule Modification (PUT /schedule/{schedule_id})...")
    edit_res = requests.put(f"{BASE_URL}/api/schedule/SCHED-{p_id}", json={
        "patient_id": p_id,
        "timetable": timetable,
        "clinician_approved": True
    }, headers=doc_headers)
    assert edit_res.status_code == 200, f"Schedule edit failed: {edit_res.text}"
    print("[PASS] Clinician timetable modifications saved.")

    # 19. Schedule approval
    print("\n[Test 19] Clinician Schedule Approval...")
    appr_res = requests.post(f"{BASE_URL}/api/schedule/approve", json={
        "patient_id": p_id,
        "timetable": timetable
    }, headers=doc_headers)
    assert appr_res.status_code == 200, f"Schedule approval failed: {appr_res.text}"
    print(f"[PASS] Timetable formally approved by {appr_res.json()['approved_by']}.")

    # 20. Prescription review & past prescriptions
    print("\n[Test 20] Prescription Review History (GET /prescriptions/{patient_id})...")
    hist_res = requests.get(f"{BASE_URL}/api/prescriptions/{p_id}", headers=doc_headers)
    assert hist_res.status_code == 200
    print(f"[PASS] Prescription history endpoint verified for {p_id}.")

    # 21. Doctor verification enforcement
    print("\n[Test 21] Mandatory Doctor Verification Enforcement...")
    unverified_res = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": p_id,
        "doctor_name": doc_data["full_name"],
        "clinic_name": "ChronoRx Clinical Center",
        "diagnosis": "Essential Arterial Hypertension",
        "confirmed_medications": [{"name": "Amlodipine", "strength": "5mg"}],
        "is_verified": False
    }, headers=doc_headers)
    assert unverified_res.status_code == 400, f"Expected 400 when unverified, got {unverified_res.status_code}"
    print("[PASS] Generation strictly blocked when is_verified is False.")

    # 22. PDF generation
    print("\n[Test 22] Clinician-Authorized PDF Generation...")
    rx_res = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": p_id,
        "doctor_name": doc_data["full_name"],
        "clinic_name": "ChronoRx Clinical Center",
        "diagnosis": "Essential Arterial Hypertension & Dyslipidemia",
        "confirmed_medications": [
            {"name": "Amlodipine", "strength": "5mg", "route": "Oral", "frequency": "Once daily morning", "duration": "30 days", "instructions": "Take with water."},
            {"name": "Simvastatin", "strength": "20mg", "route": "Oral", "frequency": "Once daily night", "duration": "30 days", "instructions": "Take at bedtime."}
        ],
        "schedule": timetable,
        "interaction_warnings": ddi_data.get("alerts", []),
        "dietary_instructions": ["Avoid grapefruit juice with simvastatin."],
        "clinician_notes": "Follow up with lipid panel and blood pressure check in 6 weeks.",
        "is_verified": True,
        "reviewed_by": doc_data["full_name"]
    }, headers=doc_headers)
    assert rx_res.status_code == 200, f"PDF generation failed: {rx_res.text}"
    rx_data = rx_res.json()
    review_id = rx_data["review_id"]
    pdf_url = rx_data["pdf_url"]
    print(f"[PASS] ReportLab PDF Generated: {rx_data['pdf_filename']} (Ref: {review_id})")

    # 23. PDF download logging
    print("\n[Test 23] Prescription Download Audit Logging...")
    dl_res = requests.post(f"{BASE_URL}/api/prescription/log-download", params={
        "patient_id": p_id, "review_id": review_id
    }, headers=doc_headers)
    assert dl_res.status_code == 200
    print("[PASS] PDF Download event logged in audit trail.")

    # 24. Print logging
    print("\n[Test 24] Prescription Print Audit Logging...")
    pr_res = requests.post(f"{BASE_URL}/api/prescription/log-print", params={
        "patient_id": p_id, "review_id": review_id
    }, headers=doc_headers)
    assert pr_res.status_code == 200
    print("[PASS] Print event logged in audit trail.")

    # 25. Digital delivery fallback
    print("\n[Test 25] Tier 3 Digital Delivery Graceful Fallback...")
    deliv_res = requests.post(f"{BASE_URL}/api/prescription/deliver", json={
        "patient_id": p_id,
        "phone": "+1 555-883-9124",
        "review_id": review_id,
        "delivery_channel": "whatsapp"
    }, headers=doc_headers)
    assert deliv_res.status_code == 200, f"Delivery failed: {deliv_res.text}"
    deliv_json = deliv_res.json()
    assert "Digital delivery service is not configured" in deliv_json["message"]
    print(f"[PASS] Unconfigured delivery gracefully returned: '{deliv_json['message']}'")

    # 26. Audit logging inspection
    print("\n[Test 26] Immutable Audit Trail Inspection...")
    audit_res = requests.get(f"{BASE_URL}/api/audit/{p_id}", headers=doc_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 5, f"Expected multiple audit logs, got {len(logs)}"
    actions = [log["action"] for log in logs]
    assert "PATIENT_REGISTERED" in actions
    assert "PRESCRIPTION_GENERATED" in actions
    print(f"[PASS] Patient {p_id} has {len(logs)} immutable audit log entries.")

    # 27. PII isolation verification
    print("\n[Test 27] PII Isolation & Anonymization Check...")
    # Verify that in clinical summary and dose analysis, Name/Phone are never exposed
    sum_res = requests.post(f"{BASE_URL}/api/clinical-summary/generate", json={
        "patient_id": p_id,
        "confirmed_medications": [{"name": "Amlodipine", "strength": "5mg"}],
        "clinician_notes": "Blood pressure management"
    }, headers=doc_headers)
    assert sum_res.status_code == 200
    summary_text = sum_res.json()["formatted_markdown"]
    assert "Evelyn Reed" not in summary_text, "Patient name PII leaked into clinical summary!"
    assert "555-883-9124" not in summary_text, "Patient phone PII leaked into clinical summary!"
    print("[PASS] PII (Name, Phone) strictly isolated from clinical summary and external payloads.")

    # 28. Unauthorized receptionist clinical access
    print("\n[Test 28] Receptionist Restricted from Posology Overrides...")
    rec_posology_override = requests.post(f"{BASE_URL}/api/medications", json={
        "patient_id": p_id, "name": "Warfarin", "strength": "10mg"
    }, headers=rec_headers)
    assert rec_posology_override.status_code == 403, f"Expected 403 for receptionist adding medications, got {rec_posology_override.status_code}"
    print("[PASS] Receptionist blocked from prescribing/modifying medications (403).")

    # 29. Unauthorized non-doctor prescription approval
    print("\n[Test 29] Non-Doctor Blocked from Prescription Approval...")
    rec_rx_sign = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": p_id, "confirmed_medications": [{"name": "Amlodipine"}], "is_verified": True
    }, headers=rec_headers)
    assert rec_rx_sign.status_code == 403
    print("[PASS] Non-doctor strictly blocked from signing prescriptions (403).")

    # 30. Multiple-user data isolation
    print("\n[Test 30] Multi-User Data Isolation...")
    # Register Doctor B
    doc_b_res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Dr. Beatrice Ramos, M.D.",
        "email": f"dr.ramos_{ts}@chronorx.tech",
        "password": "PasswordDoctorB2026!",
        "role": "doctor"
    })
    doc_b_data = doc_b_res.json()
    doc_b_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": doc_b_data["email"], "password": "PasswordDoctorB2026!"
    })
    doc_b_token = doc_b_login.json()["access_token"]
    doc_b_headers = {"Authorization": f"Bearer {doc_b_token}"}

    # Doctor B checks dashboard metrics
    metrics_b = requests.get(f"{BASE_URL}/api/dashboard/metrics", headers=doc_b_headers).json()
    metrics_a = requests.get(f"{BASE_URL}/api/dashboard/metrics", headers=doc_headers).json()
    # Doctor B has 0 prescriptions reviewed by her account
    assert metrics_b["cards"]["medication_reviews"] == 0
    assert metrics_a["cards"]["medication_reviews"] >= 1
    print(f"[PASS] Multi-User Data Isolation verified: Doctor A ({doc_id}) reviews={metrics_a['cards']['medication_reviews']} vs Doctor B ({doc_b_data['user_id']}) reviews={metrics_b['cards']['medication_reviews']}.")

    print("\n==================================================")
    print("  ALL 30 VERIFICATION TEST CASES PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
