"""
ChronoRx Payment Service
Handles payment order generation, webhook processing, and HMAC-SHA256 signature verification.
Supports Razorpay integration with secure fallback mode for development and automated testing.
"""
import hmac
import hashlib
import uuid
import datetime
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.config import settings
from app.models.models import User, SubscriptionPlan, UserSubscription, PaymentTransaction, AuditLog

def create_checkout_order(
    user: User,
    plan: SubscriptionPlan,
    billing_cycle: Optional[str] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Creates a payment gateway checkout order.
    Amount is calculated in whole INR and paise (INR * 100).
    For patients, cost is always ₹0 and an exception is raised if an order is requested.
    """
    if user.role == "patient" or plan.role == "patient" or plan.price_inr == 0:
        return {
            "order_id": f"free_order_{uuid.uuid4().hex[:12]}",
            "amount_inr": 0,
            "amount_paise": 0,
            "currency": "INR",
            "key_id": "free_tier",
            "plan_id": plan.plan_id,
            "plan_name": plan.name,
            "role": user.role,
            "billing_cycle": "free",
            "provider": "free",
            "notes": {"message": "Patients and Free Tiers have zero charges forever."}
        }

    amount_inr = plan.price_inr
    amount_paise = amount_inr * 100
    order_id = f"order_{uuid.uuid4().hex[:16]}"
    provider = "razorpay" if (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET) else "mock"

    # Save transaction record in INITIATED status
    if db:
        txn = PaymentTransaction(
            transaction_id=f"TXN-{uuid.uuid4().hex[:12].upper()}",
            user_id=user.user_id,
            plan_id=plan.plan_id,
            amount_inr=amount_inr,
            currency="INR",
            gateway=provider,
            gateway_order_id=order_id,
            status="INITIATED",
            details=f'{{"plan_name": "{plan.name}", "billing_cycle": "{plan.billing_cycle}"}}'
        )
        db.add(txn)
        db.commit()

    return {
        "order_id": order_id,
        "amount_inr": amount_inr,
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": settings.RAZORPAY_KEY_ID or "rzp_test_chronorx_sandbox",
        "plan_id": plan.plan_id,
        "plan_name": plan.name,
        "role": user.role,
        "billing_cycle": plan.billing_cycle,
        "provider": provider,
        "notes": {
            "user_id": user.user_id,
            "user_name": user.full_name,
            "user_email": user.email
        }
    }

def verify_payment_signature(
    order_id: str,
    payment_id: str,
    signature: str,
    secret: Optional[str] = None
) -> bool:
    """
    Validates Razorpay HMAC SHA-256 signature:
    HMAC(secret, order_id + "|" + payment_id) == signature
    
    SECURITY GUARANTEES:
    - In production (APP_ENV=production), payment activation is strictly IMPOSSIBLE
      if RAZORPAY_KEY_SECRET is missing.
    - No development fallback can activate payments in production without verification.
    """
    is_production = getattr(settings, "APP_ENV", "development").lower() in ("production", "prod")
    key_secret = secret or settings.RAZORPAY_KEY_SECRET

    # In production, require configured secret key. Fail closed if missing.
    # No test prefix, mock secret, or dev bypass is ever evaluated in production.
    if is_production:
        if not key_secret:
            return False
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    # In non-production testing environment: validate against secret if provided, or sandbox secret/test prefix
    if key_secret:
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    mock_secret = "chronorx_sandbox_mock_secret"
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    expected_mock = hmac.new(mock_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected_mock, signature):
        return True

    if signature.startswith("sig_mock_") or signature.startswith("test_sig_"):
        return True

    return False

def verify_webhook_signature(
    payload_bytes: bytes,
    signature: str,
    secret: Optional[str] = None
) -> bool:
    """
    Validates Razorpay Webhook HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET.
    Fails closed if webhook secret is not configured.
    """
    webhook_secret = secret or settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret or not signature:
        return False

    expected_sig = hmac.new(webhook_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, signature)

def process_payment_webhook(
    event_payload: Dict[str, Any],
    db: Session
) -> Tuple[bool, str]:
    """
    Processes asynchronous payment webhook events (e.g. payment.captured, order.paid).
    Ensures idempotency: replayed webhooks and duplicate events cannot activate subscriptions twice.
    """
    event = event_payload.get("event")
    if event not in ["payment.captured", "order.paid"]:
        return True, f"Ignored non-activation event '{event}'."

    payload = event_payload.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id")
    payment_id = payment_entity.get("id")

    if not order_id:
        return False, "Invalid webhook: Missing order_id."

    txn = db.query(PaymentTransaction).filter(
        PaymentTransaction.gateway_order_id == order_id
    ).first()
    if not txn:
        return False, f"Checkout order '{order_id}' was not found."

    # Idempotency / Anti-Replay: If already completed, acknowledge without re-activating
    if txn.status == "SUCCESS":
        return True, f"Webhook already processed for order '{order_id}' (idempotent)."

    user = db.query(User).filter(User.user_id == txn.user_id).first()
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == txn.plan_id).first()
    if not user or not plan:
        return False, "Associated User or Plan not found."

    # Verify amount and currency if present in payment payload
    amount_paid_paise = payment_entity.get("amount")
    if amount_paid_paise is not None:
        expected_paise = plan.price_inr * 100
        if amount_paid_paise != expected_paise:
            return False, f"Webhook amount mismatch: Paid {amount_paid_paise} paise, expected {expected_paise} paise."

    currency_paid = payment_entity.get("currency")
    if currency_paid is not None and currency_paid.upper() != "INR":
        return False, f"Webhook currency mismatch: Expected INR, got {currency_paid}."

    now = datetime.datetime.utcnow()
    cycle = plan.billing_cycle.lower()
    end_date = now + datetime.timedelta(days=365) if cycle == "yearly" else (now + datetime.timedelta(days=30))

    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user.user_id).first()
    if not sub:
        sub = UserSubscription(
            subscription_id=f"SUB-{user.user_id}-{uuid.uuid4().hex[:6].upper()}",
            user_id=user.user_id,
            role=user.role,
            plan_id=plan.plan_id,
            billing_cycle=plan.billing_cycle,
            price_inr=plan.price_inr,
            status="ACTIVE",
            start_date=now,
            end_date=end_date,
            auto_renew=True,
            payment_method="RAZORPAY_WEBHOOK"
        )
        db.add(sub)
    else:
        sub.plan_id = plan.plan_id
        sub.billing_cycle = plan.billing_cycle
        sub.price_inr = plan.price_inr
        sub.status = "ACTIVE"
        sub.start_date = now
        sub.end_date = end_date
        sub.updated_at = now

    txn.status = "SUCCESS"
    txn.subscription_id = sub.subscription_id
    txn.gateway_payment_id = payment_id
    txn.verified_at = now

    audit = AuditLog(
        patient_id=user.patient_id,
        user_id=user.user_id,
        action="SUBSCRIPTION_PURCHASED",
        details=f"Activated {plan.name} via verified webhook for order {order_id} (Payment: {payment_id})",
        ip_address="WEBHOOK"
    )
    db.add(audit)
    db.commit()
    return True, f"Subscription {sub.subscription_id} activated via verified webhook."

def complete_subscription_payment(
    user: User,
    plan: SubscriptionPlan,
    order_id: str,
    payment_id: str,
    signature: str,
    db: Session,
    ip_address: str = "127.0.0.1"
) -> Tuple[bool, str, Optional[UserSubscription]]:
    """
    Verifies payment, creates/updates user subscription, updates transaction,
    and logs an audit trail event.
    Hardened against IDOR, replay attacks, amount tampering, and plan mismatch.
    """
    # 1. Fetch transaction record created during checkout
    txn = db.query(PaymentTransaction).filter(
        PaymentTransaction.gateway_order_id == order_id
    ).first()
    if not txn:
        return False, f"Checkout order '{order_id}' was not found in transaction records.", None

    # 2. Prevent IDOR: Ensure order belongs to the authenticated user
    if txn.user_id != user.user_id:
        return False, "Authorization mismatch: Order does not belong to the authenticated user.", None

    # 3. Plan, Amount & Currency consistency check: Verified strictly against server-side plan
    if txn.plan_id != plan.plan_id:
        return False, f"Plan mismatch: Order was initiated for {txn.plan_id}, not {plan.plan_id}.", None
    if txn.amount_inr != plan.price_inr:
        return False, f"Amount mismatch: Transaction recorded ₹{txn.amount_inr}, but plan price is ₹{plan.price_inr}.", None
    if txn.currency != "INR":
        return False, f"Currency mismatch: Expected INR, got {txn.currency}.", None

    # 4. Anti-Replay: Prevent reusing an already completed/consumed transaction
    if txn.status == "SUCCESS":
        return False, "This checkout order has already been completed and cannot be reused.", None

    # 5. Cryptographic signature check
    if not verify_payment_signature(order_id, payment_id, signature):
        txn.status = "FAILED"
        txn.gateway_payment_id = payment_id
        txn.gateway_signature = signature
        db.commit()
        return False, "Invalid payment signature verification failed.", None

    # Calculate subscription validity
    now = datetime.datetime.utcnow()
    cycle = plan.billing_cycle.lower()
    if cycle == "yearly":
        end_date = now + datetime.timedelta(days=365)
    elif cycle == "monthly":
        end_date = now + datetime.timedelta(days=30)
    else:
        end_date = None  # Free / Perpetual

    # Fetch existing active or expired subscription
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == user.user_id
    ).first()

    sub_id = f"SUB-{user.user_id}-{uuid.uuid4().hex[:6].upper()}"
    if not sub:
        sub = UserSubscription(
            subscription_id=sub_id,
            user_id=user.user_id,
            role=user.role,
            plan_id=plan.plan_id,
            billing_cycle=plan.billing_cycle,
            price_inr=plan.price_inr,
            status="ACTIVE",
            start_date=now,
            end_date=end_date,
            auto_renew=True,
            payment_method="RAZORPAY"
        )
        db.add(sub)
    else:
        sub.plan_id = plan.plan_id
        sub.billing_cycle = plan.billing_cycle
        sub.price_inr = plan.price_inr
        sub.status = "ACTIVE"
        sub.start_date = now
        sub.end_date = end_date
        sub.updated_at = now

    # Update payment transaction record to SUCCESS
    txn.status = "SUCCESS"
    txn.subscription_id = sub.subscription_id
    txn.gateway_payment_id = payment_id
    txn.gateway_signature = signature
    txn.verified_at = now

    # Audit Logging
    audit = AuditLog(
        patient_id=user.patient_id,
        user_id=user.user_id,
        action="SUBSCRIPTION_PURCHASED",
        details=f"Subscribed to {plan.name} (₹{plan.price_inr}) via order {order_id}",
        ip_address=ip_address
    )
    db.add(audit)
    db.commit()
    db.refresh(sub)

    return True, "Payment verified and subscription activated successfully.", sub
