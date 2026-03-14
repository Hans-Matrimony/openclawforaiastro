---
name: vastu
description: Vastu Shastra analysis skill for property consultation.
metadata:
  {
    "openclaw": { "emoji": "🏠", "requires": { "bins": ["python3"] } },
  }
---

# Vastu Shastra Analysis

Use this skill to analyze properties according to Vastu Shastra principles - the ancient Indian science of architecture.

## CRITICAL: ALWAYS Check Mem0 First

For EVERY user message related to Vastu:
1. **FIRST** search mem0 for existing property details and preferences:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "vastu property details entrance rooms" --user-id "<USER_ID>"
   ```
2. If property details found in mem0, use them directly
3. Only ask for property details if NOT found in mem0
4. When user provides property details, **IMMEDIATELY** store them in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "Vastu property: <TYPE>, entrance: <DIRECTION>, rooms: <ROOMS>" --user-id "<USER_ID>"
   ```

## Commands

### Analyze Property Vastu
Analyze a property's Vastu compliance based on entrance direction and room placements.

```bash
# Basic analysis (entrance only)
python3 ~/.openclaw/skills/vastu/calculate.py --type "house" --entrance "north"

# Full analysis with rooms
python3 ~/.openclaw/skills/vastu/calculate.py --type "flat" --entrance "east" --rooms '{"kitchen": "southeast", "bedroom": "southwest", "puja": "northeast"}'

# With specific concerns
python3 ~/.openclaw/skills/vastu/calculate.py --type "flat" --entrance "north" --rooms '{"kitchen": "southeast"}' --concerns "money,health"

# Office analysis
python3 ~/.openclaw/skills/vastu/calculate.py --type "office" --entrance "northeast" --rooms '{"reception": "northeast", "cabins": "southwest"}'
```

## Parameters

| Parameter | Required | Values | Description |
|-----------|----------|--------|-------------|
| `--type` | Yes | flat, house, office, shop | Type of property |
| `--entrance` | Yes | north, south, east, west, northeast, northwest, southeast, southwest | Main entrance direction |
| `--rooms` | No | JSON string | Room locations in format `{"room": "direction"}` |
| `--concerns` | No | Comma-separated | User concerns: money, health, relationship, career, children, conflicts |

## Room Types Supported

kitchen, master_bedroom, puja_room, living_room, bathroom, study_room, guest_room, children_bedroom, dining_room, stairs, overhead_tank, underground_tank, septic_tank

## Output Format

```json
{
  "overall_score": 85,
  "summary": "Overall: EXCELLENT (85/100)...",
  "entrance": {
    "direction": "north",
    "verdict": "excellent",
    "benefits": ["wealth", "prosperity"]
  },
  "rooms": [...],
  "doshas": [],
  "element_balance": {...},
  "general_remedies": [...]
}
```
