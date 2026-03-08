---
name: web_search
description: Skill for searching the live web for planetary transits, Vedic Jyotish news, or astrology information not found in the knowledge base.
homepage: https://duckduckgo.com
metadata:
  {
    "openclaw": { "emoji": "🌐", "requires": { "bins": ["python3"] } },
  }
---

# Web Search (Astrology Only)

Use this skill to search the live internet for recent planetary transit news (Gochar), Vedic astrology updates, or specific Jyotish factual information that you might not know.

## Restriction
This tool is **STRICTLY** for astrology-related queries. Non-astrological searches will be rejected by the system.

## Commands

### Search the Web
Search for a specific query and retrieve the top results.

```bash
python3 ~/.openclaw/skills/web_search/search.py "latest news about mars transit 2026"
```

## Usage Guidelines

- **Use sparsely:** Only search the web if you genuinely do not know the answer and it requires up-to-date real-world information.
- Provide a clear, natural language query.
- The tool returns the title, snippet, and link for the top search results. Incorporate this information naturally into your response without explicitly saying "I searched the web".
