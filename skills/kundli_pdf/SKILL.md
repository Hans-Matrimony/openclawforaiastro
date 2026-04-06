---
name: kundli_pdf
description: PDF generation skill for Janam Kundli. Use when user asks for "kundli pdf", "detailed pdf report", "generate pdf", or "send pdf". This generates a 5-page PDF document with charts, predictions, and remedies.
metadata:
  {
    "openclaw":
      {
        "emoji": "📄"
      },
  }
---

# Skill: Kundli PDF Generation

Generate professional 5-page Kundli PDF reports for users.

## ⚠️ IMPORTANT: How This Skill Works

This is a **message-based skill** - you do NOT need to execute any scripts or files.

**When to use this skill:**
- User asks for "kundli pdf" or "generate pdf"
- User asks for "detailed pdf report" or "send pdf"
- User asks for "my kundli in pdf format"

**What you need to do:**
1. Check mem0 for user's birth details (DOB, time, place)
2. In your response, include this line: `PDF_REQUEST: dob=YYYY-MM-DD, tob=HH:MM, place=CITY, name=NAME`
3. Tell the user their PDF is being generated

**That's it!** The backend will detect your `PDF_REQUEST:` message and handle everything else.

## What the PDF Contains

The generated PDF includes:
- Birth Charts (Lagna Kundli + Navamsa Chart)
- Planetary Positions table (all 9 planets with degrees, signs, houses, nakshatras)
- Life Predictions (Career, Marriage, Health, Wealth)
- Astrological Remedies (Gemstones, Mantras, General remedies)

## Step-by-Step Instructions

### Step 1: Check mem0 for birth details

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
```

If birth details are found in mem0, extract them and proceed to Step 2.

### Step 2: Output the PDF_REQUEST message

Include this line in your response:

```
PDF_REQUEST: dob=<DOB>, tob=<TOB>, place=<PLACE>, name=<NAME>
```

**Parameters:**
- `DOB`: Date of birth in YYYY-MM-DD format (e.g., 2002-02-16)
- `TOB`: Time of birth in HH:MM format (e.g., 00:00)
- `PLACE`: Place of birth (e.g., Meerut)
- `NAME`: User's name (optional, defaults to "User")

**Example:**
```
PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan
```

### Step 3: Confirm with the user

After the PDF_REQUEST line, tell the user:

"Generating your detailed Janam Kundli PDF now! ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp! 📄"

## Example Flow

**User:** "Generate my kundli pdf"

**AI:** (checks mem0, finds birth details)

**AI responds:**
```
PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan

Generating your detailed Janam Kundli PDF now! ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp! 📄
```

**What happens:**
- Backend detects `PDF_REQUEST:` in the AI's response
- Backend generates the PDF with all details
- Backend sends PDF to user's WhatsApp

That's it! No scripts, no files to execute - just output the message.

## Notes

- **No scripts needed** - Just output the PDF_REQUEST message
- The PDF is generated in the backend by hans-ai-whatsapp service
- Uses ReportLab for professional 5-page PDF generation
- Includes charts, predictions, and remedies
- Sent directly to user's WhatsApp as a document
- Generation takes 2-3 minutes

## Troubleshooting

If PDF generation fails:
1. Verify the PDF_REQUEST format is correct: `PDF_REQUEST: dob=..., tob=..., place=..., name=...`
2. Check that birth details are correct
3. Check backend logs for errors
