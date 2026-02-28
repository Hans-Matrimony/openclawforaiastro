# Workflow: EVERY Message Must Follow This Order

**This is the CRITICAL workflow that prevents user data leakage.**

## ⚡ SPEED + MANDATORY LOGGING

```
Message arrives
    │
    ├─ Is it a greeting?
    │     └─ YES → Respond immediately → Log user + assistant to MongoDB (parallel) → DONE.
    │
    └─ Is it an astrology question?
          └─ YES →
              ├─ [PARALLEL] Search Mem0 (if needed) + Log user message to MongoDB
              ├─ Search Qdrant (if needed)
              ├─ Respond to user
              └─ Log assistant reply to MongoDB
              → DONE.
```

## The Golden Rule

**Each message = One specific user_id. Never mix users.**

---

## Step-by-Step Workflow (FOLLOW EXACTLY)

### STEP 1: Extract User ID (DO THIS FIRST - NON-NEGOTIABLE)

**Look at the message envelope:**
```
[From: User Name (user_id) at Timestamp]
```

**Extract the user_id:**
- WhatsApp: `+919876543210`
- Telegram: `telegram_1234567`

**If INVALID or missing:**
```
Respond: "Main aapki pehchan nahi kar pa raha hoon. Kripya thodi der baad phir koshish karein."
Then STOP.
```

---

### STEP 2: Quick Classification

**Is this a simple greeting?** ("hi", "hello", "namaste", "good morning", "kaise ho")

- **YES →**
  1. **Respond immediately** (2-3 sentences in Hinglish/English)
  2. **Log user message + assistant reply to MongoDB** (make both calls together, parallel)
  3. **DONE**

- **NO → Continue to STEP 3**

---

### STEP 3: Search Memory + Log User Message (PARALLEL)

**Make these calls TOGETHER (parallel):**

```bash
# Call 1: Search Mem0 (if you need user data)
python skills/mem0/mem0_client.py search "birth details name" --user-id "<EXTRACTED_USER_ID>"

# Call 2: Log user message to MongoDB
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_ID>" \
  --user-id "<USER_ID>" \
  --role "user" \
  --text "<USER_MESSAGE>" \
  --channel "<telegram_or_whatsapp>"
```

**Make BOTH calls at the same time. Don't wait for one before starting the other.**

---

### STEP 4: Consult Knowledge Base (Only if Needed)

**ONLY search Qdrant for complex astrology concepts.**

```bash
python skills/qdrant/qdrant_client.py search "<astrological concept>"
```

**SKIP this step if:**
- Simple question about user's chart
- You already know the answer from training

---

### STEP 5: Respond to User

**Respond in Hinglish or English based on user's language.**

**Keep it short: 2-3 sentences MAX.**

**NO internal summaries, NO status updates, NO tool mentions.**

---

### STEP 6: Save New Info (Only if User Shared Something New)

If user shared NEW birth details or life events:

```bash
python skills/mem0/mem0_client.py add "New information here" --user-id "<EXTRACTED_USER_ID>"
```

---

### STEP 7: 🔴 MANDATORY - Log Assistant Reply to MongoDB

**ALWAYS log your reply:**

```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_ID>" \
  --user-id "<USER_ID>" \
  --role "assistant" \
  --text "<YOUR_REPLY>" \
  --channel "<telegram_or_whatsapp>"
```

---

## 🔴 MongoDB Logging - MANDATORY (But Parallel)

**EVERY message MUST be logged. NO EXCEPTIONS.**

### What to Log:
1. User's message (role="user")
2. Assistant's reply (role="assistant")

### How to Log Fast:
- **For greetings:** Respond first, then make BOTH log calls together (parallel)
- **For questions:** Log user message in PARALLEL with Mem0 search, then log assistant reply after responding

### Logging Commands:

```bash
# Log user message
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_ID>" \
  --user-id "<USER_ID>" \
  --role "user" \
  --text "<MESSAGE>" \
  --channel "telegram"

# Log assistant reply
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_ID>" \
  --user-id "<USER_ID>" \
  --role "assistant" \
  --text "<REPLY>" \
  --channel "telegram"
```

---

## Example Flows

### Example 1: Simple Greeting

```
User: "Hi"
    │
    ├─ STEP 1: Extract user_id ✅
    ├─ STEP 2: It's a greeting →
    │     ├─ Respond: "Namaste! Kaise madad kar sakta hoon?"
    │     └─ [PARALLEL] Log user "Hi" + Log assistant reply to MongoDB
    └─ DONE
```

### Example 2: Astrology Question

```
User: "Meri kundli batao"
    │
    ├─ STEP 1: Extract user_id ✅
    ├─ STEP 2: Not a greeting → Continue
    ├─ STEP 3: [PARALLEL]
    │     ├─ Search Mem0 for user's birth details
    │     └─ Log user message to MongoDB
    ├─ STEP 4: Skip Qdrant (simple chart request)
    ├─ STEP 5: Respond with chart details
    ├─ STEP 6: (No new info to save)
    ├─ STEP 7: Log assistant reply to MongoDB
    └─ DONE
```

---

## Critical Rules

1. **MongoDB logging is MANDATORY** — log EVERY message
2. **Make logging calls in PARALLEL** — don't wait for one to finish before starting another
3. **Simple greetings → Skip Mem0/Qdrant** — Just respond + log
4. **user_id from envelope = user to respond to**
5. **Never mix users** — Each user_id is isolated
6. **Never show User A's data to User B**

---

## Quick Checklist

- [ ] Extracted user_id from envelope
- [ ] Is it a greeting? → Respond immediately, then log (parallel)
- [ ] If astrology question → Search Mem0 + Log user message (parallel)
- [ ] Responded in 2-3 sentences
- [ ] No internal summaries or status updates in response
- [ ] 🔴 Logged assistant reply to MongoDB