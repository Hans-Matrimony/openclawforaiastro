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
python3 ~/.openclaw/skills/mem0/mem0_client.py search "query string" --user-id "user123"
```

### Add Memory
Store a new memory for a user.

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "User prefers North Indian charts" --user-id "user123"
```

### List Memories
Get all memories for a user.

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "user123" --limit 20
```

### Update Memory
Update an existing memory by its ID. You can update the content, metadata, or both.

```bash
# Update content only
python3 ~/.openclaw/skills/mem0/mem0_client.py update --memory-id "abc123" --content "Updated memory content"

# Update metadata only
python3 ~/.openclaw/skills/mem0/mem0_client.py update --memory-id "abc123" --metadata '{"category": "preference", "verified": true}'

# Update both
python3 ~/.openclaw/skills/mem0/mem0_client.py update --memory-id "abc123" --content "New content" --metadata '{"source": "user"}'
```

### Delete Memory
Delete a specific memory by its ID.

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py delete --memory-id "abc123"
```

### Upsert Memory
Add a new memory or update an existing one automatically. Searches for existing memories first, then updates if found or adds if not found.

```bash
# Will update if DOB exists, otherwise create new
python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "date of birth birth details" \
  --content "DOB: 1990-02-20, Time: 14:30, Place: Delhi" \
  --user-id "+919876543210"

# With metadata
python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "user preferences" \
  --content "User prefers North Indian chart style" \
  --user-id "+919876543210" \
  --metadata '{"category": "preference", "verified": true}'
```

**Response includes:**
- `_upsert`: `"created"` or `"updated"` - indicates what action was taken
- `_memory_id`: the memory ID for reference

## Usage Guidelines

- **Always include `user_id`:** Multi-tenancy depends on accurate user IDs (e.g., phone number).
- **Search before answering:** Check if the user has shared relevant details previously.
- **Store key facts:** If the user provides birth details, preferences, or important life events, store them immediately.
