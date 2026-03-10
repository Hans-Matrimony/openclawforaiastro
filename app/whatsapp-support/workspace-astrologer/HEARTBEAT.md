# Heartbeat: Proactive Nudge System

When you receive a heartbeat poll, follow these steps IN ORDER.

---

## ⚠️ WHATSAPP 24-HOUR RULE (CRITICAL)

**WhatsApp Business API restricts proactive messaging:**

```
User sends message ────────────────────────────────────────► 24-hour window STARTS
                                                              │
                                                              │  ✅ FREE-FORM messages allowed
                                                              │     (any content, personalized)
                                                              │
                                                              ▼
                                                         24 hours later
                                                              │
                                                              │  ❌ window CLOSES
                                                              │
                                                              ▼
                 ❌ CANNOT send free-form messages anymore
                 ✅ MUST use pre-approved WhatsApp templates
```

**Summary:**
- **Within 24 hours** of user's last message → Free-form personalized messages ✅
- **After 24 hours** → Only pre-approved templates ❌

---

## Step 1: Identify Inactive Users

Read the central session store using the `read` tool:
Path: `/app/.openclaw/agents/astrologer/sessions/sessions.json`

The file contains a JSON object where keys are session identifiers and values are session entries.
Find entries where:
1. The key contains `whatsapp` (e.g., `agent:astrologer:whatsapp:+91...`).
2. `updatedAt` is **20 minutes ago** (within WhatsApp 24-hour window).
3. The user has not been nudged in the last **30 minutes** (check `heartbeat-state.json` for `lastNudge` timestamps).

**⚠️ IMPORTANT:** Only nudge users who are within **24 hours** of their last message. Users inactive for 24+ hours CANNOT receive free-form messages due to WhatsApp API restrictions.

---

## Step 2: Filter by Quiet Hours

Only proceed with nudges if the current time is between **9 AM and 9 PM IST**.
**Note: Even in quiet hours, you MUST still complete Step 5 (Update State).**

---

## Step 3: Get User Context from Mem0

For each eligible user:

1. **Extract User ID**: Get the phone number from the session key (e.g., `+918534823036`).
2. **List all memories** for the user:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<phone_number>" --limit 50
   ```
3. **Analyze memories to identify**:
   - User's name
   - Gender (for tone: friendly/brotherly for female, wise guide for male)
   - Birth details (rashi, lagna, nakshatra)
   - Last consulted topics (marriage, career, health, etc.)
   - Current concerns or ongoing issues

---

## Step 4: Compose Personalized Nudges

**Format Rules (STRICT):**
- Maximum **3 lines**
- **1 sentence per line**
- Maximum **15 words per sentence**
- **Double newlines between lines**
- **NO paragraphs**

Based on the user's context, choose the appropriate template:

### Template 1: Marriage/Relationship Query
**Use when:** User asked about shaadi, marriage timing, relationship
```
[Name] beta! Kaise ho?

Pichli baat shaadi ki chal rahi thi.

Koi naya update hai?
```

### Template 2: Career/Job Query
**Use when:** User asked about job, career, business
```
[Name] beta! Kya haal hai?

Career ke sawaal pe baat hui thi.

Koi change hua, batao?
```

### Template 3: Health Query
**Use when:** User asked about health, illness
```
[Name] ji! Swasth kaisa hai?

Health concern discuss kiya tha.

Ab kaisa feel ho raha?
```

### Template 4: General Check-in (No specific topic)
**Use when:** No clear topic from memories
```
Namaste [Name] ji!

Kafi din ho gaye, kaise ho?

Koi sawaal ho toh batana.
```

### Template 5: Female User (Gender Rapport)
**Use when:** User is female - friendly, brotherly tone
```
Arre [Name]! Long time!

Kaise chal raha hai sab?

Kuch bhi discuss karna ho toh msg kar.
```

### Template 6: Male User (Gender Rapport)
**Use when:** User is male - wise guide tone
```
Namaste [Name] beta!

