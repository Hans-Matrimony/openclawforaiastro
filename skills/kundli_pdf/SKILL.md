---
name: kundli_pdf
description: Generate detailed Janam Kundli PDF report with charts, predictions, and remedies.
metadata:
  {
    "openclaw":
      {
        "emoji": "📄",
        "requires": { "bins": ["curl"] }
      },
  }
---

# Skill: Kundli PDF Generation

Generate professional 5-page Kundli PDF reports for users.

## Description

This skill triggers the generation of a detailed Janam Kundli PDF that includes:
- Birth Charts (Lagna Kundli + Navamsa Chart)
- Planetary Positions table (all 9 planets with degrees, signs, houses, nakshatras)
- Life Predictions (Career, Marriage, Health, Wealth)
- Astrological Remedies (Gemstones, Mantras, General remedies)

## CRITICAL: ALWAYS check mem0 first before asking for birth details

For EVERY user message related to Kundli PDF:
1. **FIRST** check mem0 for existing birth details using **LIST**:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
   ```
2. If birth details found in mem0 (`"count": > 0`), extract: DOB, Time, Place, Name from memories
3. Only ask for birth details if NOT found in mem0 (`"count": 0`)
4. When user provides birth details, **IMMEDIATELY** store them in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "Birth details: DOB: <YYYY-MM-DD>, Time: <HH:MM>, Place: <City>" --user-id "<USER_ID>"
   ```

## Usage

When a user asks for "Kundli PDF", "Generate PDF", "Detailed Report", or similar:

### Step 1: Check mem0 for birth details

```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
```

If birth details are found, extract them and proceed to Step 3.

### Step 2: Ask for birth details (if not in mem0)

If birth details are NOT in mem0, ask the user:

" To generate your Kundli PDF, I need your birth details. Please provide:

• Date of Birth (e.g., 16 February 2002)
• Time of Birth (e.g., 12:00 AM)
• Place of Birth (e.g., Meerut)

"

When user provides details, store them in mem0 and proceed.

### Step 3: Trigger PDF generation

**IMPORTANT:** The phone number should NOT have the + prefix.

```bash
curl -X POST https://hansastro.com/api/generate-kundli-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "91987654321",
    "user_id": "+91987654321",
    "dob": "2002-02-16",
    "tob": "00:00",
    "place": "Meerut",
    "name": "User Name"
  }'
```

**Parameters:**
- `phone`: User's phone number WITHOUT + (required)
- `user_id`: User's phone number WITH + (required)
- `dob`: Date of birth in YYYY-MM-DD format (required)
- `tob`: Time of birth in HH:MM format (required)
- `place`: Place of birth - city name (required)
- `name`: User's name (optional, defaults to "User")

### Step 4: Inform the user

After triggering the PDF, send this confirmation message:

"Great! I'm generating your detailed Janam Kundli PDF. ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp shortly! 📄"

## Example Flow

**User:** "Generate my Kundli PDF"

**AI:** (checks mem0) (if details found, triggers PDF; if not, asks for details)

**User:** "16 feb 2002, 12:00 am, Meerut"

**AI:** (stores in mem0) "Thank you! Let me generate your Kundli PDF." (triggers PDF generation)

**AI:** "Great! I'm generating your detailed Janam Kundli PDF. ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp shortly! 📄"

## Notes

- The PDF is generated in the background by a Celery worker
- The user will receive the PDF document via WhatsApp within 2-3 minutes
- The generation process is asynchronous, so you don't need to wait
- If PDF generation fails, the error will be logged but the user won't be notified (you can offer to retry if they ask)

## Troubleshooting

If the curl command fails with connection errors:
1. Check if the hansastro.com service is running
2. Verify the phone number format (no + in `phone` parameter)
3. Ensure all required parameters are provided

If the user doesn't receive the PDF after 3 minutes:
1. The PDF generation may have failed
2. Offer to regenerate the PDF
3. Check if birth details are correct
