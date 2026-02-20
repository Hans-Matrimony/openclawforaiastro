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

## Commands

### Search Knowledge Base
Search for relevant astrology concepts, planetary combinations, or remedies based on a natural language query.

```bash
# Python client wrapper
python skills/qdrant/qdrant_client.py search "effect of Saturn in 7th house" --limit 5
```
