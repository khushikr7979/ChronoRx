from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.patients import router as patients_router
from app.api.medications import router as medications_router
from app.api.scan import router as scan_router
from app.api.drugs import router as drugs_router
from app.api.dose import router as dose_router, posology_router
from app.api.interactions import router as interactions_router
from app.api.schedule import router as schedule_router
from app.api.summary import router as summary_router
from app.api.prescription import router as prescription_router, prescriptions_router
from app.api.audit import router as audit_router
from app.api.patient_history import router as patient_history_router
from app.api.followups import router as followups_router
from app.api.appointments import router as appointments_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(medications_router)
api_router.include_router(scan_router)
api_router.include_router(drugs_router)
api_router.include_router(dose_router)
api_router.include_router(posology_router)
api_router.include_router(interactions_router)
api_router.include_router(schedule_router)
api_router.include_router(summary_router)
api_router.include_router(prescription_router)
api_router.include_router(prescriptions_router)
api_router.include_router(patient_history_router)
api_router.include_router(followups_router)
api_router.include_router(appointments_router)
api_router.include_router(audit_router)

