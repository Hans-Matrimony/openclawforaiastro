---
name: mongo_logger
description: Skill for logging AND fetching chat transcripts from MongoDB. Provides conversation context for personalized responses.
homepage: https://github.com/Hans-Matrimony/openclaw_mongo_logger
metadata:
  {
    "openclaw": { "emoji": "📝", "requires": { "bins": ["python3"] } },
  }
---

# Mongo Logger - Chat Transcript Storage & Context

**🚨 PRIORITY SKILL: MUST be checked FIRST for EVERY user message**

Use this skill to:
1. **Fetch conversation history** for personalized context
2. **Store messages** to MongoDB for future reference

It talks to the `openclaw_mongo_logger` service via its API.

## 🚨 MANDATORY WORKFLOW FOR ALL USER MESSAGES

For EVERY incoming user message, you MUST:

1. **ALWAYS fetch conversation history FIRST** before responding:
   ```bash
   python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "<USER_ID>" --limit 30 --format summary
   ```

2. **Use the context to personalize your response:**
   - Reference past conversations naturally: "Pichli baar tumne..."
   - Follow up on previous problems: "Wo issue kaisa hai?"
   - Show you care: "Kaise ho yaar?"
   - Be emotionally connected

3. **After responding, log your message** for future context:
   ```bash
   python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
     --session-id "<session_id>" \
     --user-id "<user_id>" \
     --role "assistant" \
     --text "<your_response>" \
     --channel "whatsapp"
   ```

## Commands

### Fetch Conversation History (DO THIS FIRST!)

```bash
# Fetch recent messages for context
python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "+919876543210" --limit 30 --format summary

# Fetch with custom limit
python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "+919876543210" --limit 50 --format summary

# Get raw JSON data
python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "+919876543210" --format json
```

**Parameters:**
- **user-id**: User's phone number (with + prefix)
- **limit**: Number of recent messages (default: 30, recommended: 20-50)
- **format**: `summary` (for AI reading) or `json` (for data processing)

**Output includes:**
- Recent conversation topics
- Problems discussed
- Things to follow up on

### Log a Message

```bash
python3 ~/.openclaw/skills/mongo_logger/logger_client.py log \
  --session-id "<session_id>" \
  --user-id "<user_id>" \
  --role "user" \
  --text "message text" \
  --channel "whatsapp"
```

- **session-id**: Stable id for this conversation (WhatsApp message thread id, Telegram chat id, etc.)
- **user-id**: Real user id (WhatsApp phone, Telegram user id, or internal id)
- **role**: `"user"` or `"assistant"`
- **text**: Message body
- **channel**: `"whatsapp"`, `"telegram"`, `"web"`, etc.

## Usage Guidelines

### For Personalized Responses:

1. **ALWAYS check conversation history first** - This makes you feel like a caring friend who remembers!
2. **Reference past topics naturally**: "Pichli baar jo problem bola tha..."
3. **Follow up on concerns**: "Wo stress issue kaisa hai ab?"
4. **Be emotionally aware**: If they shared problems before, ask how they're doing

### For Logging:

- Always use the real `user_id` (phone, Telegram id) from the message envelope. Never use `"user123"` or fake IDs.
- Use the same `session-id` for all messages in a single conversation so transcripts can be grouped.
- For each interaction:
  1. Log the user message with `role="user"`.
  2. After generating the reply, log the assistant message with `role="assistant"`.
