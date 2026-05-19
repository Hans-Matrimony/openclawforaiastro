---
name: router
description: Phone number based routing to Vedic or Western Astrologer
metadata:
  {
    "openclaw": { "emoji": "🔀", "requires": { "bins": ["python3"] } },
  }
---

# 🔀 Astrology Router

Routes users to **Vedic Astrologer** or **Western Astrologer** based on phone number prefix/country code.

## Routing Logic

### Vedic Astrologer (South Asia)
Users with phone numbers from South Asian countries route to **Vedic Astrologer**:

| Prefix | Country |
|--------|---------|
| +91    | India |
| +92    | Pakistan |
| +93    | Afghanistan |
| +880   | Bangladesh |
| +94    | Sri Lanka |
| +977   | Nepal |
| +960   | Maldives |

### Western Astrologer (International)
All other phone numbers route to **Western Astrologer**:
- USA (+1), UK (+44), UAE (+971), Australia (+61), Europe, etc.

## Commands

### Check Routing for a Phone Number
```bash
python3 ~/.openclaw/skills/router/astrology_router.py route "+919876543210"
```

### Get Full Agent Configuration
```bash
python3 ~/.openclaw/skills/router/astrology_router.py config "+12025551234"
```

### Print Routing Reference Table
```bash
python3 ~/.openclaw/skills/router/astrology_router.py table
```

## Usage in Workflow

**Step 1: Extract phone number from message envelope**
```
[From: User Name (+919876543210) at Timestamp]
```

**Step 2: Route to appropriate system**
```bash
python3 ~/.openclaw/skills/router/astrology_router.py route "+919876543210"
```

**Step 3: Use returned configuration**
- Vedic → Use `workspace-astrologer`, `astrology_knowledge` collection
- Western → Use `workspace-western-astrologer`, `western_astrology` collection

## Output Format

```json
{
  "type": "vedic",
  "system": "vedic_astrology",
  "agent": "Meera/Aarav",
  "collection": "astrology_knowledge",
  "workspace": "workspace-astrologer",
  "prompt": "astrologer.md",
  "country": "India",
  "reason": "Phone number starts with +91 (South Asian region)",
  "features": ["Kundli", "Nakshatras", "Dasha", "Vedic remedies", "Mantras"]
}
```

## Key Differences

| Aspect | Vedic | Western |
|--------|-------|---------|
| **Zodiac** | Sidereal (27 Nakshatras) | Tropical (12 Signs) |
| **Focus** | Moon sign | Sun sign |
| **Houses** | Whole sign | Placidus/Whole sign |
| **Timing** | Dasha system | Transits/Progressions |
| **Remedies** | Mantras, Gemstones | Crystals, Affirmations |
| **Knowledge Base** | `astrology_knowledge` | `western_astrology` |
| **Chart Tool** | `calculate.py` | `natal_chart.py` |
