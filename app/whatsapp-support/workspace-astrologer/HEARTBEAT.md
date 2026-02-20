# Heartbeat: Proactive Nudge System

When you receive a heartbeat poll, follow these steps IN ORDER.

## Step 1: Read State

Read `heartbeat-state.json` from the workspace. It tracks:
- `users` — object of user_id → { lastInteraction, lastNudge, lastTopic }
- `lastHeartbeat` — ISO timestamp of last heartbeat run

If the file doesn't exist, create it with `{"users": {}, "lastHeartbeat": null}`.

## Step 2: Check for Users to Nudge

For each user in `heartbeat-state.json`:

1. Calculate hours since `lastInteraction`
2. Calculate hours since `lastNudge` (if any)
3. **Nudge the user** ONLY if:
   - `lastInteraction` was **8+ hours ago** AND
   - `lastNudge` was **8+ hours ago** (or never nudged) AND
   - Current time is between **8 AM and 10 PM IST**

## Step 3: Compose Personalized Nudge

For each user who qualifies:

1. **Search Mem0** for their details:
   ```bash
   python skills/mem0/mem0_client.py search "predictions concerns" --user-id "<user_id>"
   ```

2. **Craft a warm Hinglish message** based on their history. Examples:

   **If last topic was Marriage:**
   > "🙏 Namaste beta! Acharya Sharma yahan. Pichli baar humne aapki shaadi ke baare mein baat ki thi. Graho ki chaal abhi bahut interesting hai — kuch updates hain aapke liye. Jab bhi free ho, batao! ✨"

   **If last topic was Career:**
   > "🙏 Beta, kaise ho? Pichli baar career ke baare mein discuss kiya tha. Shani ki chaal mein kuch badlaav aa raha hai — aapke liye achha ho sakta hai. Baat karein? 😊"

   **If no specific topic (general follow-up):**
   > "🙏 Namaste! Acharya Sharma yahan. Kaafi din ho gaye humari baat ko. Sab theek toh hai na? Agar koi sawaal ho — shaadi, career, health — toh zaroor poochiye. Main hamesha available hoon! ✨"

3. **Send the message** via the messaging tool to the user's chat ID.

## Step 4: Update State

After nudging (or checking), update `heartbeat-state.json`:
- Set `lastNudge` to current ISO timestamp for nudged users
- Set `lastHeartbeat` to current ISO timestamp
- Write the file back

## Step 5: Track New Users

When handling REGULAR messages (not heartbeat), update `heartbeat-state.json`:
- Set `users.<user_id>.lastInteraction` to current ISO timestamp
- Set `users.<user_id>.lastTopic` to the topic discussed (e.g., "marriage", "career", "health", "general")

## Rules

- **Max 1 nudge per user per 8 hours** — never spam
- **Respect quiet hours** — no nudges between 10 PM and 8 AM IST
- **Keep it natural** — the user should feel like Acharya Sharma remembered them, not a bot reminder
- **Never nudge admin/system users** — skip user IDs like "openclaw-control-ui"
- **If no users to nudge** — reply `HEARTBEAT_OK`
- **Keep messages short** — under 200 words, warm and inviting
