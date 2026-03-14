---
name: qdrant
description: Knowledge Base retrieval skill for astrology domain.
homepage: https://qdrant.tech
metadata:
  {
    "openclaw": { "emoji": "🔮", "requires": { "bins": ["python3"] } },
  }
---

# Qdrant - Astrology Knowledge Base

Use this skill to retrieve expert astrological knowledge, principles, and remedies from the vector database.

## CRITICAL: ALWAYS Check Mem0 First for User Context

For EVERY user message:
1. **FIRST** search mem0 for user's birth details, previous queries, and preferences:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "birth details astrology preferences" --user-id "<USER_ID>"
   ```
2. Use mem0 results to personalize the knowledge base retrieval
3. After providing Qdrant knowledge, store relevant findings in mem0 for future reference

## Commands

### Search Knowledge Base
Search for relevant astrology concepts, planetary combinations, or remedies based on a natural language query.

```bash
# Python client wrapper
python3 ~/.openclaw/skills/qdrant/qdrant_client.py search "effect of Saturn in 7th house" --limit 5

# Ingest Vastu knowledge into Qdrant
python3 ~/.openclaw/skills/qdrant/ingest_vastu.py ingest
```
