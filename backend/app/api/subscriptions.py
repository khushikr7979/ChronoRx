"""
ChronoRx Subscription & Billing Endpoints
Manages role-based clinical subscriptions, checkout orders, and payment verification.
GUARANTEE: Patients are 100% FREE FOREVER with zero billing hurdles or payment gateways.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models.models import (
    User,
    SubscriptionPlan,
    UserSubscription,
    PaymentTransaction,
    AuditLog,
)
from app.schemas.schemas import (
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    UserSubscriptionResponse,
    CheckoutOrderRequest,
    CheckoutOrderResponse,
    PaymentVerifyRequest,
    PaymentVerifyResponse,
    PaymentTransactionResponse,
    SubscriptionStatusResponse,
)
from app.security.auth_handler import get_current_active_user
from app.services.subscription_service import (
    get_plans_for_role,
    get_all_active_plans,
    get_user_subscription_status,
    parse_plan_features,
)
from app.services.payment_service import (
    create_checkout_order,
    complete_subscription_payment,
    verify_webhook_signature,
    process_payment_webhook,
)

router = APIRouter(prefix="/subscriptions", tags=["Role-Based Subscriptions & Billing"])

@router.get("/plans", response_model=List[SubscriptionPlanResponse])
def list_available_plans(
    role: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Lists subscription plans.
    Admins can see all plans or filter by role.
    Other users receive the plans specific to their role.
    """
    target_role = role if (current_user.role == "admin" and role) else current_user.role

    if current_user.role == "admin" and not role:
        plans = get_all_active_plans(db)
    else:
        plans = get_plans_for_role(target_role, db)

    result = []
    for p in plans:
        result.append(SubscriptionPlanResponse(
            id=p.id,
            plan_id=p.plan_id,
            role=p.role,
            name=p.name,
            description=p.description or "",
            billing_cycle=p.billing_cycle,
            price_inr=p.price_inr,
            features=parse_plan_features(p.features),
            is_active=p.is_active
        ))
    return result

@router.get("/status", response_model=SubscriptionStatusResponse)
def get_current_subscription_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Returns the subscription status and feature entitlement for the logged-in user.
    Patients ALWAYS receive FREE FOREVER status.
    """
    status_info = get_user_subscription_status(current_user, db)
    return SubscriptionStatusResponse(
        is_subscribed=status_info["is_subscribed"],
        is_free_tier=status_info["is_free_tier"],
        role=status_info["role"],
        plan_id=status_info.get("plan_id"),
        plan_name=status_info.get("plan_name"),
        status=status_info["status"],
        billing_cycle=status_info.get("billing_cycle"),
        end_date=status_info.get("end_date"),
        features=status_info.get("features", []),
        message=status_info["message"]
    )

@router.post("/checkout", response_model=CheckoutOrderResponse)
def checkout_subscription(
    payload: CheckoutOrderRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generates a checkout order for subscription upgrade / renewal.
    STRICT SAFETY RULE: Patients must NEVER be charged. Attempting to charge a patient returns 400.
    """
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patients have 100% Free Forever access. No subscription purchase is required or allowed."
        )

    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == payload.plan_id
    ).first()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription plan '{payload.plan_id}' does not exist."
        )

    if plan.role != current_user.role and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan '{plan.plan_id}' is for {plan.role}s, but you are logged in as {current_user.role}."
        )

    order_data = create_checkout_order(
        user=current_user,
        plan=plan,
        billing_cycle=payload.billing_cycle,
        db=db
    )

    return CheckoutOrderResponse(**order_data)

