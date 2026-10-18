import os
import json
import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api import api_router
from app.models.models import (
    User,
    Patient,
    ScanRecord,
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
from app.services.dose_service import calculate_dubois_bsa, calculate_bmi

# Initialize database schema
Base.metadata.create_all(bind=engine)

def migrate_database_schema():
    """
    Ensures all required columns exist across both SQLite and PostgreSQL databases,
    backfills NULL defaults on legacy rows, and synchronizes PostgreSQL serial sequences.
    """
    from sqlalchemy import inspect as sa_inspect, text

    try:
        inspector = sa_inspect(engine)
        existing_tables = set(inspector.get_table_names())

        alter_statements = []

        if "patients" in existing_tables:
            p_cols = {c["name"] for c in inspector.get_columns("patients")}
            if "status" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN status VARCHAR(50) DEFAULT 'WAITING_FOR_DOCTOR'")
            if "diagnosis" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN diagnosis TEXT DEFAULT ''")
            if "clinical_notes" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN clinical_notes TEXT DEFAULT ''")
            if "consultation_started_at" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN consultation_started_at TIMESTAMP")
            if "consultation_completed_at" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN consultation_completed_at TIMESTAMP")
            if "created_by" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN created_by VARCHAR(50)")
            if "assigned_doctor_id" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN assigned_doctor_id VARCHAR(50)")
            if "updated_at" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN updated_at TIMESTAMP")
            if "preferred_language" not in p_cols:
                alter_statements.append("ALTER TABLE patients ADD COLUMN preferred_language VARCHAR(20) DEFAULT 'en'")

        if "prescription_reviews" in existing_tables:
            pr_cols = {c["name"] for c in inspector.get_columns("prescription_reviews")}
            if "status" not in pr_cols:
                alter_statements.append("ALTER TABLE prescription_reviews ADD COLUMN status VARCHAR(30) DEFAULT 'ACTIVE'")
            if "archived_at" not in pr_cols:
                alter_statements.append("ALTER TABLE prescription_reviews ADD COLUMN archived_at TIMESTAMP")
            if "archived_by" not in pr_cols:
                alter_statements.append("ALTER TABLE prescription_reviews ADD COLUMN archived_by VARCHAR(50)")
            if "archive_reason" not in pr_cols:
                alter_statements.append("ALTER TABLE prescription_reviews ADD COLUMN archive_reason TEXT")

        if "users" in existing_tables:
            u_cols = {c["name"] for c in inspector.get_columns("users")}
            if "patient_id" not in u_cols:
                alter_statements.append("ALTER TABLE users ADD COLUMN patient_id VARCHAR(50)")
            if "profile_photo" not in u_cols:
                alter_statements.append("ALTER TABLE users ADD COLUMN profile_photo VARCHAR(255)")
            if "preferred_language" not in u_cols:
                alter_statements.append("ALTER TABLE users ADD COLUMN preferred_language VARCHAR(20) DEFAULT 'en'")

        if "followup_sessions" in existing_tables:
            f_cols = {c["name"] for c in inspector.get_columns("followup_sessions")}
            if "consultation_ref" not in f_cols:
                alter_statements.append("ALTER TABLE followup_sessions ADD COLUMN consultation_ref VARCHAR(80)")

        if "appointments" in existing_tables:
            a_cols = {c["name"] for c in inspector.get_columns("appointments")}
            if "appointment_time" not in a_cols:
                alter_statements.append("ALTER TABLE appointments ADD COLUMN appointment_time VARCHAR(30)")
            if "updated_at" not in a_cols:
                alter_statements.append("ALTER TABLE appointments ADD COLUMN updated_at TIMESTAMP")

        with engine.begin() as conn:
            for stmt in alter_statements:
                conn.execute(text(stmt))

            if "patients" in existing_tables:
                conn.execute(text("UPDATE patients SET status = 'WAITING_FOR_DOCTOR' WHERE status IS NULL OR status = ''"))
                conn.execute(text("UPDATE patients SET diagnosis = '' WHERE diagnosis IS NULL"))
                conn.execute(text("UPDATE patients SET clinical_notes = '' WHERE clinical_notes IS NULL"))
                conn.execute(text("UPDATE patients SET preferred_language = 'en' WHERE preferred_language IS NULL OR preferred_language = ''"))

            if "users" in existing_tables:
                conn.execute(text("UPDATE users SET preferred_language = 'en' WHERE preferred_language IS NULL OR preferred_language = ''"))

        # Synchronize PostgreSQL auto-increment serial sequences to prevent duplicate key errors after migrations
        if "postgresql" in engine.dialect.name:
            seq_tables = [
                "users",
                "patients",
                "scan_records",
                "medications",
                "prescription_reviews",
                "patient_history_entries",
                "audit_logs",
                "followup_sessions",
                "followup_messages",
                "appointments",
                "subscription_plans",
                "user_subscriptions",
                "payment_transactions",
                "translation_verifications",
                "translation_feedbacks",
            ]
            for tbl in seq_tables:
                if tbl in existing_tables:
                    try:
                        with engine.begin() as conn:
                            max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {tbl}")).scalar() or 0
                            seq_name = conn.execute(text(f"SELECT pg_get_serial_sequence('{tbl}', 'id')")).scalar()
                            if seq_name:
                                conn.execute(
                                    text("SELECT setval(:seq, :val, :is_called)"),
                                    {"seq": seq_name, "val": max(int(max_id), 1), "is_called": bool(max_id > 0)}
                                )
                    except Exception as seq_err:
                        print(f"Sequence sync notice ({tbl}): {seq_err}")
    except Exception as e:
        print(f"Migration notice: {e}")

migrate_database_schema()

app = FastAPI(
    title="ChronoRx Tech API",
    description="AI-Assisted Clinical Decision Support System (CDSS) for Medication Verification, OCR, Interactions, Chronopharmacology Scheduling, and e-Prescriptions.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Medical Disclaimer Response Header (strictly ASCII for HTTP spec)
@app.middleware("http")
async def add_medical_safety_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Medical-Disclaimer"] = "AI-assisted reference information - verify with an authorized healthcare professional."
    return response

# Mount static file endpoints
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "profiles"), exist_ok=True)
os.makedirs(settings.GENERATED_REPORTS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/reports", StaticFiles(directory=settings.GENERATED_REPORTS_DIR), name="reports")

# Include API Router (both at root and /api for universal compatibility)
app.include_router(api_router)
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
def seed_default_demo_data():
    """
    Initializes default demo users and clinical demo data if database is empty.
    Provides immediate 1-click testability.
    """
    db = SessionLocal()
    try:
        # 1. Seed Default Users with System-Generated IDs (No generic 'doctor', 'reception', 'admin' usernames)
        if db.query(User).count() == 0:
            doctor_user = User(
                user_id="DOC-1001",
                username="DOC-1001",
                email="sarah.jenkins@chronorx.tech",
                hashed_password=get_password_hash("ClinicianPass2026!"),
                full_name="Dr. Sarah Jenkins, M.D.",
                role="doctor",
                is_active=True
            )
            receptionist_user = User(
                user_id="REC-1001",
                username="REC-1001",
                email="alex.rivera@chronorx.tech",
                hashed_password=get_password_hash("ReceptionPass2026!"),
                full_name="Alex Rivera",
                role="receptionist",
                is_active=True
            )
            admin_user = User(
                user_id="ADM-1001",
                username="ADM-1001",
                email="david.vance@chronorx.tech",
                hashed_password=get_password_hash("AdminSecure2026!"),
                full_name="David Vance",
                role="admin",
                is_active=True
            )
            db.add_all([doctor_user, receptionist_user, admin_user])
            db.commit()

        # 2. Seed Default Demo Patients (Clearly labeled DEMO data only)
        if db.query(Patient).count() == 0:
            p1_bsa = calculate_dubois_bsa(82.0, 178.0)
            p1_bmi = calculate_bmi(82.0, 178.0)
            demo_patient_1 = Patient(
                patient_id="DEMO-1001",
                name="John Doe (Demo)",
                phone="+1-555-0199",
                age=58,
                weight=82.0,
                height=178.0,
                gender="Male",
                bsa=p1_bsa,
                bmi=p1_bmi,
                medical_history="Hypertension (8 yrs), Hyperlipidemia (4 yrs), Mild Osteoarthritis",
                allergies="Penicillin (mild urticaria)",
                existing_medications="Amlodipine 5mg Daily, Aspirin 81mg Daily",
                created_by="REC-1001",
                assigned_doctor_id="DOC-1001"
            )

            p2_bsa = calculate_dubois_bsa(65.0, 162.0)
            p2_bmi = calculate_bmi(65.0, 162.0)
            demo_patient_2 = Patient(
                patient_id="DEMO-1002",
                name="Jane Smith (Demo)",
                phone="+1-555-0188",
                age=46,
                weight=65.0,
                height=162.0,
                gender="Female",
                bsa=p2_bsa,
                bmi=p2_bmi,
                medical_history="Type 2 Diabetes Mellitus, Gastroesophageal Reflux Disease (GERD)",
                allergies="Sulfa Drugs",
                existing_medications="Metformin 500mg BID",
                created_by="REC-1001",
                assigned_doctor_id="DOC-1001"
            )

            db.add_all([demo_patient_1, demo_patient_2])
            db.commit()

        # 3. Seed Default Patient User Account (linked to a patient profile)
        patient_user_exists = db.query(User).filter(User.role == "patient").first()
        if not patient_user_exists:
            target_p = db.query(Patient).filter(Patient.patient_id.in_(["P-1001", "DEMO-1001"])).first()
            if not target_p:
                target_p = db.query(Patient).first()
            if target_p:
                pat_user = User(
                    user_id="PAT-1001",
                    username="PAT-1001",
                    email="emma.watson@chronorx.tech",
                    hashed_password=get_password_hash("PatientSecure2026!"),
                    full_name=target_p.name,
                    role="patient",
                    patient_id=target_p.patient_id,
                    is_active=True
                )
                db.add(pat_user)
                db.commit()

        # 4. Seed Standard Subscription Plans if none exist
        if db.query(SubscriptionPlan).count() == 0:
            default_plans = [
                SubscriptionPlan(
                    plan_id="plan_doctor_monthly",
                    role="doctor",
                    name="Doctor Clinical Suite (Monthly)",
                    description="Full clinical consultation, posology calculator, chronopharmacology timetable, DDI safety checks, OCR scanning, and 3-day patient follow-up.",
                    billing_cycle="monthly",
                    price_inr=999,
                    features=json.dumps([
                        "Unlimited Clinical Consultations",
                        "AI-Assisted Posology & BSA/BMI Engine",
                        "Multi-Drug Interaction & Food Safety Checks",
                        "Chronopharmacology Smart Timetable",
                        "Prescription OCR & Scan Extraction",
                        "Digital PDF Rx with Clinic Watermark",
                        "3-Day Secure Patient-Doctor Follow-up",
                        "22 Indian Languages Medical Instructions"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_doctor_yearly",
                    role="doctor",
                    name="Doctor Clinical Suite (Annual)",
                    description="Full clinical consultation suite with 2 months free savings, priority clinical AI queue, and advanced analytics.",
                    billing_cycle="yearly",
                    price_inr=9999,
                    features=json.dumps([
                        "All Doctor Monthly Features",
                        "2 Months Free (Save ₹1,989/yr)",
                        "Priority Clinical AI Queue",
                        "Audit Trail & Compliance Archive",
                        "22 Indian Languages Medical Instructions"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_receptionist_monthly",
                    role="receptionist",
                    name="Intake & Desk Suite (Monthly)",
                    description="Complete patient registration, vitals intake, consultation queue management, and appointment QR check-in.",
                    billing_cycle="monthly",
                    price_inr=299,
                    features=json.dumps([
                        "Patient Registration & Vitals Intake",
                        "Real-time Clinic Queue Management",
                        "Appointment Scheduling & Slot Booking",
                        "QR Code Instant Counter Check-in",
                        "Prescription Document Uploads"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_receptionist_yearly",
                    role="receptionist",
                    name="Intake & Desk Suite (Annual)",
                    description="Annual intake suite with 2 months free savings and clinic multi-counter support.",
                    billing_cycle="yearly",
                    price_inr=2999,
                    features=json.dumps([
                        "All Receptionist Monthly Features",
                        "2 Months Free (Save ₹589/yr)",
                        "Multi-Counter Queue Management",
                        "Appointment History & Reports"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_admin_monthly",
                    role="admin",
                    name="Healthcare Admin Suite (Monthly)",
                    description="Complete system administration, clinical staff management, plan configuration, security audit logs, and analytics.",
                    billing_cycle="monthly",
                    price_inr=1499,
                    features=json.dumps([
                        "System User & Staff Provisioning",
                        "Role-Based Access Control (RBAC) Management",
                        "Subscription & Billing Plan Configuration",
                        "Security Audit Trail & Compliance Logs",
                        "Clinic Operational Metrics & Analytics"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_admin_yearly",
                    role="admin",
                    name="Healthcare Admin Suite (Annual)",
                    description="Annual healthcare admin suite with 2 months free savings and unlimited system audit archive.",
                    billing_cycle="yearly",
                    price_inr=14999,
                    features=json.dumps([
                        "All Admin Monthly Features",
                        "2 Months Free (Save ₹2,989/yr)",
                        "Unlimited Compliance & Audit Archive",
                        "Enterprise Multi-Clinician Management"
                    ]),
                    is_active=True
                ),
                SubscriptionPlan(
                    plan_id="plan_patient_free",
                    role="patient",
                    name="Patient Portal (100% Free Forever)",
                    description="Patients never pay. Access prescriptions, timetables in 22 Indian languages, doctor follow-ups, and appointment booking.",
                    billing_cycle="free",
                    price_inr=0,
                    features=json.dumps([
                        "100% Free Forever — Zero Patient Charges",
                        "View Active & Past Prescriptions",
                        "Digital Medication Timetable & Reminders",
                        "Instructions in 22 Indian Languages",
                        "3-Day Free Doctor Follow-Up Messaging",
                        "Book Appointments & Receive QR Receipts"
                    ]),
                    is_active=True
                )
            ]
            db.add_all(default_plans)
            db.commit()

        # 5. Seed Active Subscriptions for Staff Users and Free Subscription for Patient
        staff_seed_data = [
            ("DOC-1001", "doctor", "plan_doctor_yearly", 9999, "yearly"),
            ("REC-1001", "receptionist", "plan_receptionist_yearly", 2999, "yearly"),
            ("ADM-1001", "admin", "plan_admin_yearly", 14999, "yearly"),
            ("PAT-1001", "patient", "plan_patient_free", 0, "free"),
        ]
        for uid, role, pid, price, cycle in staff_seed_data:
            existing_sub = db.query(UserSubscription).filter(UserSubscription.user_id == uid).first()
            if not existing_sub:
                sub_status = "FREE" if role == "patient" else "ACTIVE"
                end_dt = None if role == "patient" else (datetime.datetime.utcnow() + datetime.timedelta(days=365))
                new_sub = UserSubscription(
                    subscription_id=f"SUB-{uid}-SEED",
                    user_id=uid,
                    role=role,
                    plan_id=pid,
                    billing_cycle=cycle,
                    price_inr=price,
                    status=sub_status,
                    start_date=datetime.datetime.utcnow(),
                    end_date=end_dt,
                    auto_renew=True if role != "patient" else False,
                    payment_method="SYSTEM_SEED"
                )
                db.add(new_sub)
        db.commit()

    finally:
        db.close()

@app.get("/")
def root():
    return {
        "app": "ChronoRx Tech",
        "description": "AI-Assisted Clinical Decision Support System (CDSS) Prototype",
        "version": "1.0.0",
        "status": "Operational",
        "disclaimer": "AI-assisted reference information — verify with an authorized healthcare professional.",
        "documentation": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "healthy"}

