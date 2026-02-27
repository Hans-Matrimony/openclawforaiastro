# Workflow: EVERY Message Must Follow This Order

**This is the CRITICAL workflow that prevents user data leakage.**

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
- Web: `web_session_abc123`

**VERIFY the user_id:**
- Is it empty? → INVALID
- Is it "unknown", "default", "user123"? → INVALID
- Is it a real identifier from envelope? → VALID

**If INVALID:**
```
Respond: "Main aapki pehchan nahi kar pa raha hoon. Kripya thodi der baad phir koshish karein."
Then STOP. Do nothing else.
```

---

### STEP 2: Create or Retrieve Session for THIS User ID

**Now that you have a valid user_id:**

1. **This user_id represents ONE specific person**
2. **Check memory for this user_id ONLY**
3. **Do NOT check memory for any other user_id**

**Search for existing session:**
```bash
python skills/mem0/mem0_client.py search "birth details name" --user-id "<EXTRACTED_USER_ID>"
```

**If results found:** This is an existing user. Load their details.
**If no results:** This is a NEW user. Create new session.

---

### STEP 3: Prepare Response for THIS User Only

**Using ONLY data from THIS user_id's memory:**

- Use THEIR name
- Use THEIR birth details
- Use THEIR past conversations
- Use THEIR preferences

**NEVER use data from a different user_id.**

---

### STEP 4: Respond to THIS User Only

**Send response to the current user only.**

Do NOT mention other users. Do NOT reference other conversations. Do NOT share data from other user_ids.

---

### STEP 5: Update THIS User's Session (if needed)

**If the user shared new information:**

**If the user shared new information:**

```bash
python skills/mem0/mem0_client.py add "New information here" --user-id "<EXACT_SAME_USER_ID>"
```

**Use the SAME user_id from STEP 1. Do NOT change it.**

---

### STEP 6: LOG TO MONGODB (🔴 MANDATORY - EVERY MESSAGE)

**THIS STEP IS NON-NEGOTIABLE. LOG EVERY SINGLE MESSAGE FOR EVERY USER.**

You MUST log BOTH the user's message AND your reply to MongoDB. No exceptions.

**Determine the channel from the envelope:**
- If envelope shows \`channel: "telegram"\` → use \`--channel "telegram"\`
- If envelope shows \`channel: "whatsapp"\` → use \`--channel "whatsapp"\`

**Log the user's message (BEFORE responding):**
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_OR_CHAT_ID>" \
  --user-id "<EXTRACTED_USER_ID>" \
  --role "user" \
  --text "<USER_MESSAGE_TEXT>" \
  --channel "<telegram_or_whatsapp>"
```

**After generating your reply, log it too:**
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "<SESSION_OR_CHAT_ID>" \
  --user-id "<EXTRACTED_USER_ID>" \
  --role "assistant" \
  --text "<YOUR_REPLY_TEXT>" \
  --channel "<telegram_or_whatsapp>"
```

**⚠️ CRITICAL:**
- Use the EXACT user_id from STEP 1
- Use the CORRECT channel (telegram/whatsapp) from the envelope
- Log EVERY message for EVERY user — no skipping
- This step MUST happen even if you skip STEP 5

---

## Examples

### Example 1: New User Says "Hi" (WhatsApp)

**Message:** \`[From: Amit (+919876543210) at 2026-02-27 10:00:00] Hi\`

**STEP 1:** Extract user_id = \`+919876543210\` ✅ Valid

**STEP 2:** Search memory for \`+919876543210\`
```bash
mem0 search "birth details" --user-id "+919876543210"
```
Result: No memories found → NEW USER

**STEP 3:** Prepare response for new user
- No previous data
- Ask for birth details

**STEP 4:** Respond
\`\`\`
Namaste. Main Acharya Sharma hoon. Aapki janam kundli dekhne ke liye mujhe
apna janam din, samay, aur sthhan bataiye.
\`\`\`

**STEP 5:** (Nothing to save yet)

**STEP 6:** Log to MongoDB
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "+919876543210" \
  --user-id "+919876543210" \
  --role "user" \
  --text "Hi" \
  --channel "whatsapp"
```
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "+919876543210" \
  --user-id "+919876543210" \
  --role "assistant" \
  --text "Namaste. Main Acharya Sharma hoon..." \
  --channel "whatsapp"
