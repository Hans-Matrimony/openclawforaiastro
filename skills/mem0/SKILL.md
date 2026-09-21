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

**Priority memory skill. The astrologer-specific workflow below takes precedence for that agent.**

Use this skill to store and retrieve memories for users. This is critical for maintaining context across sessions and understanding user preferences/history.

## Astrologer workflow

For the `astrologer` agent only, follow the current workspace's conditional memory rules instead of the default lookup workflow below:

- Reuse explicit current-user context when it already answers the question. Skip redundant retrieval for a self-contained greeting or thanks.
- If identity, birth details, a prior prediction, or other needed context is missing or conflicting, use `list --user-id "<USER_ID>"`, not `search`. Never infer a birth profile from a nonzero memory count.
- Save newly shared facts and corrections even when no retrieval is needed. Keep partner/family details attributed to that person under the current user's ID, never as the user's own profile.
- Use the existing add/update workflow. Verify a write succeeded before claiming it was saved; memory failures must not prevent a helpful response.
- Other agents retain the default workflow below. Command documentation is a reference, not a requirement to call every command.

## Default lookup workflow for other agents

For EVERY incoming user message, you MUST:

1. **ALWAYS search mem0 FIRST** before asking any questions or taking any action:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "<relevant_query>" --user-id "<USER_ID>"
   ```

2. Use the results to personalize your response

3. If user provides NEW information, **IMMEDIATELY** store it in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "<information_to_store>" --user-id "<USER_ID>"
   ```

4. If existing information needs updating, use upsert:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "<search_key>" --content "<new_content>" --user-id "<USER_ID>"
   ```

**Common Information to Store in Mem0:**
- Birth details (DOB, time, place)
- Property details for Vastu
- User preferences (chart style, language, etc.)
- Previous queries and their results
- Important life events
- Remedies suggested previously

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
- **Recall before asking again:** For the astrologer, use current context or the conditional `list` workflow above. Other agents retain the default search workflow.
- **Store key facts:** If the user provides birth details, preferences, or important life events, store them immediately.
