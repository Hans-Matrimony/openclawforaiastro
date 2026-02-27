---
name: mongo_logger
description: Skill for logging chat transcripts (user + assistant messages) into MongoDB via openclaw_mongo_logger.
homepage: https://github.com/Hans-Matrimony/openclaw_mongo_logger
metadata:
  {
    "openclaw": { "emoji": "📝", "requires": { "bins": ["python3"] } },
  }
---

# Mongo Logger - Chat Transcript Storage

Use this skill to store every message exchanged between the user and Acharya Sharma (or other agents) in MongoDB.

It talks to the `openclaw_mongo_logger` service via its `/webhook` endpoint.

## Commands

### Log a Message

```bash
python skills/mongo_logger/logger_client.py log \
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

- Always use the real `user_id` (phone, Telegram id) from the message envelope. Never use `"user123"` or fake IDs.
- Use the same `session-id` for all messages in a single conversation so transcripts can be grouped.
- For each interaction:
  1. Log the user message with `role="user"`.
  2. After generating the reply, log the assistant message with `role="assistant"`.
