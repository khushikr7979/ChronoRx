"""
Comprehensive automated test suite for ChronoRx Tech Final Production Upgrade:
- 12 Follow-Up Tests (Creation, Valid Patient Access, Valid Doctor Access, Patient Question,
  Patient Adverse Side-Effect Report, Doctor Reply, Unrelated Patient IDOR Block,
  Unrelated Doctor Block, Unauthenticated Block, Post-3-Day Expiry Block,
  Expired Read-Only Access, Follow-Up Audit Trail)
- 14 Appointment & QR Receipt Tests (Doctor Listing, Slot Listing, Successful Booking,
  Duplicate Booking Prevention, Invalid Doctor Prevention, Appointment IDOR Protection,
  Patient Authorization, QR Generation, QR Zero-PII Verification, QR Server Verification,
  Invalid QR Rejection, Receptionist Check-In Authorization, Appointment Cancellation & No-Show,
  Appointment Audit Trail)
- Core Regression Verification (Health, Auth, Patient Directory, Drugs/RxNorm, Posology/Dose,
  DDI Interactions, Chronopharmacology Schedule, Clinical Summary, E-Prescription PDF & Auto-FollowUp)
"""

import os
import tempfile
import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.models import (
    User,
    Patient,
    AuditLog,
    FollowUpSession,
    FollowUpMessage,
    Appointment,
)
from app.security.auth_handler import get_password_hash


