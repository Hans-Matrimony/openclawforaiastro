---
name: mem0
description: Long-term memory skill for storing and retrieving user-specific context.
homepage: https://github.com/mem0ai/mem0
metadata:
  {
    "openclaw": { "emoji": "🧠", "requires": { "bins": ["python3"] } },
  }
---

# Mem0 - Long-Term Memory

Use this skill to store and retrieve memories for users. This is critical for maintaining context across sessions and understanding user preferences/history.

## Commands

### Search Memory
Search for relevant memories based on a query and user ID.

```bash
# Python client wrapper
python skills/mem0/mem0_client.py search "query string" --user-id "user123"
```

### Add Memory
Store a new memory for a user.

```bash
python skills/mem0/mem0_client.py add "User prefers North Indian charts" --user-id "user123"
```

### List Memories
Get all memories for a user.

```bash
python skills/mem0/mem0_client.py list --user-id "user123" --limit 20
```

## Usage Guidelines

- **Always include `user_id`:** Multi-tenancy depends on accurate user IDs (e.g., phone number).
- **Search before answering:** Check if the user has shared relevant details previously.
- **Store key facts:** If the user provides birth details, preferences, or important life events, store them immediately.
