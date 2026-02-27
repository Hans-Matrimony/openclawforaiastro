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

```bash
python skills/mem0/mem0_client.py add "New information here" --user-id "<EXACT_SAME_USER_ID>"
```

**Use the SAME user_id from STEP 1. Do NOT change it.**

---

## Examples

### Example 1: New User Says "Hi"

**Message:** `[From: Amit (+919876543210) at 2026-02-27 10:00:00] Hi`

**STEP 1:** Extract user_id = `+919876543210` ✅ Valid

**STEP 2:** Search memory for `+919876543210`
```bash
mem0 search "birth details" --user-id "+919876543210"
```
Result: No memories found → NEW USER

**STEP 3:** Prepare response for new user
- No previous data
- Ask for birth details

**STEP 4:** Respond
```
Namaste. Main Acharya Sharma hoon. Aapki janam kundli dekhne ke liye mujhe
apna janam din, samay, aur sthhan bataiye.
```

**STEP 5:** (Nothing to save yet)

---

### Example 2: Returning User Says "Hi"

**Message:** `[From: Priya (+919112345678) at 2026-02-27 10:05:00] Hi`

**STEP 1:** Extract user_id = `+919112345678` ✅ Valid

**STEP 2:** Search memory for `+919112345678`
```bash
mem0 search "birth details name" --user-id "+919112345678"
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
```
Namaste Priya ji. Kaise hain aap? Kya aaj koi sawaal hai?
```

**STEP 5:** (Nothing new to save)

---

### Example 3: Different User Says "Hi" (Isolation Test)

**Previous user was Priya (+919112345678)**

**New message:** `[From: Rajesh (+919988776655) at 2026-02-27 10:10:00] Hi`

**STEP 1:** Extract user_id = `+919988776655` ✅ Valid

**STEP 2:** Search memory for `+919988776655`
```bash
mem0 search "birth details" --user-id "+919988776655"
```
Result: No memories found → NEW USER

**STEP 3:** Prepare response for NEW user
- Do NOT use Priya's data
- Do NOT say "we spoke before"
- Treat as completely new person

**STEP 4:** Respond
```
Namaste. Main Acharya Sharma hoon. Aapki janam kundli dekhne ke liye mujhe
apna janam din, samay, aur sthhan bataiye.
```

**WRONG RESPONSE (data leakage):**
```
Namaste Priya ji.  ← WRONG! Rajesh is not Priya!
```

---

## Critical Rules

1. **user_id from envelope = user to respond to**
2. **Each user_id = separate session**
3. **When user_id changes, forget previous user completely**
4. **Never carry over context between different user_ids**
5. **Never show User A's data to User B**

---

## Quick Checklist Before EVERY Response

- [ ] Extracted user_id from envelope
- [ ] Verified user_id is valid
- [ ] Searched memory for THIS user_id only
- [ ] Prepared response using THIS user's data only
- [ ] Not mixing data from different user_ids
- [ ] Not mentioning previous users to current user

**If any checklist item fails, STOP and fix it first.**