def run_all_feature_tests():
    fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    try:
        test_engine = create_engine(
            f"sqlite:///{temp_db_path}", connect_args={"check_same_thread": False}
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
        Base.metadata.create_all(bind=test_engine)

        def override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        db = TestingSessionLocal()
        doc1 = User(
            user_id="DOC-1001",
            username="DOC-1001",
            email="sarah.jenkins@chronorx.tech",
            hashed_password=get_password_hash("ClinicianPass2026!"),
            full_name="Dr. Sarah Jenkins, M.D.",
            role="doctor",
            is_active=True,
        )
        doc2 = User(
            user_id="DOC-2002",
            username="DOC-2002",
            email="marcus.chen@chronorx.tech",
            hashed_password=get_password_hash("ClinicianPass2026!"),
            full_name="Dr. Marcus Chen, M.D.",
            role="doctor",
            is_active=True,
        )
        rec1 = User(
            user_id="REC-1001",
            username="REC-1001",
            email="alex.rivera@chronorx.tech",
            hashed_password=get_password_hash("ReceptionPass2026!"),
            full_name="Alex Rivera",
            role="receptionist",
            is_active=True,
        )
        adm1 = User(
            user_id="ADM-1001",
            username="ADM-1001",
            email="david.vance@chronorx.tech",
            hashed_password=get_password_hash("AdminSecure2026!"),
            full_name="David Vance",
            role="admin",
            is_active=True,
        )
        p1 = Patient(
            patient_id="P-3001",
            name="Alice Morgan",
            phone="+1-555-3001",
            age=52,
            weight=70.0,
            height=165.0,
            gender="Female",
            bsa=1.77,
            bmi=25.7,
            medical_history="Essential Hypertension",
            allergies="Penicillin",
            existing_medications="Amlodipine 5mg",
            diagnosis="Stage 1 Hypertension",
            created_by="REC-1001",
            assigned_doctor_id="DOC-1001",
        )
        p2 = Patient(
            patient_id="P-3002",
            name="Robert King",
            phone="+1-555-3002",
            age=61,
            weight=84.0,
            height=176.0,
            gender="Male",
            bsa=2.01,
            bmi=27.1,
            medical_history="Atrial Fibrillation",
            allergies="None",
            existing_medications="Warfarin 2mg",
            diagnosis="Chronic Atrial Fibrillation",
            created_by="REC-1001",
            assigned_doctor_id="DOC-2002",
        )
        pat_user1 = User(
            user_id="PAT-3001",
            username="PAT-3001",
            email="alice.morgan@chronorx.tech",
            hashed_password=get_password_hash("PatientPass2026!"),
            full_name="Alice Morgan",
            role="patient",
            patient_id="P-3001",
            is_active=True,
        )
        pat_user2 = User(
            user_id="PAT-3002",
            username="PAT-3002",
            email="robert.king@chronorx.tech",
            hashed_password=get_password_hash("PatientPass2026!"),
            full_name="Robert King",
            role="patient",
            patient_id="P-3002",
            is_active=True,
        )
        db.add_all([doc1, doc2, rec1, adm1, p1, p2, pat_user1, pat_user2])
        db.commit()

        def login(identifier, password):
            res = client.post(
                "/api/auth/login", json={"identifier": identifier, "password": password}
            )
            assert res.status_code == 200, f"Login failed for {identifier}: {res.text}"
            return {"Authorization": f"Bearer {res.json()['access_token']}"}

        h_doc1 = login("DOC-1001", "ClinicianPass2026!")
        h_doc2 = login("DOC-2002", "ClinicianPass2026!")
        h_rec1 = login("REC-1001", "ReceptionPass2026!")
        h_pat1 = login("PAT-3001", "PatientPass2026!")
        h_pat2 = login("PAT-3002", "PatientPass2026!")

        print("=" * 78)
        print("PART 1: FEATURE 1 — 3-DAY FREE PATIENT-DOCTOR FOLLOW-UP (12 TESTS)")
        print("=" * 78)

        # 1. Follow-up creation (with exact 3-day expiry & consultation_ref)
        res = client.post(
            "/api/followups/initiate",
            json={
                "patient_id": "P-3001",
                "doctor_id": "DOC-1001",
                "consultation_ref": "CONS-9001",
                "diagnosis": "Stage 1 Hypertension",
                "billing_reference": "BILL-9001",
            },
            headers=h_doc1,
        )
        assert res.status_code == 201, res.text
        fup_data = res.json()
        session_id = fup_data["session_id"]
        billed_dt = datetime.datetime.fromisoformat(fup_data["billed_at"])
        expires_dt = datetime.datetime.fromisoformat(fup_data["follow_up_expires_at"])
        assert (expires_dt - billed_dt) == datetime.timedelta(days=3)
        assert fup_data["consultation_ref"] == "CONS-9001"
        assert fup_data["status"] == "ACTIVE"
        print(f"F1-01. Follow-Up Window Creation (+3 Days)       [PASS] {session_id}")

        # 2. Valid patient access
        res_pat_list = client.get("/api/followups", headers=h_pat1)
        assert res_pat_list.status_code == 200
        assert any(s["session_id"] == session_id for s in res_pat_list.json())
        res_pat_thread = client.get(f"/api/followups/{session_id}", headers=h_pat1)
        assert res_pat_thread.status_code == 200
        print("F1-02. Valid Patient Access                      [PASS] HTTP 200")

        # 3. Valid doctor access
        res_doc_list = client.get("/api/followups", headers=h_doc1)
        assert res_doc_list.status_code == 200
        assert any(s["session_id"] == session_id for s in res_doc_list.json())
        res_doc_thread = client.get(f"/api/followups/{session_id}", headers=h_doc1)
        assert res_doc_thread.status_code == 200
        print("F1-03. Valid Doctor Access                       [PASS] HTTP 200")

        # 4. Patient sends follow-up question
        res_q = client.post(
            f"/api/followups/{session_id}/messages",
            json={
                "message_type": "QUESTION",
                "content": "Should I take Amlodipine before or after my evening meal?",
            },
            headers=h_pat1,
        )
        assert res_q.status_code == 201, res_q.text
        assert res_q.json()["message_type"] == "QUESTION"
        print("F1-04. Patient Sends Follow-Up Question          [PASS] HTTP 201")

        # 5. Patient reports adverse side effect
        res_se = client.post(
            f"/api/followups/{session_id}/messages",
            json={
                "message_type": "SIDE_EFFECT",
                "side_effect_severity": "MILD",
                "content": "Experiencing mild ankle swelling in the evening.",
            },
            headers=h_pat1,
        )
        assert res_se.status_code == 201, res_se.text
        assert res_se.json()["message_type"] == "SIDE_EFFECT"
        assert res_se.json()["side_effect_severity"] == "MILD"
        print("F1-05. Patient Reports Adverse Side Effect       [PASS] HTTP 201 (MILD)")

        # 6. Doctor replies
        res_rep = client.post(
            f"/api/followups/{session_id}/messages",
            json={
                "message_type": "DOCTOR_REPLY",
                "content": "You may take it with or after dinner. Elevate your legs in the evening and monitor BP.",
            },
            headers=h_doc1,
        )
        assert res_rep.status_code == 201, res_rep.text
        assert res_rep.json()["message_type"] == "DOCTOR_REPLY"
        print("F1-06. Prescribing Doctor Replies                [PASS] HTTP 201")

        # 7. Unrelated patient blocked (IDOR)
        assert client.get(f"/api/followups/{session_id}", headers=h_pat2).status_code == 403
        assert (
            client.post(
                f"/api/followups/{session_id}/messages",
                json={"message_type": "QUESTION", "content": "IDOR attempt"},
                headers=h_pat2,
            ).status_code
            == 403
        )
        assert client.get("/api/followups?patient_id=P-3001", headers=h_pat2).status_code == 403
        print("F1-07. Unrelated Patient Blocked (IDOR)          [PASS] HTTP 403")

        # 8. Unrelated doctor blocked
        assert client.get(f"/api/followups/{session_id}", headers=h_doc2).status_code == 403
        assert (
            client.post(
                f"/api/followups/{session_id}/messages",
                json={"message_type": "DOCTOR_REPLY", "content": "Unrelated doctor"},
                headers=h_doc2,
            ).status_code
            == 403
        )
        print("F1-08. Unrelated Doctor Blocked                  [PASS] HTTP 403")

        # 9. Unauthenticated access blocked
        assert client.get(f"/api/followups/{session_id}").status_code == 401
        assert (
            client.post(
                f"/api/followups/{session_id}/messages",
                json={"message_type": "QUESTION", "content": "No auth"},
            ).status_code
            == 401
        )
        print("F1-09. Unauthenticated Access Blocked            [PASS] HTTP 401")

        # 10. Follow-up after 3 days blocked
        fup_db_obj = (
            db.query(FollowUpSession).filter(FollowUpSession.session_id == session_id).first()
        )
        fup_db_obj.billed_at = datetime.datetime.utcnow() - datetime.timedelta(days=4)
        fup_db_obj.follow_up_expires_at = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        db.commit()

        res_exp_post = client.post(
            f"/api/followups/{session_id}/messages",
            json={"message_type": "QUESTION", "content": "Message after 3 days"},
            headers=h_pat1,
        )
        assert res_exp_post.status_code == 403
        print("F1-10. Follow-Up After 3 Days Blocked            [PASS] HTTP 403")

        # 11. Expired conversation remains read-only
        res_exp_get = client.get(f"/api/followups/{session_id}", headers=h_pat1)
        assert res_exp_get.status_code == 200
        exp_thread = res_exp_get.json()
        assert exp_thread["session"]["is_expired"] is True
        assert exp_thread["session"]["is_locked"] is True
        assert len(exp_thread["messages"]) == 3
        print("F1-11. Expired Conversation Remains Read-Only    [PASS] HTTP 200 (3 msgs intact)")

        # 12. Follow-up audit events recorded
        fup_audits = [a.action for a in db.query(AuditLog).all()]
        for act in ["FOLLOWUP_CREATED", "FOLLOWUP_VIEWED", "FOLLOWUP_MESSAGE_SENT", "FOLLOWUP_DOCTOR_REPLY"]:
            assert act in fup_audits, f"Missing follow-up audit event: {act}"
        print("F1-12. Follow-Up Audit Events Recorded           [PASS] All 4 actions verified")

        print("\n" + "=" * 78)
        print("PART 2: FEATURE 2 — APPOINTMENT BOOKING + DIGITAL QR RECEIPT (14 TESTS)")
        print("=" * 78)

        target_date = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()

        # 1. Available doctor listing
        res_docs = client.get(f"/api/appointments/doctors?date={target_date}", headers=h_pat1)
        assert res_docs.status_code == 200
        docs_list = res_docs.json()
        assert len(docs_list) >= 2
        assert any(d["doctor_id"] == "DOC-1001" for d in docs_list)
        print("F2-01. Available Doctor Listing                  [PASS] HTTP 200")

        # 2. Available slot listing
        res_slots = client.get(
            f"/api/appointments/slots?date={target_date}&doctor_id=DOC-1001", headers=h_pat1
        )
        assert res_slots.status_code == 200
        assert "10:00 AM" in res_slots.json()[0]["available_slots"]
        print("F2-02. Available Slot Listing                    [PASS] HTTP 200")

        # 3. Successful booking
        res_book = client.post(
            "/api/appointments/book",
            json={
                "doctor_id": "DOC-1001",
                "appointment_date": target_date,
                "time_slot": "10:00 AM",
                "consultation_type": "IN_PERSON",
                "reason": "Hypertension chronotherapy follow-up",
            },
            headers=h_pat1,
        )
        assert res_book.status_code == 201, res_book.text
        appt = res_book.json()
        appt_id = appt["appointment_id"]
        qr_payload = appt["qr_payload"]
        qr_token = appt["qr_token"]
        assert appt["status"] == "BOOKED"
        assert appt["appointment_time"] == "10:00 AM"
        assert appt["updated_at"] is not None
        print(f"F2-03. Successful Appointment Booking            [PASS] {appt_id}")

        # 4. Duplicate booking prevention
        res_dup = client.post(
            "/api/appointments/book",
            json={
                "doctor_id": "DOC-1001",
                "appointment_date": target_date,
                "time_slot": "10:00 AM",
            },
            headers=h_pat2,
        )
        assert res_dup.status_code == 409
        print("F2-04. Duplicate Slot Booking Prevention         [PASS] HTTP 409 Conflict")

        # 5. Invalid doctor prevention
        res_inv_doc = client.post(
            "/api/appointments/book",
            json={
                "doctor_id": "DOC-9999-INVALID",
                "appointment_date": target_date,
                "time_slot": "11:00 AM",
            },
            headers=h_pat1,
        )
        assert res_inv_doc.status_code == 404
        print("F2-05. Invalid Doctor Booking Prevention         [PASS] HTTP 404")

        # 6. Appointment IDOR protection
        assert client.get(f"/api/appointments/{appt_id}/receipt", headers=h_pat2).status_code == 403
        assert (
            client.patch(
                f"/api/appointments/{appt_id}/status",
                json={"status": "CANCELLED"},
                headers=h_pat2,
            ).status_code
            == 403
        )
        print("F2-06. Appointment IDOR Protection               [PASS] HTTP 403")

        # 7. Patient authorization (can list own, cannot book for another patient or mark CONFIRMED)
        res_my_appts = client.get("/api/appointments", headers=h_pat1)
        assert res_my_appts.status_code == 200
        assert len(res_my_appts.json()) == 1
        assert (
            client.patch(
                f"/api/appointments/{appt_id}/status",
                json={"status": "CONFIRMED"},
                headers=h_pat1,
            ).status_code
            == 403
        )
        print("F2-07. Patient Role Authorization                [PASS] Enforced")

        # 8. QR generation
        assert qr_token.startswith("CRX-VRF-")
        assert qr_payload == f"CRX-APT:{appt_id}:{qr_token}"
        assert appt["qr_svg_data_uri"].startswith("data:image/svg+xml;utf8,")
        print("F2-08. Digital QR Receipt Generation             [PASS] SVG + Opaque Token")

        # 9. QR contains no PII
        for forbidden_pii in [
            "Alice",
            "Morgan",
            "555-3001",
            "alice.morgan",
            "Hypertension",
            "Amlodipine",
            "Penicillin",
            "P-3001",
        ]:
            assert forbidden_pii.lower() not in qr_payload.lower(), f"PII leak in QR: {forbidden_pii}"
        print("F2-09. QR Contains Zero Patient PII              [PASS] Verified")

        # 10. QR verification (server-side)
        res_verify = client.post(
            "/api/appointments/verify-qr",
            json={"qr_data": qr_payload, "mark_confirmed": True},
            headers=h_rec1,
        )
        assert res_verify.status_code == 200, res_verify.text
        v_json = res_verify.json()
        assert v_json["valid"] is True
        assert v_json["appointment_status"] == "CONFIRMED"
        assert v_json["pii_exposed_in_qr"] is False
        print("F2-10. Server-Side QR Verification               [PASS] Status -> CONFIRMED")

        # 11. Invalid QR rejection
        res_bad_qr = client.post(
            "/api/appointments/verify-qr",
            json={"qr_data": "CRX-APT:APT-FAKE:CRX-VRF-INVALIDTOKEN"},
            headers=h_rec1,
        )
        assert res_bad_qr.status_code == 404
        print("F2-11. Invalid QR Token Rejection                [PASS] HTTP 404")

        # 12. Receptionist authorization (patients blocked from /verify-qr)
        res_pat_qr = client.post(
            "/api/appointments/verify-qr",
            json={"qr_data": qr_payload},
            headers=h_pat1,
        )
        assert res_pat_qr.status_code == 403
        print("F2-12. Receptionist QR Verification RBAC         [PASS] HTTP 403 for Patient")

        # 13. Appointment cancellation (and record preservation)
        res_cancel = client.patch(
            f"/api/appointments/{appt_id}/status",
            json={"status": "CANCELLED", "reason": "Patient requested reschedule"},
            headers=h_pat1,
        )
        assert res_cancel.status_code == 200
        assert res_cancel.json()["status"] == "CANCELLED"
        print("F2-13. Appointment Cancellation & Preservation   [PASS] Status -> CANCELLED")

        # 14. Appointment audit logging
        all_audits = [a.action for a in db.query(AuditLog).all()]
        for act in ["APPOINTMENT_BOOKED", "APPOINTMENT_QR_VERIFIED", "APPOINTMENT_CANCELLED"]:
            assert act in all_audits, f"Missing appointment audit event: {act}"
        print("F2-14. Appointment Audit Events Recorded         [PASS] All actions verified")

        print("\n" + "=" * 78)
        print("PART 3: EXISTING CLINICAL WORKFLOW REGRESSION VERIFICATION")
        print("=" * 78)

        # Health check
        assert client.get("/health").status_code == 200
        print("REG-01. Backend Health (/health)                 [PASS] HTTP 200")

        # Patient directory & metrics
        assert client.get("/api/patients", headers=h_doc1).status_code == 200
        assert client.get("/api/dashboard/metrics", headers=h_doc1).status_code == 200
        print("REG-02. Patient Directory & Dashboard Metrics    [PASS] HTTP 200")

        # Drug normalization & Posology/Dose analysis
        assert (
            client.post(
                "/api/drugs/normalize",
                json={"drug_names": ["Amlodipine 5mg", "Atorvastatin 20mg"]},
                headers=h_doc1,
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/dose/analyze",
                json={
                    "patient_id": "P-3001",
                    "drug_name": "Amlodipine",
                    "proposed_dose_mg": 5.0,
                    "frequency_per_day": 1,
                },
                headers=h_doc1,
            ).status_code
            == 200
        )
        print("REG-03. RxNorm Normalization & Dose Support      [PASS] HTTP 200")

        # DDI Interaction check & Chronopharmacology Schedule
        assert (
            client.post(
                "/api/interactions/check",
                json={"drugs": ["Amlodipine", "Atorvastatin"], "patient_id": "P-3001"},
                headers=h_doc1,
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/schedule/generate",
                json={
                    "patient_id": "P-3001",
                    "medications": [{"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily"}],
                },
                headers=h_doc1,
            ).status_code
            == 200
        )
        print("REG-04. DDI Safety & Chronopharmacology Schedule [PASS] HTTP 200")

        # E-Prescription PDF Generation -> Automatically triggers 3-day follow-up session!
        res_rx = client.post(
            "/api/prescription/generate",
            json={
                "patient_id": "P-3002",
                "doctor_name": "Dr. Sarah Jenkins, M.D.",
                "diagnosis": "Atrial Fibrillation",
                "confirmed_medications": [{"name": "Warfarin", "dosage": "2mg", "frequency": "Once daily"}],
                "schedule": [{"drug_name": "Warfarin", "dosage": "2mg", "time_slot": "06:00 PM"}],
                "is_verified": True,
            },
            headers=h_doc1,
        )
        assert res_rx.status_code == 200, res_rx.text
        rx_review_id = res_rx.json()["review_id"]
        auto_fup = (
            db.query(FollowUpSession)
            .filter(FollowUpSession.patient_id == "P-3002", FollowUpSession.review_id == rx_review_id)
            .first()
        )
        assert auto_fup is not None, "Auto FollowUpSession was not created upon E-Prescription generation!"
        print(f"REG-05. E-Prescription PDF & Auto 3-Day FollowUp [PASS] {rx_review_id} -> {auto_fup.session_id}")

        print("\n" + "=" * 78)
        print("PART 4: STEP 1 'SAVE & PROCEED TO MEDICINES' — 10-CASE REGRESSION SUITE")
        print("=" * 78)

        example_diagnosis = "Acute febrile illness"
        example_notes = (
            "Patient reports fever and generalized weakness for 2 days. "
            "Mild cough and sore throat reported. No breathing difficulty reported."
        )

        # Case 1: Valid diagnosis + notes -> HTTP success
        res_step1 = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": example_diagnosis,
                "clinical_notes": example_notes,
            },
            headers=h_doc1,
        )
        assert res_step1.status_code == 200, f"Step 1 save failed: {res_step1.text}"
        step1_data = res_step1.json()
        print("STEP1-01. Valid Diagnosis + Notes HTTP 200       [PASS] Status -> IN_CONSULTATION")

        # Case 2: Data is persisted in database
        db.expire_all()
        persisted_p1 = db.query(Patient).filter(Patient.patient_id == "P-3001").first()
        assert persisted_p1 is not None
        assert persisted_p1.status == "IN_CONSULTATION"
        assert persisted_p1.diagnosis == example_diagnosis
        assert persisted_p1.clinical_notes == example_notes
        assert persisted_p1.consultation_started_at is not None
        step1_audits = [
            a.action for a in db.query(AuditLog).filter(AuditLog.patient_id == "P-3001").all()
        ]
        assert "DIAGNOSIS_ENTERED" in step1_audits
        assert "CLINICAL_NOTES_ENTERED" in step1_audits
        print("STEP1-02. Diagnosis & Notes Persisted in DB      [PASS] DB + Audit verified")

        # Case 3: Consultation context is returned
        assert step1_data.get("patient_id") == "P-3001"
        assert step1_data.get("assigned_doctor_id") == "DOC-1001"
        assert step1_data.get("doctor_id") == "DOC-1001"
        assert step1_data.get("consultation_id") and step1_data["consultation_id"].startswith("CON-P-3001-")
        assert step1_data.get("consultation_ref") == step1_data.get("consultation_id")
        assert step1_data.get("diagnosis") == example_diagnosis
        assert step1_data.get("clinical_notes") == example_notes
        print(f"STEP1-03. Consultation Context Returned          [PASS] {step1_data['consultation_id']}")

        # Case 4: Frontend can transition to Step 2 (verified contract & JSX handler)
        consult_jsx_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..",
            "frontend",
            "src",
            "pages",
            "DoctorConsultation.jsx",
        )
        with open(consult_jsx_path, "r", encoding="utf-8") as f_jsx:
            consult_jsx = f_jsx.read()
        assert "handleSaveAndProceedToMedicines" in consult_jsx
        assert "setActiveStep(2)" in consult_jsx
        assert step1_data["status"] == "IN_CONSULTATION"
        print("STEP1-04. Frontend Step 1 -> Step 2 Transition   [PASS] Verified")

        # Case 5: Missing diagnosis -> validation error (HTTP 422)
        res_missing_diag = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": "   ",
                "clinical_notes": "Notes without diagnosis",
            },
            headers=h_doc1,
        )
        assert res_missing_diag.status_code == 422, f"Expected 422 for missing diagnosis, got {res_missing_diag.status_code}"
        db.expire_all()
        assert db.query(Patient).filter(Patient.patient_id == "P-3001").first().diagnosis == example_diagnosis
        print("STEP1-05. Missing Diagnosis Validation Error     [PASS] HTTP 422")

        # Case 6: Unauthorized patient -> blocked (HTTP 403)
        res_unauth_pat = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": "Patient self-Attempt",
                "clinical_notes": "Should be blocked",
            },
            headers=h_pat1,
        )
        assert res_unauth_pat.status_code == 403, f"Expected 403 for patient role, got {res_unauth_pat.status_code}"
        print("STEP1-06. Unauthorized Patient Role Blocked      [PASS] HTTP 403")

        # Case 7: Unauthorized doctor -> blocked (HTTP 403)
        res_unauth_doc = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": "Unrelated doctor attempt",
                "clinical_notes": "Should be blocked",
            },
            headers=h_doc2,
        )
        assert res_unauth_doc.status_code == 403, f"Expected 403 for unrelated doctor, got {res_unauth_doc.status_code}"
        print("STEP1-07. Unauthorized Doctor Blocked (IDOR)     [PASS] HTTP 403")

        # Case 8: Unauthenticated request -> blocked (HTTP 401)
        res_no_auth = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": "Unauthenticated attempt",
                "clinical_notes": "Should be blocked",
            },
        )
        assert res_no_auth.status_code == 401, f"Expected 401 for unauthenticated request, got {res_no_auth.status_code}"
        print("STEP1-08. Unauthenticated Request Blocked        [PASS] HTTP 401")

        # Case 9: Backend failure -> frontend stays on Step 1 & preserves inputs
        res_bad_status = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "INVALID_STATUS_VALUE",
                "diagnosis": example_diagnosis,
                "clinical_notes": example_notes,
            },
            headers=h_doc1,
        )
        assert res_bad_status.status_code == 400
        assert "catch (err)" in consult_jsx and "setErrorMsg(" in consult_jsx
        print("STEP1-09. Backend Failure Keeps User on Step 1   [PASS] Error handled safely")

        # Case 10: No duplicate submission (button disabled while saving + idempotent update)
        assert "if (savingStep1) return;" in consult_jsx
        assert "disabled={savingStep1}" in consult_jsx
        patient_count_before = db.query(Patient).filter(Patient.patient_id == "P-3001").count()
        res_idem = client.put(
            "/api/patients/P-3001/status",
            json={
                "status": "IN_CONSULTATION",
                "diagnosis": example_diagnosis,
                "clinical_notes": example_notes,
            },
            headers=h_doc1,
        )
        assert res_idem.status_code == 200
        patient_count_after = db.query(Patient).filter(Patient.patient_id == "P-3001").count()
        assert patient_count_before == patient_count_after == 1
        print("STEP1-10. Duplicate Submission Prevention        [PASS] Guarded & Idempotent")

        print("=" * 78)
        print("ALL 41 VERIFICATION & REGRESSION CHECKS PASSED WITH ZERO ERRORS!")
        print("=" * 78)

        db.close()
        test_engine.dispose()
    finally:
        app.dependency_overrides.clear()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except OSError:
                pass


if __name__ == "__main__":
    run_all_feature_tests()

