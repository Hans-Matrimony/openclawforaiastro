# Auto-Pay Subscription Implementation Plan

## Current System Status

### ✅ Already Implemented (server.py)
| Feature | Status | Location |
|---------|--------|----------|
| Razorpay subscription creation endpoint | ✅ Complete | `/payments/create-subscription` (lines 1060-1202) |
| subscription.charged webhook handler | ✅ Complete | `_handle_subscription_charged` (lines 2026-2222) |
| subscription.cancelled webhook handler | ✅ Complete | `_handle_subscription_cancelled` (lines 2224-2256) |
| subscription.completed webhook handler | ✅ Complete | `_handle_subscription_completed` (lines 2259-2291) |
| subscription.failed webhook handler | ✅ Complete | `_handle_subscription_failed` (lines 2294-2312) |
| Cancel subscription endpoint | ✅ Complete | `/payments/cancel-subscription` (lines 1210-1270) |
| Duplicate subscription check | ✅ Complete | Lines 1116-1135 |
| Idempotency for webhook processing | ✅ Complete | Lines 2044-2050 |

### ❌ Needs Implementation
| Feature | Status | Location |
|---------|--------|----------|
| Razorpay Dashboard Plans | ❌ Missing | Need to create in Razorpay |
| Auto-pay plans in database | ❌ Missing | Need to add to plans collection |
| Updated enforcement flow | ❌ Missing | enforcement_buttons.py needs update |
| User cancel/subscribe commands | ❌ Missing | message_limiter.py needs update |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SUBSCRIPTION FLOW                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER HITS MESSAGE LIMIT                                                  │
│     ↓                                                                        │
│  2. ENFORCEMENT TRIGGER → Send clean "Subscribe" button                      │
│     ↓                                                                        │
│  3. USER CLICKS "Subscribe Now" → Calls /payments/create-subscription       │
│     ↓                                                                        │
│  4. RAZORPAY SUBSCRIPTION CREATED → User authorizes UPI auto-pay             │
│     ↓                                                                        │
│  5. FIRST CHARGE IMMEDIATE → Webhook: subscription.charged                  │
│     ↓                                                                        │
│  6. SUBSCRIPTION CREATED WITH endDate = tomorrow                            │
│     ↓                                                                        │
│  7. EACH DAY: Auto-charge → Webhook → Extend endDate                        │
│     ↓                                                                        │
│  8. USER TYPES "cancel" → Stop auto-pay                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Razorpay Dashboard Plans

### Plan Configuration

| Plan Type | Amount | Interval | Total Cycles | Plan ID (from Razorpay) |
|-----------|--------|----------|--------------|-------------------------|
| Daily | ₹9 (900 paise) | 1 day | 30 | `plan_ShhNA5PrZsRR96` ✅ |
| Weekly | ₹49 (4900 paise) | 7 days | 12 | TBD |
| Monthly | ₹199 (19900 paise) | 30 days | 12 | TBD |

### Actions Required
1. ✅ Daily plan already created: `plan_ShhNA5PrZsRR96`
2. ⬜ Create Weekly plan in Razorpay Dashboard
3. ⬜ Create Monthly plan in Razorpay Dashboard

### How to Create Plans in Razorpay
```
1. Go to: https://dashboard.razorpay.com/subscriptions/plans
2. Click "Create Plan"
3. Fill:
   - Name: "Weekly ₹49 Auto-Pay" / "Monthly ₹199 Auto-Pay"
   - Amount: 4900 / 19900 (paise)
   - Interval: 1
   - Period: week / month
   - Total Cycles: 12
4. Save → Copy the plan_id
```

---

## Step 2: Add Environment Variables

Add to `hans-ai-subscriptions/.env`:

```bash
# Razorpay Auto-Pay Subscription Plans
RAZORPAY_DAILY_PLAN_ID=plan_ShhNA5PrZsRR96
RAZORPAY_WEEKLY_PLAN_ID=plan_<WEEKLY_PLAN_ID>
RAZORPAY_MONTHLY_PLAN_ID=plan_<MONTHLY_PLAN_ID>
```

---

## Step 3: Add Auto-Pay Plans to Database

Run this script to add auto-pay subscription plans:

```python
# Add to hans-ai-subscriptions/add_autopay_plans.py

from pymongo import MongoClient
from datetime import datetime
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

def add_autopay_plans():
    client = MongoClient(MONGO_URL)
    db = client["openclaw_subscriptions"]
    plans = db["plans"]

    autopay_plans = [
        {
            "planId": "daily_autopay_9",
            "name": "Daily Auto-Pay",
            "description": "₹9/day auto-pay subscription. Cancel anytime.",
            "price": 900,
            "currency": "INR",
            "durationDays": 1,
            "interval": "daily",
            "isAutoPay": True,
            "features": [
                "Auto-pay enabled",
                "Cancel anytime",
                "1 day unlimited access",
                "Quick consultations"
            ],
            "isActive": True,
            "createdAt": datetime.utcnow()
        },
        {
            "planId": "weekly_autopay_49",
            "name": "Weekly Auto-Pay",
            "description": "₹49/week auto-pay subscription. Cancel anytime.",
            "price": 4900,
            "currency": "INR",
            "durationDays": 7,
            "interval": "weekly",
            "isAutoPay": True,
            "features": [
                "Auto-pay enabled",
                "Cancel anytime",
                "7 days unlimited access",
                "Priority support"
            ],
            "isActive": True,
            "createdAt": datetime.utcnow()
        },
        {
            "planId": "monthly_autopay_199",
            "name": "Monthly Auto-Pay",
            "description": "₹199/month auto-pay subscription. Cancel anytime.",
            "price": 19900,
            "currency": "INR",
            "durationDays": 30,
            "interval": "monthly",
            "isAutoPay": True,
            "features": [
                "Auto-pay enabled",
                "Cancel anytime",
                "30 days unlimited access",
                "Priority support",
                "Detailed kundli analysis"
            ],
            "isActive": True,
            "createdAt": datetime.utcnow()
        }
    ]

    for plan in autopay_plans:
        # Check if exists
        existing = plans.find_one({"planId": plan["planId"]})
        if existing:
            print(f"Updating existing plan: {plan['planId']}")
            plans.update_one(
                {"planId": plan["planId"]},
                {"$set": {**plan, "updatedAt": datetime.utcnow()}}
            )
        else:
            print(f"Creating new plan: {plan['planId']}")
            plans.insert_one(plan)

    print("✅ Auto-pay plans added to database")

if __name__ == "__main__":
    add_autopay_plans()
```

---

## Step 4: Update Enforcement Button Flow

The current flow sends multiple QR codes. The new flow should:

1. Send ONE clean message
2. Send ONE "Subscribe Now" button
3. User clicks → Razorpay subscription page → Authorizes auto-pay

### New Flow for enforcement_buttons.py

```python
# Replace send_enforcement_with_razorpay_buttons with:

async def send_autopay_subscription_only(
    self,
    phone: str,
    user_id: str,
    language: str = "english",
    mongo_logger_url: str = None
):
    """
    Send only ONE auto-pay subscription button (no QR codes, no multiple plans)

    Clean flow:
    1. User hits limit
    2. Bot sends: "Subscribe to continue - ₹9/day, cancel anytime"
    3. User clicks "Subscribe Now"
    4. Razorpay opens → User authorizes UPI auto-pay
    5. ₹9 charged immediately → Access granted
    """

    # Call subscription API to create Razorpay subscription
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.subscriptions_url}/payments/create-subscription",
                json={
                    "userId": user_id,
                    "phone": phone,
                    "planId": "daily_autopay_9",
                    "interval": "daily"
                },
                timeout=30.0
            )

            if response.status_code == 200:
                sub_data = response.json()
                subscribe_url = sub_data.get("short_url")
            else:
                # Fallback to regular payment link
                print(f"[Enforcement] Subscription creation failed: {response.status_code}")
                subscribe_url = None

    except Exception as e:
        print(f"[Enforcement] Error creating subscription: {e}")
        subscribe_url = None

    # Build message based on language
    if language == "hindi" or language == "hinglish":
        message = (
            "✨ *Auto-Pay Subscription*\n\n"
            "₹9/दिन - कभी भी कैंसिल करें\n\n"
            "• रोज़ाना अनलिमिटेड मैसेज\n"
            "• जब चाहें कैंसिल करें\n"
            "• UPI से ऑटो-पे"
        )
    else:
        message = (
            "✨ *Auto-Pay Subscription*\n\n"
            "₹9/day - Cancel anytime\n\n"
            "• Unlimited daily messages\n"
            "• Cancel when you want\n"
            "• UPI auto-pay"
        )

    # Send the subscription button
    if subscribe_url:
        await self._send_payment_link_message(
            phone=phone,
            plan_text=message,
            razorpay_link=subscribe_url
        )
```

---