```

---

### Example 2: Returning User Says "Hi" (Telegram)

**Message:** \`[From: Priya (telegram_1234567) at 2026-02-27 10:05:00] Hi\`

**STEP 1:** Extract user_id = \`telegram_1234567\` ✅ Valid

**STEP 2:** Search memory for \`telegram_1234567\`
```bash
mem0 search "birth details name" --user-id "telegram_1234567"
```
Result: Found memories
- Name: Priya
- DOB: 5 March 1995
- Time: 8:30 AM
- Place: Delhi

**STEP 3:** Prepare response using Priya's data
- Use her name: Priya
- Use her birth details
- Remember her past questions

**STEP 4:** Respond
\`\`\`
Namaste Priya ji. Kaise hain aap? Kya aaj koi sawaal hai?
\`\`\`

**STEP 5:** (Nothing new to save)

**STEP 6:** Log to MongoDB
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "telegram_1234567" \
  --user-id "telegram_1234567" \
  --role "user" \
  --text "Hi" \
  --channel "telegram"
```
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "telegram_1234567" \
  --user-id "telegram_1234567" \
  --role "assistant" \
  --text "Namaste Priya ji. Kaise hain aap?..." \
  --channel "telegram"
```

---

### Example 3: Different User Says "Hi" (Isolation Test)

**Previous user was Priya (telegram_1234567)**

**New message:** \`[From: Rajesh (telegram_7654321) at 2026-02-27 10:10:00] Hi\`

**STEP 1:** Extract user_id = \`telegram_7654321\` ✅ Valid

**STEP 2:** Search memory for \`telegram_7654321\`
```bash
mem0 search "birth details" --user-id "telegram_7654321"
```
Result: No memories found → NEW USER

**STEP 3:** Prepare response for NEW user
- Do NOT use Priya's data
- Do NOT say "we spoke before"
- Treat as completely new person

**STEP 4:** Respond
\`\`\`
Namaste. Main Acharya Sharma hoon. Aapki janam kundli dekhne ke liye mujhe
apna janam din, samay, aur sthhan bataiye.
\`\`\`

**STEP 5:** (Nothing to save yet)

**STEP 6:** Log to MongoDB (CRITICAL - this user was not being logged before!)
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "telegram_7654321" \
  --user-id "telegram_7654321" \
  --role "user" \
  --text "Hi" \
  --channel "telegram"
```
```bash
python skills/mongo_logger/logger_client.py log \
  --session-id "telegram_7654321" \
  --user-id "telegram_7654321" \
  --role "assistant" \
  --text "Namaste. Main Acharya Sharma hoon..." \
  --channel "telegram"
```

**WRONG RESPONSE (data leakage):**
\`\`\`
Namaste Priya ji.  ← WRONG! Rajesh is not Priya!
\`\`\`

---

## Critical Rules

1. **user_id from envelope = user to respond to**
2. **Each user_id = separate session**
3. **When user_id changes, forget previous user completely**
4. **Never carry over context between different user_ids**
5. **Never show User A's data to User B**
6. **🔴 ALWAYS log to MongoDB for EVERY user - no exceptions**

---

## Quick Checklist Before EVERY Response

- [ ] Extracted user_id from envelope
- [ ] Verified user_id is valid
- [ ] Searched memory for THIS user_id only
- [ ] Prepared response using THIS user's data only
- [ ] Not mixing data from different user_ids
- [ ] Not mentioning previous users to current user
- [ ] 🔴 Logged user message to MongoDB (STEP 6)
- [ ] 🔴 Will log assistant reply to MongoDB after responding

**If any checklist item fails, STOP and fix it first.**