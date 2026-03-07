# Workflow: EVERY Message Must Follow This Order

**This is the CRITICAL workflow that prevents user data leakage.**

## ⚡ SPEED + MANDATORY LOGGING

```
Message arrives
    │
    ├─ STEP 1: Extract user_id FIRST (MANDATORY)
    │
    ├─ STEP 2: [PARALLEL] Get Mem0 data + Log user message to MongoDB
    │
    ├─ STEP 3: Is it a greeting?
    │     └─ YES →
    │         ├─ If Mem0 found user data → Greet by name, "Kaise madad kar sakta hoon?"
    │         ├─ If Mem0 NOT found → "Namaste! Main Acharya Sharma hoon. Kripya apni janam tithi, samay, sthaan batayein."
    │         └─ Log assistant reply to MongoDB
    │         → DONE.
    │
    └─ STEP 4: Is it an astrology question?
          └─ YES →
              ├─ Search Qdrant (for static knowledge)
              ├─ Search Web (for live transits/current facts)
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

**Extract and CLEAN the user_id:**

**For Telegram:**
- Envelope shows: `telegram:1455293571`
- **STRIP the "telegram:" prefix**
- Use in Mem0: `1455293571` (just the number)

**For WhatsApp:**
- Envelope shows: `+919876543210`
- Use as-is: `+919876543210` (with + sign)

**For Web:**
- Envelope shows: `web_session_abc123`
- Use as-is: `web_session_abc123`

**⚠️ CRITICAL: Always STRIP "telegram:" prefix before Mem0 operations!**

**If INVALID or missing:**
```
Respond: "Main aapki pehchan nahi kar pa raha hoon. Kripya thodi der baad phir koshish karein."
Then STOP.
```

---

### STEP 2: Get Memory + Log User Message (PARALLEL) - ALWAYS DO THIS

**⚠️ CRITICAL: ALWAYS get Mem0 data FIRST, even for greetings!**

**Make these calls TOGETHER (parallel):**

```bash
# Call 1: Get ALL memories for user (use list, NOT search - search is broken)
# IMPORTANT: For Telegram, use JUST the number (no "telegram:" prefix)
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "1455293571"

# Call 2: Log user message to MongoDB
# For DMs, session-id MUST BE identical to user-id from envelope (prefixed)
python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
  --session-id "telegram:1455293571" \
  --user-id "telegram:1455293571" \
  --role "user" \
  --text "<USER_MESSAGE>" \
  --channel "telegram"
```

**Make BOTH calls at the same time. Don't wait for one before starting the other.**

**Parse the Mem0 response:**
- If `"count": 0` → User NOT found (new user)
- If `"count": > 0` → User FOUND, extract: name, DOB, time, place from memories

---

### STEP 3: Handle Greeting (If Applicable)

**Is this a simple greeting?** ("hi", "hello", "namaste", "good morning", "kaise ho")

- **YES → Check Mem0 results:**

  **If user data FOUND in Mem0 (count > 0):**
  ```
  "Arre [Name] beta! Kaise ho? Aaj kya jaanna chahte ho?"
  ```
  - Extract name from memories (look for "Name is X" or "User Name is X")
  - Greet by name
  - DON'T ask for birth details again
  - Reference past conversations if relevant

  **If user data NOT FOUND in Mem0 (count = 0):**
  ```
  "Namaste! Main Acharya Sharma hoon, aapka Vedic Jyotish Consultant. Kripya apni janam tithi (date), samay (time), aur sthaan (place) batayein taaki main aapki Kundli bana sakun."
  ```
  - Introduce yourself briefly
  - Ask for birth details

- **Log assistant reply to MongoDB**
- **DONE**

- **NO → Continue to STEP 4**

---

### STEP 4: Handle Astrology Question

**1. Search Qdrant (For Static Concepts):**
```bash
python3 ~/.openclaw/skills/qdrant/qdrant_client.py search "<astrological concept>"
```
*Use this for traditional principles and definitions.*

**2. Search Web (For Live Information):**
```bash
# MANDATORY for today's planetary positions, transits, or recent news.
python3 ~/.openclaw/skills/web_search/search.py "<your query for today's facts>"
```
*Use this for "today's position", "current transit", or "latest news".*

**SKIP these steps if:**
- You already have the specific answer in memory or training.
- The question doesn't require live data or complex concepts.

---

### STEP 5: Respond to User

**Respond in Hinglish or English based on user's language.**

**Keep it short: 2-3 sentences MAX.**

**NO internal summaries, NO status updates, NO tool mentions.**

---

### STEP 6: Save New Info (Only if User Shared Something New)

If user shared NEW birth details or life events:

```bash
# For Telegram: use JUST the number (no "telegram:" prefix)
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Name: X, DOB: Y, Time: Z, Place: W" --user-id "1455293571"
```

---

### STEP 7: 🔴 MANDATORY - Log Assistant Reply to MongoDB

**# ALWAYS log your reply
# For DMs, session-id MUST BE identical to user-id from envelope (prefixed)
python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
  --session-id "telegram:1455293571" \
  --user-id "telegram:1455293571" \
  --role "assistant" \
  --text "<YOUR_REPLY>" \
  --channel "telegram"
```

