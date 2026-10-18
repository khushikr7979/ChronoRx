"""
ChronoRx Subscription Management Service
Enforces role-based billing, subscription lifecycle, and free patient access.
"""
import json
import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, SubscriptionPlan, UserSubscription
from app.security.auth_handler import get_current_active_user

def get_plans_for_role(role: str, db: Session) -> List[SubscriptionPlan]:
    """Retrieves all active subscription plans applicable for the role."""
    r = role.lower().strip()
    return db.query(SubscriptionPlan).filter(
        SubscriptionPlan.role == r,
        SubscriptionPlan.is_active == True
    ).order_by(SubscriptionPlan.price_inr.asc()).all()

def get_all_active_plans(db: Session) -> List[SubscriptionPlan]:
    """Retrieves all active plans across all roles."""
    return db.query(SubscriptionPlan).filter(
        SubscriptionPlan.is_active == True
    ).order_by(SubscriptionPlan.price_inr.asc()).all()

def get_user_subscription_status(user: User, db: Session) -> Dict[str, Any]:
    """
    Returns the comprehensive subscription status and feature entitlement for a user.
    CRITICAL: Patient role is 100% FREE FOREVER with zero billing barriers.
    """
    role = (user.role or "").lower()

    # Patients are ALWAYS free forever
    if role == "patient":
        free_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == "plan_patient_free"
        ).first()
        features = []
        if free_plan and free_plan.features:
            try:
                features = json.loads(free_plan.features)
            except Exception:
                pass
        if not features:
            features = [
                "100% Free Forever — Zero Patient Charges",
                "View Active & Past Prescriptions",
                "Digital Medication Timetable & Reminders",
                "Instructions in 22 Indian Languages",
                "3-Day Free Doctor Follow-Up Messaging",
                "Book Appointments & Receive QR Receipts"
            ]

        return {
            "is_subscribed": True,
            "is_free_tier": True,
            "role": "patient",
            "plan_id": "plan_patient_free",
            "plan_name": "Patient Portal (100% Free Forever)",
            "status": "FREE",
            "billing_cycle": "free",
            "end_date": None,
            "days_remaining": None,
            "features": features,
            "message": "Patient accounts are 100% free forever. No payment required."
        }

    # Staff roles: Doctor, Receptionist, Admin
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == user.user_id
    ).order_by(UserSubscription.id.desc()).first()

    now = datetime.datetime.utcnow()

    if not sub:
        # Check if system default plan is available
        role_plans = get_plans_for_role(role, db)
        first_plan = role_plans[0] if role_plans else None
        return {
            "is_subscribed": False,
            "is_free_tier": False,
            "role": role,
            "plan_id": first_plan.plan_id if first_plan else None,
            "plan_name": first_plan.name if first_plan else None,
            "status": "UNSUBSCRIBED",
            "billing_cycle": None,
            "end_date": None,
            "days_remaining": 0,
            "features": [],
            "message": f"Active {role.capitalize()} subscription required."
        }

    # Check if subscription has expired
    is_active = sub.status == "ACTIVE"
    days_remaining = None
    if sub.end_date:
        delta = sub.end_date - now
        days_remaining = max(0, delta.days)
        if delta.total_seconds() <= 0:
            is_active = False
            sub.status = "EXPIRED"
            db.commit()

    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == sub.plan_id
    ).first()

    features = []
    if plan and plan.features:
        try:
            features = json.loads(plan.features)
        except Exception:
            pass

    return {
        "is_subscribed": is_active,
        "is_free_tier": False,
        "role": role,
        "plan_id": sub.plan_id,
        "plan_name": plan.name if plan else sub.plan_id,
        "status": sub.status,
        "billing_cycle": sub.billing_cycle,
        "end_date": sub.end_date,
        "days_remaining": days_remaining,
        "features": features,
        "message": "Active subscription." if is_active else "Subscription expired. Please renew."
    }

def parse_plan_features(features_raw: Any) -> List[str]:
    """Safely extracts JSON features list."""
    if isinstance(features_raw, list):
        return features_raw
    if isinstance(features_raw, str):
        try:
            parsed = json.loads(features_raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    return []

def require_active_subscription(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Enforces active subscription on protected backend endpoints.
    - Patient accounts: 100% Free Forever (always pass).
    - Admin accounts: Platform administration (always pass).
    - Doctor & Receptionist: Must have an ACTIVE subscription.
      Unpaid or EXPIRED accounts receive HTTP 402 Payment Required.
    """
    role = (current_user.role or "").lower()
    if role in ["patient", "admin"]:
        return current_user

    status_info = get_user_subscription_status(current_user, db)
    if not status_info.get("is_subscribed"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Subscription required: {status_info.get('message', 'Active subscription required to access professional features.')}"
        )
    return current_user
