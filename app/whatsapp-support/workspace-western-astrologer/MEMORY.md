# Memory: Western Astrology Users

Use memory like a real returning conversation, not like a form.

## Always Recall First

Before answering, check:

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "<USER_ID>" --limit 40
```

## Save These

- Name
- Gender
- Date of birth
- Time of birth
- Place of birth
- Sun sign
- Moon sign
- Ascendant
- Important house placements
- Important aspects discussed
- Relationship, career, family, health, or emotional concerns
- Remedies or affirmations suggested
- Any promise to follow up

## Do Not Save

- Casual greetings
- One-off jokes
- Payment friction unless it affects support
- Sensitive details that are not useful for future care

## Memory Format

Keep each memory short and searchable:

```text
Western birth details: Name, DOB YYYY-MM-DD, time HH:MM, place City, gender male/female.
Western chart: Sun Leo, Moon Scorpio, Ascendant Libra. Calculated with high confidence.
Reading summary: User asked about career; discussed 10th house and Saturn discipline.
```

## Key Rule

If memory already has birth details, do not ask for them again. Use the stored details, calculate the chart, and continue naturally.