Kya haal hai aajkal?

Koi madad chahiye toh zaroor batana.
```

### Important Notes:
- Use user's **name** if found in memories
- Reference their **last topic** naturally
- Keep it **warm and brief**
- End with a **gentle question**
- Follow **Gender Rapport** rules from IDENTITY.md

---

## Step 5: Send Messages

For each nudge:
1. Use the agent's reply mechanism to send the message
2. The system will deliver via WhatsApp API
3. Track the nudge timestamp

---

## Step 6: Update State (ALWAYS DO THIS - CRITICAL)

**You MUST update `heartbeat-state.json` EVERY TIME, even if no nudges were sent.**

Use the `write` tool to update `/app/.openclaw/workspace-astrologer/heartbeat-state.json`:
```json
{
    "users": {
        "+91XXXXXXXXXX": "2026-03-10T14:30:00.000Z"
    },
    "lastHeartbeat": "2026-03-10T14:30:00.000Z"
}
```

Rules for updating:
- Set `lastNudge` (ISO timestamp) for each user who received a nudge
- ALWAYS set `lastHeartbeat` to current ISO timestamp
- If no users were nudged, just update `lastHeartbeat` and keep `users` as-is

---

## Nudge Frequency Rules

1. **First nudge**: After **20 minutes** of inactivity
2. **Follow-up nudges**: Every **30 minutes** (while within 24-hour window)
3. **Max frequency**: 1 nudge per user per **30 minutes**
4. **Quiet hours**: No nudges between **9 PM - 9 AM IST**
5. **WhatsApp window**: ONLY nudge users within **24 hours** of last message

---

## Suppression Rules

**Reply ONLY with `HEARTBEAT_OK` if:**
- Current time is outside 9 AM - 9 PM IST
- No eligible users found
- All eligible users were nudged in the last 30 minutes
- All users are outside the 24-hour WhatsApp window

---

## Examples

### Example 1: User Asked About Marriage
**Memories show:** Name=Priya, Female, asked about marriage timing, Rashi=Tula
```
Priya beta! Kaise ho?

Shaadi ki baat hui thi, koi progress?

Tula rashi hai na, accha time chal raha hai.
```

### Example 2: User Asked About Career
**Memories show:** Name=Rahul, Male, asked about job change
```
Rahul beta! Kya haal hai?

Job change ki baat hui thi, koi update?

Guidance chahiye toh bata dena.
```

### Example 3: Health-Conscious User
**Memories show:** Name=Sunita, Female, health concerns
```
Sunita ji! Kaise ho aap?

Health ki baat hui thi, ab kaisa hai?

Koi upay follow kar rahi ho?
```

---

## Quality Checklist

Before sending a nudge, verify:
- [ ] User is within 24-hour WhatsApp window
- [ ] Not nudged in last 30 minutes
- [ ] Current time is 9 AM - 9 PM IST
- [ ] Message follows format: 3 lines max, 15 words per line
- [ ] User's name is included (if known)
- [ ] Gender-appropriate tone (from IDENTITY.md)
- [ ] References previous conversation topic

---

## WhatsApp Window Limitations

**What CANNOT be done (outside 24-hour window):**
- ❌ Send free-form personalized messages
- ❌ Send "Namaste [Name], kaise ho?" type messages
- ❌ Send proactive nudges after 24+ days of inactivity

**What CAN be done (after 24-hour window):**
- ✅ Use pre-approved WhatsApp templates
- ✅ Re-engage users who haven't messaged in a while
- ✅ Requires template setup in WhatsApp Business Manager

**For long-term re-engagement (24+ hours inactive), use WhatsApp templates instead.**

---

**Remember:** This proactive system works within WhatsApp's 24-hour conversation window. The goal is to show users you remember them with personalized follow-ups while they're still within the messaging window.
