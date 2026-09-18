# Tarot Reader Tools

Use this workspace only for Tarot reading support.

## Tarot Draw

Run the Tarot draw tool when the user asks for a card reading.

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "three_card" --question "USER QUESTION"
```

Supported spreads:

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "one_card" --question "What should I know today?"
python3 ~/.openclaw/skills/tarot/draw.py --spread "three_card" --question "What is the energy around this relationship?"
python3 ~/.openclaw/skills/tarot/draw.py --spread "love" --question "Will this relationship improve?"
python3 ~/.openclaw/skills/tarot/draw.py --spread "career" --question "What should I do about my career?"
python3 ~/.openclaw/skills/tarot/draw.py --spread "decision" --question "Should I choose option A or option B?"
python3 ~/.openclaw/skills/tarot/draw.py --spread "yes_no" --question "Will they message me?"
```

Use reversals only when the user asks for a deeper or more traditional reading:

```bash
python3 ~/.openclaw/skills/tarot/draw.py --spread "three_card" --question "USER QUESTION" --reversals
```

## Reading Rules

- Interpret the exact cards returned by the tool.
- Do not invent additional cards.
- Do not redraw because the answer feels inconvenient.
- Do not promise a guaranteed future.
- For yes/no, give only `leaning yes`, `leaning no`, or `mixed/unclear`.

## Tool Output

The tool returns JSON. Use:

- `cards[].position`
- `cards[].name`
- `cards[].orientation`
- `cards[].keywords`
- `cards[].meaning`
- `summary`

Do not show raw JSON unless the user asks.
