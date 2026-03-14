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

## CRITICAL: ALWAYS Check Mem0 First

For EVERY user message before web search:
1. **FIRST** search mem0 for existing information and user context:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "user queries astrology interests birth details" --user-id "<USER_ID>"
   ```
2. Check if the answer already exists in mem0 from previous searches
3. If found in mem0, use that instead of web search
4. After web search, **IMMEDIATELY** store useful findings in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "Web search result: <KEY_FINDING>" --user-id "<USER_ID>"
   ```

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
