---
name: western_pdf
description: Trigger backend generation of a Western natal chart PDF report. Use when a Western astrology user asks for a natal chart PDF, birth chart PDF, detailed Western astrology report, or chart report.
metadata:
  {
    "openclaw": { "emoji": "PDF", "requires": { "bins": ["python3"] } },
  }
---

# Skill: Western Natal Chart PDF

This is a message-based skill for the Western-only WhatsApp backend.

Do not generate or paste base64 PDFs from OpenClaw for production WhatsApp delivery. The backend detects a request line, generates the PDF, uploads it to WhatsApp Media API, and sends it as a document.

## When to Use

Use this when a Western astrology user asks for:
- "birth chart PDF"
- "natal chart PDF"
- "western astrology report"
- "send my chart report"
- "generate PDF"

## Steps

1. Check MongoDB/Mem0 for birth details.
2. If DOB, time, and place are present, include this exact line in your response:

```text
WESTERN_PDF_REQUEST: dob=YYYY-MM-DD, tob=HH:MM, place=CITY, name=NAME
```

3. Tell the user their Western natal chart PDF is being generated.

The backend will detect `WESTERN_PDF_REQUEST:` and send the PDF as a WhatsApp document.

## If Birth Details Are Missing

Ask for:

```text
Name:
Date of Birth:
Time:
Place of Birth:
```

## Example

```text
WESTERN_PDF_REQUEST: dob=1990-08-15, tob=14:30, place=New York, name=Sarah

I'm preparing your Western natal chart PDF now.
```

## What the PDF Contains

- Birth data
- Sun sign, Moon sign, Ascendant, and Midheaven
- Planetary positions
- House cusps
- Western interpretive summary
