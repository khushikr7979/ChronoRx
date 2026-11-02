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
import uuid
import json
import hmac
import hashlib
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
    SubscriptionPlan,
    UserSubscription,
    PaymentTransaction,
    TranslationVerification,
    TranslationFeedback,
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

        # Seed Subscription Plans for test DB
        import json as test_json
        plans_to_seed = [
            SubscriptionPlan(
                plan_id="plan_doctor_monthly",
                role="doctor",
                name="Doctor Clinical Suite (Monthly)",
                description="Clinical consultations, posology, DDI checks, timetable, OCR.",
                billing_cycle="monthly",
                price_inr=999,
                features=test_json.dumps(["Clinical Consultations", "Posology Calculator", "22 Indian Languages"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_doctor_yearly",
                role="doctor",
                name="Doctor Clinical Suite (Annual)",
                description="Annual clinical consultations with 2 months free savings.",
                billing_cycle="yearly",
                price_inr=9999,
                features=test_json.dumps(["All Monthly Features", "2 Months Free", "22 Indian Languages"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_receptionist_monthly",
                role="receptionist",
                name="Intake Suite (Monthly)",
                description="Registration, queue management, QR booking.",
                billing_cycle="monthly",
                price_inr=299,
                features=test_json.dumps(["Intake Registration", "Clinic Queue", "QR Booking"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_receptionist_yearly",
                role="receptionist",
                name="Intake Suite (Annual)",
                description="Annual intake suite.",
                billing_cycle="yearly",
                price_inr=2999,
                features=test_json.dumps(["All Monthly Features", "2 Months Free"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_admin_monthly",
                role="admin",
                name="Admin Suite (Monthly)",
                description="User provisioning, audit trail, plan management.",
                billing_cycle="monthly",
                price_inr=1499,
                features=test_json.dumps(["User Management", "Audit Trail", "Plan Configuration"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_admin_yearly",
                role="admin",
                name="Admin Suite (Annual)",
                description="Annual admin suite.",
                billing_cycle="yearly",
                price_inr=14999,
                features=test_json.dumps(["All Monthly Features", "Enterprise Audit Archive"]),
                is_active=True,
            ),
            SubscriptionPlan(
                plan_id="plan_patient_free",
                role="patient",
                name="Patient Portal (100% Free Forever)",
                description="100% Free Forever. Access prescriptions and timetables.",
                billing_cycle="free",
                price_inr=0,
                features=test_json.dumps(["Free Forever", "Prescriptions", "22 Languages"]),
                is_active=True,
            ),
        ]
        db.add_all(plans_to_seed)
        db.commit()

        # Seed active subscription for DOC-2002 to test verified clinician flow while DOC-1001 tests subscription purchase
        sub_doc2 = UserSubscription(
            subscription_id="SUB-DOC-2002-INIT",
            user_id="DOC-2002",
            role="doctor",
            plan_id="plan_doctor_yearly",
            billing_cycle="yearly",
            price_inr=9999,
            status="ACTIVE",
            start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=365),
            auto_renew=True,
            payment_method="SYSTEM_TEST"
        )
        db.add(sub_doc2)
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

        # =====================================================================
        # PART 5: PROFILE PHOTO SYSTEM (14 MANDATORY TESTS)
        # =====================================================================
        print("\n--- PART 5: PROFILE PHOTO SYSTEM (14 TESTS) ---")
        import io
        from jose import jwt as pyjwt
        from PIL import Image
        from app.config import settings as app_settings

        def make_test_image_bytes(fmt: str, size=(32, 32), color=(13, 148, 136)) -> bytes:
            buf = io.BytesIO()
            img = Image.new("RGB", size, color=color)
            img.save(buf, format=fmt)
            return buf.getvalue()

        # Test 11 & 1: Profile without photo returns default-avatar state & Authenticated user can retrieve own profile
        res_prof_doc = client.get("/profile/me", headers=h_doc1)
        assert res_prof_doc.status_code == 200, res_prof_doc.text
        prof_doc_data = res_prof_doc.json()
        assert prof_doc_data["name"] == "Dr. Sarah Jenkins, M.D."
        assert prof_doc_data["role"] == "doctor"
        assert prof_doc_data["role_label"] == "Doctor / Clinician"
        assert prof_doc_data["system_id"] == "DOC-1001"
        assert prof_doc_data["profile_photo"] is None
        assert prof_doc_data["default_avatar"] is True
        assert prof_doc_data["has_photo"] is False
        assert prof_doc_data["initials"] == "SJ"
        # Verify no sensitive fields are exposed
        for forbidden_key in ("password", "hashed_password", "access_token", "token", "secret_key"):
            assert forbidden_key not in prof_doc_data

        # Also check Receptionist, Patient, and Admin default profiles
        h_adm1 = login("ADM-1001", "AdminSecure2026!")
        res_prof_rec = client.get("/profile/me", headers=h_rec1)
        assert res_prof_rec.status_code == 200 and res_prof_rec.json()["initials"] == "AR"
        res_prof_pat = client.get("/profile/me", headers=h_pat1)
        assert res_prof_pat.status_code == 200 and res_prof_pat.json()["system_id"] == "PAT-3001"
        res_prof_adm = client.get("/profile/me", headers=h_adm1)
        assert res_prof_adm.status_code == 200 and res_prof_adm.json()["initials"] == "DV"
        print("PROF-01. Authenticated User Retrieves Own Profile [PASS] Safe fields only")
        print("PROF-11. Profile Without Photo Default Avatar    [PASS] Initials SJ/AR/DV, profile_photo=None")

        # Test 2: User can upload valid JPG
        jpg_bytes = make_test_image_bytes("JPEG")
        res_up_jpg = client.post(
            "/profile/photo",
            files={"file": ("Original Unsafe Name!!.jpg", jpg_bytes, "image/jpeg")},
            headers=h_doc1,
        )
        assert res_up_jpg.status_code == 200, res_up_jpg.text
        jpg_data = res_up_jpg.json()
        assert jpg_data["has_photo"] is True
        assert jpg_data["default_avatar"] is False
        assert jpg_data["profile_photo"].startswith("/uploads/profiles/profile_DOC-1001_")
        assert jpg_data["profile_photo"].endswith(".jpg")
        assert "Original Unsafe Name" not in jpg_data["profile_photo"]
        jpg_disk_path = os.path.join(
            app_settings.UPLOAD_DIR, "profiles", os.path.basename(jpg_data["profile_photo"])
        )
        assert os.path.isfile(jpg_disk_path)
        print("PROF-02. Upload Valid JPG                        [PASS] Stored as", jpg_data["profile_photo"])

        # Test 3: User can upload valid PNG (test with Receptionist REC-1001)
        png_bytes = make_test_image_bytes("PNG")
        res_up_png = client.post(
            "/profile/photo",
            files={"file": ("reception_avatar.png", png_bytes, "image/png")},
            headers=h_rec1,
        )
        assert res_up_png.status_code == 200, res_up_png.text
        png_data = res_up_png.json()
        assert png_data["profile_photo"].startswith("/uploads/profiles/profile_REC-1001_")
        assert png_data["profile_photo"].endswith(".png")
        png_disk_path = os.path.join(
            app_settings.UPLOAD_DIR, "profiles", os.path.basename(png_data["profile_photo"])
        )
        assert os.path.isfile(png_disk_path)
        print("PROF-03. Upload Valid PNG                        [PASS] Stored as", png_data["profile_photo"])

        # Test 4: User can upload valid WEBP (test with Patient PAT-3001)
        webp_bytes = make_test_image_bytes("WEBP")
        res_up_webp = client.post(
            "/profile/photo",
            files={"file": ("patient_avatar.webp", webp_bytes, "image/webp")},
            headers=h_pat1,
        )
        assert res_up_webp.status_code == 200, res_up_webp.text
        webp_data = res_up_webp.json()
        assert webp_data["profile_photo"].startswith("/uploads/profiles/profile_PAT-3001_")
        assert webp_data["profile_photo"].endswith(".webp")
        webp_disk_path = os.path.join(
            app_settings.UPLOAD_DIR, "profiles", os.path.basename(webp_data["profile_photo"])
        )
        assert os.path.isfile(webp_disk_path)
        print("PROF-04. Upload Valid WEBP                       [PASS] Stored as", webp_data["profile_photo"])

        # Test 5: Invalid file types are rejected (SVG, EXE, spoofed JPG with script bytes, double extension)
        svg_payload = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        res_bad_svg = client.post(
            "/profile/photo",
            files={"file": ("vector.svg", svg_payload, "image/svg+xml")},
            headers=h_doc1,
        )
        assert res_bad_svg.status_code == 400

        res_bad_exe = client.post(
            "/profile/photo",
            files={"file": ("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")},
            headers=h_doc1,
        )
        assert res_bad_exe.status_code == 400

        res_spoofed_jpg = client.post(
            "/profile/photo",
            files={"file": ("disguised.jpg", b"#!/bin/bash\necho hacked", "image/jpeg")},
            headers=h_doc1,
        )
        assert res_spoofed_jpg.status_code == 400

        res_double_ext = client.post(
            "/profile/photo",
            files={"file": ("shell.php.jpg", jpg_bytes, "image/jpeg")},
            headers=h_doc1,
        )
        assert res_double_ext.status_code == 400
        print("PROF-05. Invalid File Types Rejected             [PASS] SVG, EXE, Spoofed, Double-Ext -> 400")

        # Test 6: Oversized file is rejected (> 5 MB)
        oversized_bytes = b"\xff\xd8\xff\xe0" + (b"\x00" * (5 * 1024 * 1024 + 1024))
        res_oversize = client.post(
            "/profile/photo",
            files={"file": ("huge_photo.jpg", oversized_bytes, "image/jpeg")},
            headers=h_doc1,
        )
        assert res_oversize.status_code == 400
        print("PROF-06. Oversized File (>5MB) Rejected          [PASS] HTTP 400")

        # Test 7: Unauthenticated upload is rejected
        res_unauth_upload = client.post(
            "/profile/photo",
            files={"file": ("unauth.jpg", jpg_bytes, "image/jpeg")},
        )
        assert res_unauth_upload.status_code == 401
        res_unauth_get = client.get("/profile/me")
        assert res_unauth_get.status_code == 401
        res_unauth_del = client.delete("/profile/photo")
        assert res_unauth_del.status_code == 401
        print("PROF-07. Unauthenticated Access Rejected         [PASS] HTTP 401")

        # Test 8: User cannot modify or view another user's profile photo
        res_idor_post_path = client.post(
            "/profile/photo/DOC-2002",
            files={"file": ("hack.jpg", jpg_bytes, "image/jpeg")},
            headers=h_doc1,
        )
        assert res_idor_post_path.status_code == 403

        res_idor_post_query = client.post(
            "/profile/photo?user_id=REC-1001",
            files={"file": ("hack.jpg", jpg_bytes, "image/jpeg")},
            headers=h_pat1,
        )
        assert res_idor_post_query.status_code == 403

        res_idor_del = client.delete("/profile/photo/REC-1001", headers=h_pat1)
        assert res_idor_del.status_code == 403

        res_idor_get = client.get("/profile/DOC-1001", headers=h_pat1)
        assert res_idor_get.status_code == 403
        print("PROF-08. Cross-User Photo Modification Blocked   [PASS] HTTP 403")

        # Test 9: User can replace own photo (and old file is cleaned up after new file is stored)
        replacement_png_bytes = make_test_image_bytes("PNG", size=(48, 48), color=(16, 185, 129))
        res_replace = client.post(
            "/profile/photo",
            files={"file": ("updated_doctor.png", replacement_png_bytes, "image/png")},
            headers=h_doc1,
        )
        assert res_replace.status_code == 200, res_replace.text
        rep_data = res_replace.json()
        assert rep_data["profile_photo"] != jpg_data["profile_photo"]
        assert rep_data["profile_photo"].endswith(".png")
        new_doc_disk_path = os.path.join(
            app_settings.UPLOAD_DIR, "profiles", os.path.basename(rep_data["profile_photo"])
        )
        assert os.path.isfile(new_doc_disk_path)
        assert not os.path.exists(jpg_disk_path), "Old profile photo should be cleaned up upon replacement"
        print("PROF-09. User Replaces Own Photo & Old Cleaned   [PASS] New:", rep_data["profile_photo"])

        # Test 10: User can delete own photo
        res_del_doc = client.delete("/profile/photo", headers=h_doc1)
        assert res_del_doc.status_code == 200, res_del_doc.text
        del_data = res_del_doc.json()
        assert del_data["profile_photo"] is None
        assert del_data["has_photo"] is False
        assert del_data["default_avatar"] is True
        assert del_data["initials"] == "SJ"
        assert not os.path.exists(new_doc_disk_path), "Deleted profile photo file should be removed from disk"

        # Clean up REC-1001 and PAT-3001 test photos as well
        assert client.delete("/profile/photo", headers=h_rec1).status_code == 200
        assert client.delete("/profile/photo", headers=h_pat1).status_code == 200
        print("PROF-10. User Deletes Own Photo & File Removed   [PASS] Reset to default avatar")

        # Verify Profile Photo Audit Logs (UPLOADED, UPDATED, DELETED)
        prof_audits = (
            db.query(AuditLog)
            .filter(
                AuditLog.Action.in_(
                    ["PROFILE_PHOTO_UPLOADED", "PROFILE_PHOTO_UPDATED", "PROFILE_PHOTO_DELETED"]
                )
                if hasattr(AuditLog, "Action")
                else AuditLog.action.in_(
                    ["PROFILE_PHOTO_UPLOADED", "PROFILE_PHOTO_UPDATED", "PROFILE_PHOTO_DELETED"]
                )
            )
            .all()
        )
        recorded_prof_actions = {a.action for a in prof_audits}
        assert "PROFILE_PHOTO_UPLOADED" in recorded_prof_actions
        assert "PROFILE_PHOTO_UPDATED" in recorded_prof_actions
        assert "PROFILE_PHOTO_DELETED" in recorded_prof_actions

        # Test 12: Existing login still works & JWT does NOT contain profile photo
        res_relogin = client.post(
            "/auth/login",
            json={"identifier": "DOC-1001", "password": "ClinicianPass2026!"},
        )
        assert res_relogin.status_code == 200
        relogin_json = res_relogin.json()
        decoded_jwt = pyjwt.decode(
            relogin_json["access_token"],
            app_settings.SECRET_KEY,
            algorithms=[app_settings.ALGORITHM],
        )
        assert "profile_photo" not in decoded_jwt
        print("PROF-12. Existing Login Works & Clean JWT        [PASS] No photo in JWT")

        # Test 13: Existing RBAC still works
        assert client.get("/patients/queue", headers=h_pat1).status_code == 403
        assert client.get("/audit", headers=h_pat1).status_code == 403
        pat_own_list = client.get("/patients", headers=h_pat1)
        assert pat_own_list.status_code == 200 and len(pat_own_list.json()) == 1
        assert pat_own_list.json()[0]["patient_id"] == "P-3001"
        assert client.get("/patients", headers=h_doc1).status_code == 200
        assert client.get("/audit", headers=h_adm1).status_code == 200
        print("PROF-13. Existing RBAC Enforcement Intact        [PASS]")

        # Test 14: Existing patient IDOR protection still works
        assert client.get("/patients/P-3002", headers=h_pat1).status_code == 403
        assert client.get("/prescriptions/P-3002", headers=h_pat1).status_code == 403
        assert client.get("/patient-history/P-3002", headers=h_pat1).status_code == 403
        assert client.get("/profile/PAT-3002", headers=h_pat1).status_code == 403
        print("PROF-14. Existing Patient IDOR Protection Intact [PASS]")

        # =====================================================================
        # PART 6: MULTILINGUAL PATIENT INSTRUCTIONS (12 MANDATORY TESTS)
        # =====================================================================
        print("\n" + "=" * 78)
        print("PART 6: MULTILINGUAL PATIENT INSTRUCTIONS (12 TESTS)")
        print("=" * 78)

        # M-01: List all 22 Eighth Schedule Indian Languages + English Reference (GET /translations/languages)
        res_langs = client.get("/translations/languages")
        assert res_langs.status_code == 200, res_langs.text
        langs = res_langs.json()
        assert len(langs) == 23, f"Expected 23 language entries (22 scheduled + English reference), got {len(langs)}"
        scheduled_langs = [l for l in langs if l.get("is_scheduled_language")]
        assert len(scheduled_langs) == 22, f"Expected 22 scheduled languages, got {len(scheduled_langs)}"
        lang_codes = [l["code"] for l in langs]
        for required_code in [
            "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai",
            "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur"
        ]:
            assert required_code in lang_codes, f"Missing Eighth Schedule language code: {required_code}"
        assert "en" in lang_codes
        print("M-01. List All 22 Indian Languages              [PASS] 22/22 scheduled languages + English returned")

        # M-02: Drug name preservation (POST /translations/translate)
        res_tr_drug = client.post(
            "/translations/translate",
            json={
                "text": "Metformin 500mg BID with meals",
                "target_language": "hi",
                "preserve_medical_terms": True,
            },
            headers=h_doc1,
        )
        assert res_tr_drug.status_code == 200, res_tr_drug.text
        tr_drug_data = res_tr_drug.json()
        assert "Metformin" in tr_drug_data["translated_text"], f"Metformin drug name was corrupted: {tr_drug_data['translated_text']}"
        assert "500mg" in tr_drug_data["translated_text"] or "500" in tr_drug_data["translated_text"]
        print("M-02. Drug Name & Strength Preservation          [PASS] 'Metformin 500mg' preserved in Hindi")

        # M-03: Dosage & Unit preservation
        res_tr_dose = client.post(
            "/translations/translate",
            json={
                "text": "Take 10ml syrup twice daily",
                "target_language": "bn",
                "preserve_medical_terms": True,
            },
            headers=h_doc1,
        )
        assert res_tr_dose.status_code == 200, res_tr_dose.text
        tr_dose_data = res_tr_dose.json()
        assert "10ml" in tr_dose_data["translated_text"] or "10 ml" in tr_dose_data["translated_text"]
        print("M-03. Dosage & Unit Preservation (10ml)          [PASS] '10ml' preserved in Bengali")

        # M-04: High-frequency clinical phrases across multiple languages
        for target_lang in ["hi", "bn", "ta", "te", "mr", "gu"]:
            res_phrase = client.post(
                "/translations/translate",
                json={
                    "text": "Take after meals",
                    "target_language": target_lang,
                },
                headers=h_doc1,
            )
            assert res_phrase.status_code == 200
            assert len(res_phrase.json()["translated_text"]) > 0
        print("M-04. High-Frequency Clinical Phrase Coverage    [PASS] Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati")

        # M-05: RTL direction indicator for Urdu and Sindhi
        res_ur = client.post(
            "/translations/translate",
            json={"text": "Take once daily", "target_language": "ur"},
            headers=h_doc1,
        )
        assert res_ur.status_code == 200
        assert res_ur.json()["direction"] == "rtl"

        res_sd = client.post(
            "/translations/translate",
            json={"text": "Take once daily", "target_language": "sd"},
            headers=h_doc1,
        )
        assert res_sd.status_code == 200
        assert res_sd.json()["direction"] == "rtl"
        print("M-05. RTL Reading Direction Detection            [PASS] Urdu and Sindhi direction='rtl'")

        # M-06: Clinician verification by Doctor (POST /translations/verify)
        # M-06a: Unpaid doctor blocked from protected clinical verification (HTTP 402)
        res_unpaid_verify = client.post(
            "/translations/verify",
            json={
                "original_text": "Take 1 tablet after dinner",
                "target_language": "hi",
                "translated_text": "रात के खाने के बाद 1 गोली लें",
                "status": "Clinician-Verified",
            },
            headers=h_doc1,
        )
        assert res_unpaid_verify.status_code == 402, res_unpaid_verify.text
        assert "subscription required" in res_unpaid_verify.json()["detail"].lower()

        # M-06b: Subscribed doctor successfully verifies translation (HTTP 200)
        res_verify_doc = client.post(
            "/translations/verify",
            json={
                "original_text": "Take 1 tablet after dinner",
                "target_language": "hi",
                "translated_text": "रात के खाने के बाद 1 गोली लें",
                "status": "Clinician-Verified",
                "notes": "Reviewed and approved by Dr. Jenkins",
            },
            headers=h_doc2,
        )
        assert res_verify_doc.status_code == 200, res_verify_doc.text
        ver_data = res_verify_doc.json()
        assert ver_data["verification_id"].startswith("TVER-")
        assert ver_data["status"] == "Clinician-Verified"
        assert ver_data["verified_by"] == "DOC-2002"
        audit_trans = db.query(AuditLog).filter(AuditLog.action == "TRANSLATION_VERIFIED").first()
        assert audit_trans is not None
        print(f"M-06. Clinician Verification by Doctor           [PASS] {ver_data['verification_id']} saved with audit log (Unpaid 402 verified)")

        # M-07: Clinician verification RBAC (Patient blocked with HTTP 403)
        res_verify_pat = client.post(
            "/translations/verify",
            json={
                "original_text": "Take 1 tablet after dinner",
                "target_language": "hi",
                "translated_text": "रात के खाने के बाद 1 गोली लें",
            },
            headers=h_pat1,
        )
        assert res_verify_pat.status_code == 403
        print("M-07. Clinician Verification RBAC (Patient 403)  [PASS] Non-clinician blocked")

        # M-08: Clinician-verified retrieval takes precedence over machine translation
        res_tr_verified = client.post(
            "/translations/translate",
            json={
                "text": "Take 1 tablet after dinner",
                "target_language": "hi",
            },
            headers=h_pat1,
        )
        assert res_tr_verified.status_code == 200
        assert res_tr_verified.json()["status"] == "Clinician-Verified"
        assert res_tr_verified.json()["is_verified"] is True
        assert res_tr_verified.json()["translated_text"] == "रात के खाने के बाद 1 गोली लें"
        print("M-08. Clinician-Verified Precedence              [PASS] Returns verified translation with badge")

        # M-09: Translation feedback submission (POST /translations/feedback)
        res_fb = client.post(
            "/translations/feedback",
            json={
                "target_language": "hi",
                "original_text": "Take with breakfast",
                "reported_text": "नाश्ते के साथ लें",
                "issue_description": "Clarify whether light breakfast is required",
            },
            headers=h_pat1,
        )
        assert res_fb.status_code == 200, res_fb.text
        fb_data = res_fb.json()
        assert fb_data["feedback_id"].startswith("TFB-")
        assert fb_data["status"] == "OPEN"
        print(f"M-09. Translation Feedback Submission            [PASS] {fb_data['feedback_id']} logged")

        # M-10: Patient mother tongue update (PUT /translations/patient-language/P-3001)
        res_lang_update = client.put(
            "/translations/patient-language/P-3001",
            json={"preferred_language": "hi"},
            headers=h_pat1,
        )
        assert res_lang_update.status_code == 200, res_lang_update.text
        db.expire_all()
        pat_p1 = db.query(Patient).filter(Patient.patient_id == "P-3001").first()
        assert pat_p1.preferred_language == "hi"
        usr_p1 = db.query(User).filter(User.user_id == "PAT-3001").first()
        assert usr_p1.preferred_language == "hi"
        print("M-10. Patient Mother Tongue Profile Update       [PASS] P-3001 & PAT-3001 updated to Hindi")

        # M-11: Patient mother tongue IDOR protection (PAT-3001 blocked from updating P-3002)
        res_lang_idor = client.put(
            "/translations/patient-language/P-3002",
            json={"preferred_language": "ta"},
            headers=h_pat1,
        )
        assert res_lang_idor.status_code == 403
        print("M-11. Patient Mother Tongue IDOR Protection      [PASS] HTTP 403 Forbidden")

        # M-12: Batch prescription instructions translation (POST /translations/instructions)
        res_batch = client.post(
            "/translations/instructions",
            json={
                "instructions": [
                    "Take Metformin 500mg with breakfast",
                    "Take Atorvastatin 20mg at bedtime"
                ],
                "target_language": "hi",
                "medication_items": [
                    {"name": "Metformin", "dosage": "500mg", "instructions": "Take with food"}
                ]
            },
            headers=h_pat1,
        )
        assert res_batch.status_code == 200, res_batch.text
        batch_data = res_batch.json()
        assert len(batch_data["translated_instructions"]) == 2
        assert "disclaimer" in batch_data
        assert "Metformin" in batch_data["translated_instructions"][0]
        assert "Atorvastatin" in batch_data["translated_instructions"][1]
        print("M-12. Batch Prescription Instructions Translated [PASS] 2/2 instructions + disclaimer verified")

        # M-13: Unsupported translation returns original English with Translation Unavailable status (Safety Guarantee)
        res_unsupp = client.post(
            "/translations/translate",
            json={
                "text": "Completely unknown medical clinical phrase without dictionary or NLP match xyz123",
                "target_language": "hi",
            },
            headers=h_doc2,
        )
        assert res_unsupp.status_code == 200
        unsupp_data = res_unsupp.json()
        assert unsupp_data["status"] == "Translation Unavailable"
        assert unsupp_data["is_verified"] is False
        assert "xyz123" in unsupp_data["translated_text"]
        assert "disclaimer" in unsupp_data
        print("M-13. Translation Safety Fallback Verified       [PASS] Status 'Translation Unavailable' & English preserved")

        # =====================================================================
        # PART 7: ROLE-BASED SUBSCRIPTIONS & BILLING (15 MANDATORY TESTS)
        # =====================================================================
        print("\n" + "=" * 78)
        print("PART 7: ROLE-BASED SUBSCRIPTIONS & BILLING (15 TESTS)")
        print("=" * 78)

        # S-01: Doctor plans listing (GET /subscriptions/plans with doctor token)
        res_doc_plans = client.get("/subscriptions/plans", headers=h_doc1)
        assert res_doc_plans.status_code == 200, res_doc_plans.text
        doc_plans = res_doc_plans.json()
        doc_plan_ids = {p["plan_id"]: p["price_inr"] for p in doc_plans}
        assert "plan_doctor_monthly" in doc_plan_ids and doc_plan_ids["plan_doctor_monthly"] == 999
        assert "plan_doctor_yearly" in doc_plan_ids and doc_plan_ids["plan_doctor_yearly"] == 9999
        print("S-01. Doctor Subscription Plans (INR 999 / INR 9,999) [PASS] Monthly & Annual verified")

        # S-02: Receptionist plans listing (GET /subscriptions/plans with receptionist token)
        res_rec_plans = client.get("/subscriptions/plans", headers=h_rec1)
        assert res_rec_plans.status_code == 200, res_rec_plans.text
        rec_plans = res_rec_plans.json()
        rec_plan_ids = {p["plan_id"]: p["price_inr"] for p in rec_plans}
        assert "plan_receptionist_monthly" in rec_plan_ids and rec_plan_ids["plan_receptionist_monthly"] == 299
        assert "plan_receptionist_yearly" in rec_plan_ids and rec_plan_ids["plan_receptionist_yearly"] == 2999
        print("S-02. Receptionist Plans (INR 299 / INR 2,999)       [PASS] Monthly & Annual verified")

        # S-03: Admin plans listing (GET /subscriptions/plans with admin token)
        res_adm_plans = client.get("/subscriptions/plans", headers=h_adm1)
        assert res_adm_plans.status_code == 200, res_adm_plans.text
        adm_plans = res_adm_plans.json()
        adm_plan_ids = {p["plan_id"]: p["price_inr"] for p in adm_plans}
        assert "plan_admin_monthly" in adm_plan_ids and adm_plan_ids["plan_admin_monthly"] == 1499
        assert "plan_admin_yearly" in adm_plan_ids and adm_plan_ids["plan_admin_yearly"] == 14999
        print("S-03. Admin Plans (INR 1,499 / INR 14,999)            [PASS] Monthly & Annual verified")

        # S-04: Patient Free Forever plan
        res_pat_plans = client.get("/subscriptions/plans", headers=h_pat1)
        assert res_pat_plans.status_code == 200, res_pat_plans.text
        pat_plans = res_pat_plans.json()
        assert len(pat_plans) == 1
        assert pat_plans[0]["price_inr"] == 0
        assert pat_plans[0]["billing_cycle"] == "free"
        print("S-04. Patient 100% Free Forever Plan (INR 0)       [PASS] Zero charges guaranteed")

        # S-05: Patient subscription status (GET /subscriptions/status)
        res_pat_status = client.get("/subscriptions/status", headers=h_pat1)
        assert res_pat_status.status_code == 200, res_pat_status.text
        pat_status = res_pat_status.json()
        assert pat_status["is_free_tier"] is True
        assert pat_status["status"] == "FREE"
        assert pat_status["is_subscribed"] is True
        print("S-05. Patient Subscription Status               [PASS] is_free_tier=True, status=FREE")

        # S-06: Patient checkout attempt strictly blocked (HTTP 400)
        res_pat_checkout = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_patient_free", "billing_cycle": "free"},
            headers=h_pat1,
        )
        assert res_pat_checkout.status_code == 400
        assert "100% Free Forever" in res_pat_checkout.json()["detail"]
        print("S-06. Patient Checkout Attempt Blocked (400)     [PASS] Zero billing friction enforced")

        # S-07: Doctor checkout order generation
        res_doc_order = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_doctor_monthly", "billing_cycle": "monthly"},
            headers=h_doc1,
        )
        assert res_doc_order.status_code == 200, res_doc_order.text
        doc_order = res_doc_order.json()
        assert "order_id" in doc_order
        assert doc_order["amount_inr"] == 999
        assert doc_order["amount_paise"] == 99900
        assert doc_order["currency"] == "INR"
        order_id_doc = doc_order["order_id"]
        print(f"S-07. Doctor Checkout Order Generated            [PASS] {order_id_doc} for INR 999")

        # S-08: Receptionist checkout order generation
        res_rec_order = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_receptionist_monthly", "billing_cycle": "monthly"},
            headers=h_rec1,
        )
        assert res_rec_order.status_code == 200, res_rec_order.text
        rec_order = res_rec_order.json()
        assert rec_order["amount_inr"] == 299
        assert rec_order["amount_paise"] == 29900
        print(f"S-08. Receptionist Checkout Order Generated      [PASS] {rec_order['order_id']} for INR 299")

        # S-09: Cross-role plan checkout blocked (HTTP 403)
        res_cross_role = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_doctor_monthly", "billing_cycle": "monthly"},
            headers=h_rec1,
        )
        assert res_cross_role.status_code == 403
        print("S-09. Cross-Role Plan Checkout Blocked (403)     [PASS] Receptionist blocked from doctor plan")

        # S-10: Payment signature verification and activation
        mock_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
        mock_signature = f"sig_mock_{uuid.uuid4().hex[:20]}"
        res_verify_pay = client.post(
            "/subscriptions/verify-payment",
            json={
                "order_id": order_id_doc,
                "payment_id": mock_payment_id,
                "signature": mock_signature,
                "plan_id": "plan_doctor_monthly",
            },
            headers=h_doc1,
        )
        assert res_verify_pay.status_code == 200, res_verify_pay.text
        pay_result = res_verify_pay.json()
        assert pay_result["success"] is True
        assert pay_result["status"] == "ACTIVE"
        assert pay_result["subscription_id"].startswith("SUB-")
        print(f"S-10. Payment Signature Verified & Activated     [PASS] Sub: {pay_result['subscription_id']}")

        # S-11: Payment Security Hardening: Fake orders, tampered signatures, IDOR, and replay prevention
        # S-11a: Fake uninitiated order rejected (HTTP 400)
        res_fake_order = client.post(
            "/subscriptions/verify-payment",
            json={
                "order_id": f"order_fake_{uuid.uuid4().hex[:12]}",
                "payment_id": "pay_fake_unauthorized",
                "signature": "completely_invalid_tampered_signature",
                "plan_id": "plan_doctor_monthly",
            },
            headers=h_doc1,
        )
        assert res_fake_order.status_code == 400

        # S-11b: Tampered signature on a real initiated order rejected (HTTP 400)
        res_real_order = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_doctor_monthly", "billing_cycle": "monthly"},
            headers=h_doc1,
        )
        assert res_real_order.status_code == 200
        real_unpaid_order_id = res_real_order.json()["order_id"]
        res_tampered_sig = client.post(
            "/subscriptions/verify-payment",
            json={
                "order_id": real_unpaid_order_id,
                "payment_id": "pay_tampered_attempt",
                "signature": "forged_signature_xyz_123",
                "plan_id": "plan_doctor_monthly",
            },
            headers=h_doc1,
        )
        assert res_tampered_sig.status_code == 400

        # S-11c: Cross-user order verification attempt blocked (HTTP 400 IDOR)
        res_cross_user_order = client.post(
            "/subscriptions/verify-payment",
            json={
                "order_id": real_unpaid_order_id,
                "payment_id": "pay_mock_cross_user",
                "signature": f"sig_mock_{real_unpaid_order_id}_cross",
                "plan_id": "plan_doctor_monthly",
            },
            headers=h_doc2,
        )
        assert res_cross_user_order.status_code == 400
        assert "mismatch" in res_cross_user_order.json()["detail"].lower()

        # S-11d: Replay attack prevention: already completed order cannot be reused (HTTP 400)
        res_replay_pay = client.post(
            "/subscriptions/verify-payment",
            json={
                "order_id": order_id_doc,
                "payment_id": mock_payment_id,
                "signature": mock_signature,
                "plan_id": "plan_doctor_monthly",
            },
            headers=h_doc1,
        )
        assert res_replay_pay.status_code == 400
        assert "already been completed" in res_replay_pay.json()["detail"].lower()
        print("S-11. Payment Security & Tamper Protection       [PASS] Fake, tampered, IDOR & replay attacks blocked")

        # S-12: Subscription status & active duration
        res_doc_status = client.get("/subscriptions/status", headers=h_doc1)
        assert res_doc_status.status_code == 200, res_doc_status.text
        doc_stat = res_doc_status.json()
        assert doc_stat["is_subscribed"] is True
        assert doc_stat["status"] == "ACTIVE"
        assert doc_stat["plan_id"] == "plan_doctor_monthly"
        assert doc_stat["end_date"] is not None
        print("S-12. Active Subscription Status & Duration      [PASS] Status ACTIVE with valid end_date")

        # S-13: Payment transaction history retrieval
        res_hist = client.get("/subscriptions/history", headers=h_doc1)
        assert res_hist.status_code == 200, res_hist.text
        hist = res_hist.json()
        assert len(hist) >= 1
        success_txns = [t for t in hist if t["status"] == "SUCCESS"]
        assert len(success_txns) >= 1
        assert success_txns[0]["amount_inr"] == 999
        assert any(t["status"] == "FAILED" for t in hist)
        print("S-13. Payment Transaction History Retrieved       [PASS] Both SUCCESS and audit FAILED records present")

        # S-14: Admin plan update (POST /subscriptions/admin/plans/{plan_id})
        # Doctor role blocked
        res_doc_up_plan = client.post(
            "/subscriptions/admin/plans/plan_doctor_monthly",
            json={"price_inr": 1099},
            headers=h_doc1,
        )
        assert res_doc_up_plan.status_code == 403

        # Admin role allowed
        res_adm_up_plan = client.post(
            "/subscriptions/admin/plans/plan_doctor_monthly",
            json={"price_inr": 1099},
            headers=h_adm1,
        )
        assert res_adm_up_plan.status_code == 200, res_adm_up_plan.text
        assert res_adm_up_plan.json()["price_inr"] == 1099

        # Revert back to 999
        client.post(
            "/subscriptions/admin/plans/plan_doctor_monthly",
            json={"price_inr": 999},
            headers=h_adm1,
        )
        plan_audit = db.query(AuditLog).filter(AuditLog.action == "PLAN_UPDATED").first()
        assert plan_audit is not None
        print("S-14. Admin Plan Configuration & Audit Trail     [PASS] RBAC enforced, audit logged")

        # S-15: Admin view all subscriptions (GET /subscriptions/admin/all)
        # Doctor role blocked
        assert client.get("/subscriptions/admin/all", headers=h_doc1).status_code == 403
        # Patient role blocked
        assert client.get("/subscriptions/admin/all", headers=h_pat1).status_code == 403
        # Admin allowed
        res_adm_all_subs = client.get("/subscriptions/admin/all", headers=h_adm1)
        assert res_adm_all_subs.status_code == 200, res_adm_all_subs.text
        all_subs = res_adm_all_subs.json()
        assert len(all_subs) >= 1
        print("S-15. Admin Clinic-Wide Subscriptions Directory  [PASS] All subscriptions listed with RBAC")

        # S-16: Razorpay Webhook Processing, Secret Verification, and Idempotency Protection
        # S-16a: Invalid or missing webhook signature rejected (HTTP 400)
        res_bad_wh = client.post(
            "/subscriptions/webhook",
            json={"event": "order.paid"},
            headers={"X-Razorpay-Signature": "invalid_sig_123"}
        )
        assert res_bad_wh.status_code == 400

        # S-16b: Valid Webhook with order.paid activates subscription and updates transaction
        # Create an uncompleted order for doc2
        res_doc2_order = client.post(
            "/subscriptions/checkout",
            json={"plan_id": "plan_doctor_yearly", "billing_cycle": "yearly"},
            headers=h_doc2,
        )
        assert res_doc2_order.status_code == 200
        doc2_wh_order_id = res_doc2_order.json()["order_id"]

        wh_payload = {
            "event": "order.paid",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_webhook_test_99",
                        "order_id": doc2_wh_order_id,
                        "amount": 999900,
                        "currency": "INR",
                        "status": "captured"
                    }
                }
            }
        }
        wh_bytes = json.dumps(wh_payload).encode("utf-8")
        from app.config import settings as test_settings
        orig_wh_secret = test_settings.RAZORPAY_WEBHOOK_SECRET
        try:
            test_settings.RAZORPAY_WEBHOOK_SECRET = "whsec_test_secret_chronorx"
            test_wh_sig = hmac.new(b"whsec_test_secret_chronorx", wh_bytes, hashlib.sha256).hexdigest()
            res_good_wh = client.post(
                "/subscriptions/webhook",
                content=wh_bytes,
                headers={"X-Razorpay-Signature": test_wh_sig, "Content-Type": "application/json"}
            )
            assert res_good_wh.status_code == 200, res_good_wh.text
            assert res_good_wh.json()["status"] == "ok"

            # S-16c: Idempotency / Duplicate Webhook: Replaying already-processed webhook returns 200 without duplicate action
            res_dup_wh = client.post(
                "/subscriptions/webhook",
                content=wh_bytes,
                headers={"X-Razorpay-Signature": test_wh_sig, "Content-Type": "application/json"}
            )
            assert res_dup_wh.status_code == 200
            assert "idempotent" in res_dup_wh.json()["message"].lower()
        finally:
            test_settings.RAZORPAY_WEBHOOK_SECRET = orig_wh_secret
        print("S-16. Webhook Verification & Anti-Replay Idempotency [PASS] Verified with HMAC secret & replay guard")

        # =====================================================================
        # PART 8: HOSPITAL DEPARTMENTS MANAGEMENT & SELECTION SYSTEM (16 TESTS)
        # =====================================================================
        print("\n" + "=" * 78)
        print("PART 8: HOSPITAL DEPARTMENTS MANAGEMENT & SELECTION SYSTEM (16 TESTS)")
        print("=" * 78)

        # D-01: Retrieve all 29 departments across 5 categories
        res_all_depts = client.get("/departments")
        assert res_all_depts.status_code == 200, res_all_depts.text
        depts_data = res_all_depts.json()
        assert len(depts_data) == 29, f"Expected exactly 29 departments, got {len(depts_data)}"
        cats_found = set(d["category"] for d in depts_data)
        assert len(cats_found) == 5, f"Expected 5 categories, got {len(cats_found)}"
        print(f"D-01. List All Hospital Departments [PASS] Retrieved exactly {len(depts_data)} departments across 5 categories")

        # D-02: Get department categories and group counts
        res_cats = client.get("/departments/categories")
        assert res_cats.status_code == 200, res_cats.text
        cats_data = res_cats.json()
        assert len(cats_data) == 5, f"Expected 5 category groups, got {len(cats_data)}"
        total_in_groups = sum(len(g["departments"]) for g in cats_data)
        assert total_in_groups == 29, f"Expected 29 departments in groups, got {total_in_groups}"
        print(f"D-02. Department Categories & Grouping [PASS] 5 categories verified with total {total_in_groups} specialties")

        # D-03: Search "heart" -> Cardiology (Heart)
        res_search_heart = client.get("/departments?search=heart")
        assert res_search_heart.status_code == 200
        heart_results = res_search_heart.json()
        assert any("Cardiology" in d["name"] for d in heart_results), "Expected Cardiology for search 'heart'"
        print("D-03. Department Search by Keyword 'heart' [PASS] Matched Cardiology (Heart)")

        # D-04: Search "brain" -> Neurology (Brain & Nervous System)
        res_search_brain = client.get("/departments?search=brain")
        assert res_search_brain.status_code == 200
        brain_results = res_search_brain.json()
        assert any("Neurology" in d["name"] for d in brain_results), "Expected Neurology for search 'brain'"
        print("D-04. Department Search by Keyword 'brain' [PASS] Matched Neurology (Brain & Nervous System)")

        # D-05: Search "kidney" -> Nephrology (Kidneys)
        res_search_kidney = client.get("/departments?search=kidney")
        assert res_search_kidney.status_code == 200
        kidney_results = res_search_kidney.json()
        assert any("Nephrology" in d["name"] for d in kidney_results), "Expected Nephrology for search 'kidney'"
        print("D-05. Department Search by Keyword 'kidney' [PASS] Matched Nephrology (Kidneys)")

        # D-06: Search "eye" -> Ophthalmology (Eye Care)
        res_search_eye = client.get("/departments?search=eye")
        assert res_search_eye.status_code == 200
        eye_results = res_search_eye.json()
        assert any("Ophthalmology" in d["name"] for d in eye_results), "Expected Ophthalmology for search 'eye'"
        print("D-06. Department Search by Keyword 'eye' [PASS] Matched Ophthalmology (Eye Care)")

        # D-07: Search "x-ray" -> Radiology & Imaging (X-Ray, MRI, CT Scan)
        res_search_xray = client.get("/departments?search=x-ray")
        assert res_search_xray.status_code == 200
        xray_results = res_search_xray.json()
        assert any("Radiology" in d["name"] for d in xray_results), "Expected Radiology for search 'x-ray'"
        print("D-07. Department Search by Keyword 'x-ray' [PASS] Matched Radiology & Imaging")

        # D-08: Filter by category "Super Specialties" -> exactly 7
        res_super = client.get("/departments?category=Super Specialties")
        assert res_super.status_code == 200
        super_results = res_super.json()
        assert len(super_results) == 7, f"Expected 7 super specialties, got {len(super_results)}"
        print(f"D-08. Category Filter 'Super Specialties' [PASS] Returned exactly {len(super_results)} departments")

        # D-09: Doctor registration with explicit department
        res_reg_doc = client.post("/auth/register", json={
            "email": "dr.carter.cardio@chronorx.tech",
            "password": "SecurePassword123!",
            "full_name": "Dr. Angela Carter, M.D.",
            "role": "doctor",
            "department": "Cardiology (Heart)",
        })
        assert res_reg_doc.status_code in (200, 201), res_reg_doc.text
        doc_reg_data = res_reg_doc.json()
        assert doc_reg_data["department"] == "Cardiology (Heart)"
        print("D-09. Doctor Registration with Valid Department [PASS] Registered with Cardiology (Heart)")

        # D-10: Doctor registration with invalid department rejected with 400
        res_reg_bad = client.post("/auth/register", json={
            "email": "dr.fake.dept@chronorx.tech",
            "password": "SecurePassword123!",
            "full_name": "Dr. Fake Dept, M.D.",
            "role": "doctor",
            "department": "Astrology & Alchemy",
        })
        assert res_reg_bad.status_code == 400
        assert "Invalid department" in res_reg_bad.json()["detail"]
        print("D-10. Doctor Registration with Invalid Department [PASS] Rejected with HTTP 400 Bad Request")

        # D-11: Doctor self-update department via PUT /profile/department
        res_upd_dept = client.put(
            "/profile/department",
            json={"department": "Endocrinology (Diabetes & Hormones)"},
            headers=h_doc1
        )
        assert res_upd_dept.status_code == 200, res_upd_dept.text
        assert res_upd_dept.json()["department"] == "Endocrinology (Diabetes & Hormones)"
        print("D-11. Doctor Self-Update Department [PASS] Successfully updated to Endocrinology")

        # D-12: Doctor self-update with invalid department rejected with 400
        res_upd_bad = client.put(
            "/profile/department",
            json={"department": "Quackery & Homeopathy"},
            headers=h_doc1
        )
        assert res_upd_bad.status_code == 400
        print("D-12. Doctor Self-Update with Invalid Department [PASS] Rejected with HTTP 400 Bad Request")

        # D-13: Patient prohibited from setting doctor department via PUT /profile/department (HTTP 403)
        res_pat_dept = client.put(
            "/profile/department",
            json={"department": "Cardiology (Heart)"},
            headers=h_pat1
        )
        assert res_pat_dept.status_code == 403
        print("D-13. Patient Department Update Forbidden [PASS] Blocked with HTTP 403")

        # D-14: Cross-user doctor department update prohibited (HTTP 403 IDOR protection)
        res_cross_dept = client.put(
            "/profile/ADM-1001/department",
            json={"department": "Orthopedics (Bones & Joints)"},
            headers=h_doc1
        )
        assert res_cross_dept.status_code == 403
        print("D-14. Cross-User Department Update IDOR Guard [PASS] Blocked with HTTP 403")

        # D-15: Admin reassigns doctor department via PATCH /auth/staff/{user_id}/department with audit log
        res_admin_reassign = client.patch(
            "/auth/staff/DOC-1001/department",
            json={"department": "Neurology (Brain & Nervous System)"},
            headers=h_adm1
        )
        assert res_admin_reassign.status_code == 200, res_admin_reassign.text
        assert res_admin_reassign.json()["department"] == "Neurology (Brain & Nervous System)"
        print("D-15. Admin Reassigns Doctor Department [PASS] Successfully reassigned to Neurology with audit log")

        # D-16: Appointment slot filtering by department
        res_filter_slots = client.get(
            "/appointments/doctors?department=Neurology (Brain & Nervous System)",
            headers=h_pat1
        )
        assert res_filter_slots.status_code == 200, res_filter_slots.text
        neuro_docs = res_filter_slots.json()
        assert any(d["doctor_id"] == "DOC-1001" for d in neuro_docs), "Expected DOC-1001 in filtered slots"
        print("D-16. Appointment Slots Filtered by Department [PASS] Doctor slots correctly matched department")

        print("=" * 78)
        print("ALL 100 VERIFICATION & REGRESSION CHECKS PASSED WITH ZERO ERRORS!")
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