## Step 5: Add User Commands

Add these commands to message_limiter.py:

```python
# Add to message_limiter.py

CANCEL_KEYWORDS = [
    "cancel", "cancel subscription", "cancel sub", "stop subscription",
    "unsubscribe", "cancel autopay", "रद्द करें", "कैंसिल करें",
    "subscription cancel", "stop auto pay"
]

SUBSCRIBE_KEYWORDS = [
    "subscribe", "sub", "subscription", "plan", "subscribe now",
    "सब्सक्राइब", "प्लान", "सब्सक्रिप्शन"
]

async def handle_cancel_command(user_id: str, phone: str):
    """Handle user cancel subscription command"""
    try:
        async with httpx.AsyncClient() as client:
            # Get user's active subscription
            response = await client.get(
                f"{SUBSCRIPTIONS_URL}/users/{user_id}/subscription"
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("hasActive"):
                    sub = data.get("subscription")
                    razorpay_sub_id = sub.get("razorpaySubscriptionId")

                    if razorpay_sub_id and sub.get("autoPayEnabled"):
                        # Cancel the subscription
                        cancel_response = await client.post(
                            f"{SUBSCRIPTIONS_URL}/payments/cancel-subscription",
                            json={
                                "userId": user_id,
                                "razorpay_subscription_id": razorpay_sub_id
                            }
                        )

                        if cancel_response.status_code == 200:
                            return "✅ Subscription cancelled! Auto-pay stopped. You'll have access until your current end date."

            return "ℹ️ No active auto-pay subscription found."

    except Exception as e:
        print(f"[Cancel Command] Error: {e}")
        return "❌ Error cancelling subscription. Please try again."
```

---

## Step 6: Webhook Flow Summary

### Event → Action Mapping

| Razorpay Event | Your Handler | Action |
|----------------|--------------|--------|
| `subscription.charged` | `_handle_subscription_charged` | Extend endDate by interval (1/7/30 days) |
| `subscription.cancelled` | `_handle_subscription_cancelled` | Set autoPayEnabled=False |
| `subscription.completed` | `_handle_subscription_completed` | All cycles done, auto-pay ends |
| `subscription.failed` | `_handle_subscription_failed` | Log error, Razorpay auto-retries |

### Database Schema for Auto-Pay Subscriptions

```javascript
{
  subscriptionId: "sub_919760347653_1234567890",
  userId: "+919760347653",
  planId: "daily_autopay_9",
  status: "active",
  startDate: "2026-04-25T10:00:00Z",
  endDate: "2026-04-26T10:00:00Z",  // Extended each day

  // Auto-pay fields
  razorpaySubscriptionId: "sub_ShhPVgxXlCkQVb",  // From Razorpay
  razorpayPlanId: "plan_ShhNA5PrZsRR96",  // From Razorpay
  autoPayEnabled: true,
  interval: "daily",  // daily, weekly, monthly
  totalCycles: 30,  // Total number of auto-pay cycles
  completedCycles: 1,  // How many payments completed
  razorpayStatus: "active"  // active, cancelled, completed, failed
}
```

---

## Testing Checklist

- [ ] Razorpay daily plan created: `plan_ShhNA5PrZsRR96`
- [ ] Razorpay weekly plan created
- [ ] Razorpay monthly plan created
- [ ] Environment variables added
- [ ] Auto-pay plans added to database
- [ ] Enforcement button sends subscribe button
- [ ] User can click and authorize UPI
- [ ] Webhook receives subscription.charged
- [ ] Subscription endDate extended by 1 day
- [ ] User can type "cancel" to stop auto-pay
- [ ] Webhook receives subscription.cancelled
- [ ] autoPayEnabled set to false

---

## Quick Start Commands

```bash
# 1. Add auto-pay plans to database
cd hans-ai-subscriptions
python add_autopay_plans.py

# 2. Verify plans
mongosh openclaw_subscriptions --eval "db.plans.find({isAutoPay: true}).pretty()"

# 3. Test subscription creation
curl -X POST http://localhost:8000/payments/create-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "+919760347653",
    "phone": "+919760347653",
    "planId": "daily_autopay_9",
    "interval": "daily"
  }'
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `.env` | Add Razorpay plan IDs |
| `hans-ai-subscriptions/add_autopay_plans.py` | Create new file |
| `hans-ai-whatsapp/app/services/enforcement_buttons.py` | Simplify to one button |
| `hans-ai-whatsapp/app/services/message_limiter.py` | Add cancel/subscribe commands |
