# Heartbeat: Proactive Nudge System

**When you receive a heartbeat poll, your goal is to send personalized follow-up messages to users who haven't messaged in a while.**

---

## ⚠️ CRITICAL RULES (READ FIRST!)

1. **WhatsApp 24-Hour Window:** ONLY nudge users who messaged within the last 24 hours
2. **Quiet Hours:** ONLY nudge between 9 AM - 9 PM IST
3. **Nudge Cooldown:** NEVER nudge the same user within 30 minutes
4. **Use "ji" NOT "beta":** When name is known, ALWAYS use "[Name] ji"

---

## Step 1: Identify Eligible Users

**⚠️ IMPORTANT: OpenClaw sessions.json doesn't have WhatsApp data. Use MongoDB instead!**

**Option A: Use MongoDB Logger API (RECOMMENDED - Works Now!)**

Use the `exec` tool to query MongoDB Logger API:
```bash
curl -s "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/messages" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'users' in data:
    for user in data['users']:
        userId = user['userId']
        sessions = user.get('sessions', [])
        for session in sessions:
            lastMsg = session.get('lastMessageTime', '')
            channel = session.get('channel', '')
            if 'whatsapp' in channel.lower():
                from datetime import datetime
                lastTime = datetime.fromisoformat(lastMsg.replace('Z', '+00:00'))
                inactiveMins = (datetime.now() - lastTime).total_seconds() / 60
                if inactiveMins >= 5:  # 5+ minutes inactive
                    print(f'USER_ID: {userId}')
                    print(f'INACTIVE_MINUTES: {inactiveMins:.1f}')
                    print(f'LAST_MESSAGE: {lastMsg}')
                    print('---')
"
```

**Option B: Check OpenClaw Sessions (Fallback - Probably Empty)**

```bash
read ~/.openclaw/agents/astrologer/sessions/sessions.json
```

**⚠️ EXPECTED RESULT:** Option A will show WhatsApp users, Option B will be empty.

**Find users WHERE:**
1. User's channel contains `whatsapp`
2. Last message was **5+ minutes ago**
3. Last message was **within 24 hours** (WhatsApp window)
4. NOT nudged in last 10 minutes

**⚠️ STOP if:**
- Current time is before 9 AM or after 9 PM IST → Reply `HEARTBEAT_OK`
- No eligible users found → Reply `HEARTBEAT_OK`
- All users nudged in last 30 minutes → Reply `HEARTBEAT_OK`

---

## ⚠️ TESTING CONFIGURATION (CURRENT)

