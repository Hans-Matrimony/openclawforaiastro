---
name: tarot
description: Draw and interpret Tarot cards for reflective, non-fatalistic guidance.
metadata:
  openclaw:
    emoji: ""
    requires:
      bins:
        - python3
---

# Tarot Skill

Use this skill when a user explicitly asks for Tarot cards, a card reading, a spread, love/career card guidance, or gentle yes/no direction through cards.

Tarot readings are symbolic reflection, not guaranteed prediction.

## Draw Cards

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "three_card" --question "USER QUESTION"
```

## Supported Spreads

- `one_card`: one-card guidance.
- `three_card`: default spread for most questions.
- `love`: relationship and reconciliation questions.
- `career`: job, study, business, or money-direction questions.
- `decision`: two-option choices.
- `yes_no`: direction only, never certainty.

## Optional Reversals

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "three_card" --question "USER QUESTION" --reversals
```

## Testing / Repeatable Draw

Use `--seed` only for testing or debugging:

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "love" --question "Will this improve?" --seed "test-user-1"
```

## Interpretation Rules

- Use only the cards returned by the tool.
- Include each card's position and name in the reply.
- Do not redraw unless the user explicitly asks for a fresh reading.
- Do not make fatalistic or guaranteed claims.
- For `yes_no`, answer as `leaning yes`, `leaning no`, or `mixed/unclear`.
- Keep guidance emotionally safe and practical.
