# Auto-Pay Subscription - Quick Start Guide

## Good News: Already Implemented! ✅

Your codebase already has the auto-pay subscription flow implemented in:
- `hans-ai-subscriptions/server.py` - Webhook handlers, create/cancel subscription endpoints
- `hans-ai-whatsapp/app/services/enforcement_buttons.py` - `send_enforcement_with_subscription_flow()` method

## What Needs To Be Done

### Step 1: Create Razorpay Dashboard Plans (5 minutes)

You already have the daily plan: `plan_ShhNA5PrZsRR96` ✅

Create weekly and monthly plans:

1. Go to: https://dashboard.razorpay.com/subscriptions/plans
2. Click "Create Plan" for each:

**Weekly Plan:**
- Name: Weekly ₹49 Auto-Pay
- Amount: 4900 (₹49)
- Interval: 1
- Period: week
- Total Cycles: 12

**Monthly Plan:**
- Name: Monthly ₹199 Auto-Pay
- Amount: 19900 (₹199)
- Interval: 1
- Period: month
- Total Cycles: 12

3. Copy the plan IDs they generate (format: `plan_XXXXXXXXXX`)

### Step 2: Add Environment Variables (1 minute)

Add to `hans-ai-subscriptions/.env`:

```bash
# Razorpay Auto-Pay Subscription Plans
RAZORPAY_DAILY_PLAN_ID=plan_ShhNA5PrZsRR96
RAZORPAY_WEEKLY_PLAN_ID=plan_<YOUR_WEEKLY_PLAN_ID>
RAZORPAY_MONTHLY_PLAN_ID=plan_<YOUR_MONTHLY_PLAN_ID>
```

### Step 3: Add Plans to Database (1 minute)

```bash
cd hans-ai-subscriptions
python add_autopay_plans.py
```

### Step 4: Switch to Subscription Flow (5 minutes)

**Change in `hans-ai-whatsapp/app/services/tasks.py`:**

Find these 3 locations and replace:
- Line ~2493
- Line ~2637
- Line ~2832

**FROM:**
```python
success = await _razorpay_whatsapp_payment.send_enforcement_with_razorpay_buttons(
    phone=phone,
    user_id=user_id,
    astrologer_name=astrologer_name,
    language=user_language,
    enforcement_type="daily_limit",
    mongo_logger_url=MONGO_LOGGER_URL,
    send_intro_message=False
)
```

**TO:**
```python
success = await _razorpay_whatsapp_payment.send_enforcement_with_subscription_flow(
    phone=phone,
    user_id=user_id,
    astrologer_name=astrologer_name,
    language=user_language,
    enforcement_type="daily_limit",
    mongo_logger_url=MONGO_LOGGER_URL
)
```

That's it! You're done.

---

## How The Flow Works

```
User hits message limit (40/40 or 11/day)
    ↓
Bot sends:
    💫 I'd love to continue our conversation!

    You've reached your free message limit 😔

    *Subscribe with auto-pay - Cancel anytime*

    • Daily: ₹9/day
    • Weekly: ₹49/week
    • Monthly: ₹199/month

    Choose a plan below to continue:
    ↓
User taps "Daily - ₹9/day" button
    ↓
Razorpay subscription page opens
    ↓
User authorizes UPI auto-pay
    ↓
₹9 charged immediately → User gets 1 day access
    ↓
NEXT DAY: ₹9 auto-charged → Access extended by 1 day
NEXT DAY: ₹9 auto-charged → Access extended by 1 day
...continues for 30 days
    ↓
User types "cancel" → Auto-pay stops
```

---

## Testing Checklist

- [ ] Razorpay weekly plan created
- [ ] Razorpay monthly plan created
- [ ] Environment variables added to .env
- [ ] Plans added to database (ran `add_autopay_plans.py`)
- [ ] tasks.py updated to use `send_enforcement_with_subscription_flow`
- [ ] Test enforcement trigger → Should see 3 buttons (Daily/Weekly/Monthly)
- [ ] Click Daily button → Razorpay subscription page opens
- [ ] Authorize payment → Webhook received → Subscription created
- [ ] Check database: `db.subscriptions.find({userId: "+919760347653"}).pretty()`
- [ ] Next day: Auto-payment triggers → endDate extended

---

## User Commands (Optional Add-on)

You can add these commands later:

```python
# In message_limiter.py or message handler

if user_message.lower() in ["cancel", "cancel subscription", "unsubscribe"]:
    # Call cancel endpoint
    response = await httpx.post(
        f"{SUBSCRIPTIONS_URL}/payments/cancel-subscription",
        json={"userId": user_id, "razorpay_subscription_id": sub_id}
    )
    return "✅ Subscription cancelled! Auto-pay stopped."

if user_message.lower() in ["status", "subscription status"]:
    # Get subscription status
    response = await httpx.get(f"{SUBSCRIPTIONS_URL}/users/{user_id}/subscription")
    # Show end date, auto-pay status, etc.
```

---

## Database Schema

```javascript
// subscriptions collection
{
  subscriptionId: "sub_919760347653_1234567890",
  userId: "+919760347653",
  planId: "daily_9",
  status: "active",
  startDate: "2026-04-25T10:00:00Z",
  endDate: "2026-04-26T10:00:00Z",  // Extended each day

  // Auto-pay fields
  razorpaySubscriptionId: "sub_ShhPVgxXlCkQVb",
  razorpayPlanId: "plan_ShhNA5PrZsRR96",
  autoPayEnabled: true,
  interval: "daily",
  totalCycles: 30,
  completedCycles: 1,
  razorpayStatus: "active"
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `.env` | Add RAZORPAY_DAILY_PLAN_ID, etc. |
| `hans-ai-subscriptions/add_autopay_plans.py` | Created (run once) |
| `hans-ai-whatsapp/app/services/tasks.py` | 3 function call changes |

---

## Webhook Events (Already Handled)

| Event | Handler | Action |
|-------|---------|--------|
| subscription.charged | `_handle_subscription_charged` | Extend endDate |
| subscription.cancelled | `_handle_subscription_cancelled` | Stop auto-pay |
| subscription.completed | `_handle_subscription_completed` | All cycles done |
| subscription.failed | `_handle_subscription_failed` | Log error |

---

## What's Different: Old vs New

**Old Flow (One-Time Payment):**
- User pays ₹19 → Gets 1 day
- Tomorrow: Must pay again manually
- 7 messages sent (intro + 3 buttons + 3 QR codes)

**New Flow (Auto-Pay Subscription):**
- User authorizes ₹9/day → Gets 1 day
- Tomorrow: ₹9 auto-charged → Access extended automatically
- 3 messages sent (intro + 3 buttons + footer)
- User can cancel anytime

---

## Quick Commands

```bash
# 1. Add plans to database
cd hans-ai-subscriptions
python add_autopay_plans.py

# 2. Verify plans in database
mongosh openclaw_subscriptions --eval "db.plans.find({isAutoPay: true}).pretty()"

# 3. Check user's subscription
mongosh openclaw_subscriptions --eval "db.subscriptions.find({userId: '+919760347653'}).pretty()"

# 4. Test webhook manually (if needed)
curl -X POST http://localhost:8000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{...}'
```
