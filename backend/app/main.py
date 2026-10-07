import os
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