---

## 🔴 MongoDB Logging - MANDATORY (But Parallel)

**EVERY message MUST be logged. NO EXCEPTIONS.**

### What to Log:
1. User's message (role="user")
2. Assistant's reply (role="assistant")

### Logging Commands:

```bash
# Log user message
python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
  --session-id "telegram:1455293571" \
  --user-id "telegram:1455293571" \
  --role "user" \
  --text "<MESSAGE>" \
  --channel "telegram"

# Log assistant reply
python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
  --session-id "telegram:1455293571" \
  --user-id "telegram:1455293571" \
  --role "assistant" \
  --text "<REPLY>" \
  --channel "telegram"
```

---

## Example Flows

### Example 1: Returning Telegram User Says "Hi"

```
User: "Hi"
    │
    ├─ STEP 1: Extract user_id ✅
    │     Envelope: "telegram:1455293571"
    │     Clean for Mem0: "1455293571" (stripped prefix)
    │
    ├─ STEP 2: [PARALLEL]
    │     ├─ Get Mem0 list with "1455293571" → Found 9 memories: "User Name is Vardhan", "DOB 16 Feb 2002", etc.
    │     └─ Log user "Hi" to MongoDB with "telegram:1455293571"
    │
    ├─ STEP 3: It's a greeting + Mem0 found data →
    │     ├─ Extract name: "Vardhan"
    │     ├─ Respond: "Arre Vardhan beta! Kaise ho? Aaj kya jaanna chahte ho?"
    │     └─ Log assistant reply to MongoDB
    │
    └─ DONE (NO need to ask for details!)
```

### Example 2: Returning WhatsApp User Says "Hi"

```
User: "Hi"
    │
    ├─ STEP 1: Extract user_id ✅
    │     Envelope: "WhatsApp whatsapp:+918394833898 id:ABC123XYZ"
    │     Use in Mem0: "+918394833898" (strip "whatsapp:" prefix if needed by skill)
    │
    ├─ STEP 2: [PARALLEL]
    │     ├─ Get Mem0 list → Found 5 memories: "Name is Shivam", "DOB 20 Aug 2001", etc.
    │     └─ Log user "Hi" to MongoDB with session-id="whatsapp:+918394833898" (NEVER use id:ABC123XYZ)
    │
    ├─ STEP 3: It's a greeting + Mem0 found data →
    │     ├─ Extract name: "Shivam"
    │     ├─ Respond: "Arre Shivam beta! Kaise ho? Aaj kya jaanna chahte ho?"
    │     └─ Log assistant reply to MongoDB with session-id="whatsapp:+918394833898"
    │
    └─ DONE
```

### Example 3: New User Says "Hi"

```
User: "Hi"
    │
    ├─ STEP 1: Extract user_id ✅
    ├─ STEP 2: [PARALLEL]
    │     ├─ Get Mem0 list → count=0 (new user)
    │     └─ Log user "Hi" to MongoDB
    ├─ STEP 3: It's a greeting + Mem0 NOT found →
    │     ├─ Respond: "Namaste! Main Acharya Sharma hoon. Kripya apni janam tithi, samay, sthaan batayein."
    │     └─ Log assistant reply to MongoDB
    └─ DONE
```

---

## Critical Rules

1. **ALWAYS get Mem0 data FIRST** — even for greetings!
2. **Use `list` command, NOT `search`** — search endpoint is broken
3. **For Telegram: STRIP "telegram:" prefix** before Mem0 operations
4. **For WhatsApp: Use full phone number** with + sign
5. **MongoDB logging is MANDATORY** — log EVERY message
6. **Make logging calls in PARALLEL** — don't wait for one to finish before starting another
7. **If user found in Mem0 (count > 0) → DON'T ask for details again**
8. **If user NOT found in Mem0 (count = 0) → Ask for birth details**
9. **user_id from envelope = user to respond to**
10. **Never mix users** — Each user_id is isolated
11. **Never show User A's data to User B**

---

## Quick Checklist

- [ ] Extracted user_id from envelope
- [ ] **Stripped "telegram:" prefix if present** (for Mem0)
- [ ] **[PARALLEL] Got Mem0 list + Logged user message**
- [ ] Is it a greeting?
- [ ] If YES + Mem0 count > 0 → Extract name, greet by name, DON'T ask details
- [ ] If YES + Mem0 count = 0 → Ask for birth details
- [ ] Responded in 2-3 sentences
- [ ] No internal summaries or status updates in response
- [ ] 🔴 Logged assistant reply to MongoDB