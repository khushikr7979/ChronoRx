from typing import List
from fastapi import APIRouter, Depends
from app.schemas.schemas import (
    DrugNormalizeRequest,
    NormalizedDrugResult,
    DrugReferenceRequest,
    DrugReferenceResponse
)
from app.security.auth_handler import get_current_user
from app.models.models import User
from app.services.rxnorm_service import rxnorm_service
from app.services.openfda_service import openfda_service

router = APIRouter(prefix="/drugs", tags=["Drug Normalization & Reference"])

@router.post("/normalize", response_model=List[NormalizedDrugResult])
def normalize_drugs(
    payload: DrugNormalizeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Normalizes drug names using NIH RxNorm/RxNav API and verified local cache.
    If a drug cannot be identified, flags:
    'Unable to confidently identify — manual verification required'.
    """
    results = rxnorm_service.batch_normalize(payload.drug_names)
    return results

@router.post("/reference", response_model=DrugReferenceResponse)
def get_drug_reference(
    payload: DrugReferenceRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves authoritative drug labeling, warnings, dosage, and contraindications
    from the U.S. FDA Drug Product Labeling API (openFDA).
    Includes source attribution and retrieval timestamp.
    """
    reference_data = openfda_service.get_drug_labeling(payload.drug_name)
    return reference_data