**For testing purposes, heartbeat is configured to:**
- Run every **5 minutes** (very frequent for testing)
- Check for users inactive for **5+ minutes**
- Nudge cooldown: **10 minutes** (don't spam during testing)
- Active hours: **9 AM - 9 PM IST**

**🔴 FOR PRODUCTION:** Change these values:
- Run every **1-2 hours** (not too frequent)
- Check for users inactive for **8-10 hours** (realistic inactivity)
- Nudge cooldown: **30 minutes** (avoid annoyance)

---

## Step 2: Get User Context from Mem0

**For EACH eligible user, run:**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<phone_number>" --limit 50
```

**Extract from memories:**
- User's name (if available)
- Language preference (English vs Hinglish)
- Last topic discussed (marriage, career, health, etc.)
- Any predictions given (to reference in nudge)

---

## Step 3: Compose Personalized Nudge

**⚠️ CRITICAL: Match Language Mode!**
- If user speaks English → Use English template
- If user speaks Hinglish → Use Hinglish template
- If name is known → Use "[Name] ji" (NOT "beta"!)

### Template 1: Marriage/Relationship Query
**Use when:** User asked about shaadi, marriage timing, relationship

**HINGLISH MODE:**
```
Arre [Name] ji! Kya ho gaya?

Pichli baar shaadi ki baat hui thi, koi update hai?

April ke baad time accha hai, bata na kaisa chal raha hai.
```

**ENGLISH MODE:**
```
Oh wow [Name] ji! How have you been?

We were discussing your marriage last time, any updates?

The timing looks good after April, let me know how things are going.
```

### Template 2: Career/Job Query
**Use when:** User asked about job, career, business

**HINGLISH MODE:**
```
[Name] ji! Kya haal hai aajkal?

Job change ki baat hui thi, koi update hai job mein?

Next 2 months mein acche opportunities aa sakte hain.
```

**ENGLISH MODE:**
```
[Name] ji! How is everything going?

We spoke about your career last time, any updates on the job front?

Good opportunities might come in the next 2 months.
```

### Template 3: Health Query
**Use when:** User asked about health, illness

**HINGLISH MODE:**
```
[Name] ji! Kaise ho aap?

Health ki baat hui thi, ab kaisa feel ho raha hai?

Upay follow kar rahe ho na?
```

**ENGLISH MODE:**
```
[Name] ji! How are you doing?

We discussed your health last time, how are you feeling now?

Are you following the remedies?
```

### Template 4: General Check-in (No specific topic)
**Use when:** No clear topic from memories

**HINGLISH MODE:**
```
Arre [Name] ji! Kya ho gaya?

Kafi din ho gaye, kaise ho aaj?

Koi sawaal ho toh zaroor batana.
```

**ENGLISH MODE:**
```
Oh wow [Name] ji! Long time no see.

How have you been?

If you have any questions, feel free to ask.
```

---

## Step 4: Send Nudges & Update State

**For EACH user you want to nudge:**
1. Generate personalized message using templates above
2. Send the message (system will deliver via WhatsApp)
3. Track timestamp in heartbeat-state.json

**⚠️ AFTER processing all users, update heartbeat-state.json:**
```json
{
    "users": {
        "+919876543210": "2026-03-25T14:30:00.000Z"
    },
    "lastHeartbeat": "2026-03-25T14:30:00.000Z"
}
```

**Rules:**
- Add/Update `lastNudge` timestamp for each user you nudged
- ALWAYS update `lastHeartbeat` to current time (even if no nudges sent)
- Use `write` tool to save: `~/.openclaw/agents/astrologer/heartbeat-state.json`

---

## Step 5: Reply with Heartbeat Status

**After completing ALL steps, reply with:**
- `HEARTBEAT_OK` if heartbeat completed successfully (even if no nudges sent)
- DO NOT include any other text or explanation
- DO NOT send nudges as your reply (they should already be sent via system)

---

## Quick Reference Summary

**WHEN to nudge:**
- ✅ User inactive for **5+ minutes**
- ✅ Within 24 hours of their last message
- ✅ Current time 9 AM - 9 PM IST
- ✅ Not nudged in last **10 minutes**

**WHEN to skip (reply HEARTBEAT_OK):**
- ❌ Before 9 AM or after 9 PM IST
- ❌ No eligible users found
- ❌ All users recently nudged
- ❌ Users outside 24-hour window

**🔧 TESTING MODE:**
- Inactivity threshold: **5 minutes** (for quick testing)
- Nudge cooldown: **10 minutes** (to avoid spam during testing)
- Heartbeat frequency: **Every 5 minutes** (check often for testing)

**MESSAGE FORMAT:**
- 3 lines maximum
- Use "[Name] ji" (NOT "beta")
- Reference last topic naturally
- Match language (English/Hinglish)
- End with a question

---

## Examples

### Example 1: Marriage Query (Hinglish)
**Memories:** Name=Rahul, Last topic=Marriage timing, Prediction=April 2026
```
Arre Rahul ji! Kya ho gaya?

Pichli baar shaadi ki baat hui thi, koi update hai?

April ke baad time accha hai, bata na kaisa chal raha hai.
```

### Example 2: Career Query (English)
**Memories:** Name=Priya, Last topic=Job change, Language=English
```
Oh wow Priya ji! How have you been?

We spoke about your career last time, any updates on the job front?

Good opportunities might come in the next 2 months.
```

### Example 3: General Check-in (No Topic)
**Memories:** Name=Amit, No specific topic, Language=Hinglish
```
Arre Amit ji! Kya ho gaya?

Kafi din ho gaye, kaise ho aaj?

Koi sawaal ho toh zaroor batana.
```

---

**Remember:** The goal is to show users you remember them and care about their journey, while respecting WhatsApp's 24-hour messaging window.
