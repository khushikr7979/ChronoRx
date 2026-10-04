import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("  CHRONORX TECH E2E 3-TIER & 5-MODULE VERIFICATION")
    print("==================================================")
    
    # 1. Health check
    print("\n[Step 1] Checking API Health...")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("✓ Backend API is HEALTHY:", r.json())

    # 2. Authentication
    print("\n[Step 2] Authenticating Doctor and Receptionist...")
    doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "dr.smith@chronorx.com", "password": "Password123!"})
    if doc_login.status_code != 200:
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "dr.smith@chronorx.com", "password": "Password123!", "full_name": "Dr. Sarah Smith, M.D.", "role": "doctor"
        })
        doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "dr.smith@chronorx.com", "password": "Password123!"})
    
    doc_token = doc_login.json()["access_token"]
    doc_user = doc_login.json()["user"]
    print(f"[OK] Doctor Authenticated: {doc_user['user_id']} ({doc_user['full_name']})")

    rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "reception@chronorx.com", "password": "Password123!"})
    if rec_login.status_code != 200:
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "reception@chronorx.com", "password": "Password123!", "full_name": "Desk Officer Emily", "role": "receptionist"
        })
        rec_login = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "reception@chronorx.com", "password": "Password123!"})
    
    rec_token = rec_login.json()["access_token"]
    rec_user = rec_login.json()["user"]
    print(f"[OK] Receptionist Authenticated: {rec_user['user_id']} ({rec_user['full_name']})")

    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    rec_headers = {"Authorization": f"Bearer {rec_token}"}

    # 3. Tier 1: Receptionist Registers Patient
    print("\n[Step 3] Tier 1: Receptionist Registers Patient...")
    patient_payload = {
        "name": "Marcus Vance",
        "phone": "+1 555-492-8812",
        "age": 58,
        "weight": 82.0,
        "height": 178.0,
        "gender": "Male",
        "medical_history": "Stage 2 Essential Hypertension, Dyslipidemia",
        "allergies": "Sulfa drugs",
        "existing_medications": "Hydrochlorothiazide 12.5mg daily"
    }
    p_res = requests.post(f"{BASE_URL}/api/patients", json=patient_payload, headers=rec_headers)
    assert p_res.status_code == 201, f"Patient registration failed: {p_res.text}"
    patient = p_res.json()
    p_id = patient["patient_id"]
    print(f"✓ Patient Registered: {p_id} with initial status: {patient.get('status')}")
    assert patient.get("status") == "WAITING_FOR_DOCTOR", f"Expected WAITING_FOR_DOCTOR, got {patient.get('status')}"
    assert patient.get("bsa") is not None, "BSA calculation missing"
    print(f"✓ DuBois BSA Calculated: {patient.get('bsa')} m²")

    # Verify Receptionist RBAC restriction
    print("\n[Step 4] Verifying Receptionist RBAC Restrictions (403 Forbidden for prescription generation)...")
    rec_rx_attempt = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": p_id, "doctor_name": "Fake Doctor", "clinic_name": "Fake Clinic",
        "confirmed_medications": [{"name": "Amlodipine", "strength": "5mg"}], "is_verified": True
    }, headers=rec_headers)
    assert rec_rx_attempt.status_code == 403, f"Expected 403 for receptionist generating Rx, got {rec_rx_attempt.status_code}"
    print("✓ Receptionist blocked from prescription generation with 403 Forbidden.")

    # 4. Tier 2: Doctor Patient Queue
    print("\n[Step 5] Tier 2: Doctor Inspects Queue...")
    q_res = requests.get(f"{BASE_URL}/api/patients/queue", headers=doc_headers)
    assert q_res.status_code == 200, f"Queue fetch failed: {q_res.text}"
    queue = q_res.json()
    queued_ids = [p["patient_id"] for p in queue]
    assert p_id in queued_ids, f"Patient {p_id} not in Doctor Queue!"
    print(f"✓ Patient {p_id} confirmed in Doctor Patient Queue. Total waiting/active: {len(queue)}")

    # 5. Doctor Opens Patient for Consultation
    print(f"\n[Step 6] Doctor Opens Patient {p_id} -> Status transitions to IN_CONSULTATION...")
    status_update = requests.put(f"{BASE_URL}/api/patients/{p_id}/status", json={
        "status": "IN_CONSULTATION",
        "diagnosis": "Essential Primary Hypertension & Lipid Disturbance",
        "clinical_notes": "Patient presents with elevated blood pressure. Commencing chronotherapy."
    }, headers=doc_headers)
    assert status_update.status_code == 200, f"Status update failed: {status_update.text}"
    updated_p = status_update.json()
    assert updated_p["status"] == "IN_CONSULTATION", f"Expected IN_CONSULTATION, got {updated_p['status']}"
    print(f"✓ Status transitioned to {updated_p['status']} with Diagnosis: '{updated_p['diagnosis']}'")

    # 6. Posology Analysis
    print("\n[Step 7] Running Posology Analysis...")
    pos_res = requests.post(f"{BASE_URL}/api/dose/analyze", json={
        "patient_id": p_id,
        "drug_name": "Amlodipine",
        "strength": "5mg",
        "age": 58,
        "weight": 82.0,
        "height": 178.0,
        "route": "Oral",
        "frequency": "Daily"
    }, headers=doc_headers)
    assert pos_res.status_code == 200, f"Posology failed: {pos_res.text}"
    pos_data = pos_res.json()
    print(f"✓ Posology complete. Drug: {pos_data.get('drug_name')}, Disclaimers present: {'disclaimer' in pos_data}")

    # 7. DDI Analysis
    print("\n[Step 8] Running Drug-Drug Interaction Analysis...")
    ddi_res = requests.post(f"{BASE_URL}/api/interactions/check", json={
        "patient_id": p_id,
        "drugs": ["Amlodipine", "Simvastatin", "Hydrochlorothiazide"]
    }, headers=doc_headers)
    assert ddi_res.status_code == 200, f"DDI failed: {ddi_res.text}"
    ddi_data = ddi_res.json()
    print(f"✓ DDI Analysis complete. Alerts detected: {len(ddi_data.get('alerts', []))}")

    # 8. Chronopharmacology Timetable Generation & Approval
    print("\n[Step 9] Generating Chronopharmacology Timetable...")
    sched_res = requests.post(f"{BASE_URL}/api/schedule/generate", json={
        "patient_id": p_id,
        "medications": [
            {"name": "Amlodipine", "strength": "5mg", "frequency": "Morning", "instructions": "Take in morning with water"},
            {"name": "Simvastatin", "strength": "20mg", "frequency": "Night", "instructions": "Take at bedtime"}
        ]
    }, headers=doc_headers)
    assert sched_res.status_code == 200, f"Schedule failed: {sched_res.text}"
    sched_data = sched_res.json()
    timetable = sched_data.get("timetable", [])
    print(f"✓ Timetable generated with {len(timetable)} time slots (Morning, Afternoon, Night).")

    print("\n[Step 10] Doctor Approves Timetable...")
    appr_res = requests.post(f"{BASE_URL}/api/schedule/approve", json={
        "patient_id": p_id,
        "timetable": timetable
    }, headers=doc_headers)
    assert appr_res.status_code == 200, f"Schedule approval failed: {appr_res.text}"
    print(f"✓ Doctor approved timetable: {appr_res.json()['status']}")

    # 9. Generate Authorized Prescription PDF
    print("\n[Step 11] Doctor Generates Authorized Prescription PDF...")
    rx_res = requests.post(f"{BASE_URL}/api/prescription/generate", json={
        "patient_id": p_id,
        "doctor_name": doc_user["full_name"],
        "clinic_name": "ChronoRx Clinical Center",
        "diagnosis": "Essential Primary Hypertension",
        "confirmed_medications": [
            {"name": "Amlodipine", "strength": "5mg", "frequency": "Once daily morning", "duration": "30 days", "instructions": "Take with water"},
            {"name": "Simvastatin", "strength": "20mg", "frequency": "Once daily night", "duration": "30 days", "instructions": "Take at bedtime"}
        ],
        "schedule": timetable,
        "dietary_instructions": ["Avoid grapefruit juice with simvastatin."],
        "clinician_notes": "Blood pressure chronotherapy protocol initiated.",
        "is_verified": True,
        "reviewed_by": doc_user["full_name"]
    }, headers=doc_headers)
    assert rx_res.status_code == 200, f"Prescription generation failed: {rx_res.text}"
    rx_data = rx_res.json()
    print(f"✓ Prescription PDF Generated: {rx_data.get('pdf_filename')} | Review ID: {rx_data.get('review_id')}")

    # Check updated patient status
    check_p = requests.get(f"{BASE_URL}/api/patients/{p_id}", headers=doc_headers).json()
    assert check_p["status"] == "PRESCRIPTION_GENERATED", f"Expected PRESCRIPTION_GENERATED, got {check_p['status']}"
    print(f"✓ Patient status updated to: {check_p['status']}")

    # 10. Tier 3: Download & Print Event Logging
    print("\n[Step 12] Tier 3: Logging Download and Print events...")
    dl_log = requests.post(f"{BASE_URL}/api/prescription/log-download", json={
        "patient_id": p_id, "review_id": rx_data.get("review_id")
    }, headers=doc_headers)
    assert dl_log.status_code == 200
    print("✓ Download event audited.")

    pr_log = requests.post(f"{BASE_URL}/api/prescription/log-print", json={
        "patient_id": p_id, "review_id": rx_data.get("review_id")
    }, headers=doc_headers)
    assert pr_log.status_code == 200
    print("✓ Print event audited.")

    # 11. Tier 3: Digital Delivery Abstraction & Fallback Check
    print("\n[Step 13] Tier 3: Testing Digital Delivery (WhatsApp / SMS) with unconfigured fallback...")
    delivery_res = requests.post(f"{BASE_URL}/api/prescription/deliver", json={
        "patient_id": p_id,
        "phone": "+1 555-492-8812",
        "review_id": rx_data.get("review_id"),
        "delivery_channel": "whatsapp"
    }, headers=doc_headers)
    assert delivery_res.status_code == 200, f"Delivery request failed: {delivery_res.text}"
    deliv_data = delivery_res.json()
    print(f"✓ Delivery Response received:")
    print(f"   Status: {deliv_data.get('status')}")
    print(f"   Success: {deliv_data.get('success')}")
    print(f"   Message: '{deliv_data.get('message')}'")
    assert "Digital delivery service is not configured" in deliv_data.get("message"), "Unconfigured fallback message missing!"
    print("✓ Exact fallback message verified without crashing system.")

    print("\n==================================================")
    print("  ALL 3 TIERS & 5 MODULE AUDIT VERIFICATIONS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
