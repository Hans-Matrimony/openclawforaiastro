---
name: kundli_pdf
description: PDF generation skill for Janam Kundli. Use when user asks for "kundli pdf", "detailed pdf report", "generate pdf", or "send pdf". This generates a 5-page PDF document with charts, predictions, and remedies.
metadata:
  {
    "openclaw":
      {
        "emoji": "📄",
        "requires": { "bins": ["python3"] }
      },
  }
---

# Skill: Kundli PDF Generation

Generate professional 5-page Kundli PDF reports for users.

## ⚠️ IMPORTANT: How This Skill Works

This is a **message-based skill** - you do NOT need to execute any scripts.

**Note:** There is a `trigger_pdf.py` file in this skill directory, but it's just a placeholder for skill detection. You do NOT need to run it.

**When to use this skill:**
- User asks for "kundli pdf" or "generate pdf"
- User asks for "detailed pdf report" or "send pdf"
- User asks for "my kundli in pdf format"

**What you need to do:**
1. Check MongoDB API FIRST for user's birth details (FAST!), fallback to Mem0 if needed
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

### Step 1: Check for birth details (MongoDB FIRST, Mem0 fallback ALWAYS works)

```bash
# Try MongoDB FIRST (FAST - 5-20ms)
MONGO_DATA=$(curl -s --max-time 5 "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata/<USER_ID>")

# Extract birth data from MongoDB response
DOB=$(echo "$MONGO_DATA" | grep -o '"dateOfBirth":"[^"]*"' | cut -d'"' -f4)
TOB=$(echo "$MONGO_DATA" | grep -o '"timeOfBirth":"[^"]*"' | cut -d'"' -f4)
PLACE=$(echo "$MONGO_DATA" | grep -o '"birthPlace":"[^"]*"' | cut -d'"' -f4)
NAME=$(echo "$MONGO_DATA" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

# If MongoDB has complete birth data, use it
if [ -n "$DOB" ] && [ -n "$TOB" ] && [ -n "$PLACE" ]; then
    echo "Found birth data in MongoDB"
# FALLBACK: If MongoDB doesn't have data, check Mem0 (ALWAYS works!)
else
    echo "MongoDB unavailable or incomplete - checking Mem0..."
    python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
fi
```

If birth details are found (from MongoDB or Mem0), extract them and proceed to Step 2.

> **✅ SAFE:** If MongoDB is down, Mem0 fallback ALWAYS works! Existing functionality preserved.

**NOTE: If you ask user for birth details and they provide them, save to BOTH places:**
```bash
# Save to MongoDB user_metadata (for fast lookup next time)
curl -X POST "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<USER_ID>", "dateOfBirth": "<DOB>", "timeOfBirth": "<TOB>", "birthPlace": "<PLACE>"}'

# ALSO save to Mem0 (keeps existing Mem0 functionality working!)
python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "birth details" \
  --content "DOB: <DOB>, TOB: <TOB>, Place: <PLACE>" \
  --user-id "<USER_ID>" \
  --metadata '{"source":"kundli_pdf_skill"}'
```

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
