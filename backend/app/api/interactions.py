from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.schemas.schemas import InteractionCheckRequest, InteractionCheckResponse
from app.security.auth_handler import get_current_user, require_roles
from app.security.anonymizer import log_audit_event
from app.services.interaction_service import interaction_service

router = APIRouter(prefix="/interactions", tags=["Drug Interactions"])

@router.post("/check", response_model=InteractionCheckResponse)
def check_drug_interactions(
    payload: InteractionCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    """
    Module 4: Multi-Layer Drug Interaction Checker
    - Drug-Drug interactions (Severe/High, Moderate, No Relevant Interaction)
    - Food & Dietary interactions
    - Duplicate therapy detection
    - Complies with safety rule: Never labels a combination 'Safe' unconditionally.
    """
    drugs_to_check = payload.drugs or payload.drug_names or []
    result = interaction_service.check_interactions(drugs_to_check)

    log_audit_event(
        db,
        patient_id=payload.patient_id,
        user_id=current_user.user_id,
        action="DDI_CHECKED",
        details=f"DDI checked for {len(drugs_to_check)} medications by {current_user.user_id}. Alerts: {len(result['alerts'])}"
    )

    return result