@router.post("/verify-payment", response_model=PaymentVerifyResponse)
def verify_payment(
    payload: PaymentVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Verifies payment signature from Razorpay / Mock Provider and activates the subscription.
    """
    if current_user.role == "patient":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patients do not have payment transactions."
        )

    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == payload.plan_id
    ).first()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {payload.plan_id} not found."
        )

    ip = request.client.host if request and request.client else "127.0.0.1"

    success, message, sub = complete_subscription_payment(
        user=current_user,
        plan=plan,
        order_id=payload.order_id,
        payment_id=payload.payment_id,
        signature=payload.signature,
        db=db,
        ip_address=ip
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    sub_resp = None
    if sub:
        sub_resp = UserSubscriptionResponse(
            id=sub.id,
            subscription_id=sub.subscription_id,
            user_id=sub.user_id,
            role=sub.role,
            plan_id=sub.plan_id,
            plan_name=plan.name,
            billing_cycle=sub.billing_cycle,
            price_inr=sub.price_inr,
            status=sub.status,
            start_date=sub.start_date,
            end_date=sub.end_date,
            auto_renew=sub.auto_renew,
            payment_method=sub.payment_method,
            is_free_forever=(sub.role == "patient")
        )

    return PaymentVerifyResponse(
        success=True,
        status="ACTIVE",
        message=message,
        subscription_id=sub.subscription_id if sub else None,
        subscription=sub_resp
    )

@router.post("/webhook")
async def razorpay_payment_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Razorpay Webhook endpoint for asynchronous payment confirmation.
    Verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET.
    Ensures idempotency: replayed and duplicate webhooks cannot activate subscriptions twice.
    """
    signature = request.headers.get("X-Razorpay-Signature", "")
    body_bytes = await request.body()

    if not verify_webhook_signature(body_bytes, signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing webhook signature."
        )

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON webhook body."
        )

    success, msg = process_payment_webhook(payload, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    return {"status": "ok", "message": msg}

@router.get("/history", response_model=List[PaymentTransactionResponse])
def get_payment_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the list of payment transactions for the authenticated user.
    """
    txns = db.query(PaymentTransaction).filter(
        PaymentTransaction.user_id == current_user.user_id
    ).order_by(PaymentTransaction.id.desc()).all()

    return [PaymentTransactionResponse.from_orm(t) for t in txns]

@router.post("/admin/plans/{plan_id}", response_model=SubscriptionPlanResponse)
def admin_update_plan(
    plan_id: str,
    payload: SubscriptionPlanUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Allows Admin to configure subscription plan prices, features, or active status.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System Administrator privileges required to manage subscription plans."
        )

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription plan '{plan_id}' not found."
        )

    if payload.name is not None:
        plan.name = payload.name
    if payload.description is not None:
        plan.description = payload.description
    if payload.price_inr is not None:
        # Patient free plan cannot have non-zero price
        if plan.role == "patient" and payload.price_inr != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Patient plan price must always be ₹0 (Free Forever)."
            )
        plan.price_inr = payload.price_inr
    if payload.features is not None:
        plan.features = json.dumps(payload.features)
    if payload.is_active is not None:
        plan.is_active = payload.is_active

    db.commit()
    db.refresh(plan)

    ip = request.client.host if request and request.client else "127.0.0.1"
    audit = AuditLog(
        user_id=current_user.user_id,
        action="PLAN_UPDATED",
        details=f"Admin updated plan {plan_id} (Price: ₹{plan.price_inr})",
        ip_address=ip
    )
    db.add(audit)
    db.commit()

    return SubscriptionPlanResponse(
        id=plan.id,
        plan_id=plan.plan_id,
        role=plan.role,
        name=plan.name,
        description=plan.description or "",
        billing_cycle=plan.billing_cycle,
        price_inr=plan.price_inr,
        features=parse_plan_features(plan.features),
        is_active=plan.is_active
    )

@router.get("/admin/all", response_model=List[UserSubscriptionResponse])
def admin_list_all_subscriptions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Lists all user subscriptions across the clinic (Admin only).
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required."
        )

    subs = db.query(UserSubscription).order_by(UserSubscription.id.desc()).all()
    results = []
    for s in subs:
        results.append(UserSubscriptionResponse(
            id=s.id,
            subscription_id=s.subscription_id,
            user_id=s.user_id,
            role=s.role,
            plan_id=s.plan_id,
            billing_cycle=s.billing_cycle,
            price_inr=s.price_inr,
            status=s.status,
            start_date=s.start_date,
            end_date=s.end_date,
            auto_renew=s.auto_renew,
            payment_method=s.payment_method,
            is_free_forever=(s.role == "patient")
        ))
    return results
