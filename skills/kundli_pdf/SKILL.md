---
name: kundli_pdf
description: Generate detailed Janam Kundli PDF report with charts, predictions, and remedies.
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

## ⚠️ CRITICAL: READ THIS FIRST!

**DO NOT generate the PDF yourself!** 

This skill does NOT run generate_pdf.py directly. Instead, you send a `PDF_REQUEST:` message to the backend, which handles everything.

**Your job:**
1. Check mem0 for birth details
2. Send `PDF_REQUEST: dob=..., tob=..., place=..., name=...` message
3. Tell user "PDF is being generated, please wait 2-3 minutes"

**Backend handles:**
- PDF generation with ReportLab
- Calculating kundli  
- Uploading to WhatsApp Media API
- Sending to user

**If you try to generate the PDF yourself, it will NOT work!** The local file cannot be sent to WhatsApp.

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

### Step 3: Trigger PDF generation (via backend API)

**CRITICAL: DO NOT run generate_pdf.py yourself!**

Send this special message format to trigger PDF generation in the backend:

```
PDF_REQUEST: dob=YYYY-MM-DD, tob=HH:MM, place=City Name, name=User Name
```

**IMPORTANT RULES:**
- ✅ DO: Send "PDF_REQUEST: dob=..., tob=..., place=..." message
- ❌ DO NOT: Run cd ~/.openclaw/skills/kundli_pdf && python3 generate_pdf.py
- ❌ DO NOT: Try to generate the PDF yourself
- ❌ DO NOT: Use the generate_pdf.py script directly

**Why?** The backend has the full PDF generation system with WhatsApp upload capability. Your job is just to trigger it by sending PDF_REQUEST.

**Parameters:**
- `dob`: Date of birth in YYYY-MM-DD format (e.g., 2002-02-16)
- `tob`: Time of birth in HH:MM format (e.g., 00:00)  
- `place`: Place of birth (e.g., Meerut)
- `name`: User's name (optional, defaults to "User")

**Example:**
```
PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan
```

**What happens next:** The backend will generate the PDF and send it to the user's WhatsApp. You don't need to do anything else!

### Step 4: Inform the user

After triggering the PDF, send this confirmation message:

"Generating your detailed Janam Kundli PDF now! ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 10-15 seconds... Sending to your WhatsApp now! 📄"

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

Please wait 2-3 minutes... I'll send it to your WhatsApp! 📄"

(Behind the scenes: AI message contains "PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan" which triggers the backend)

## Notes

- The PDF is generated in the backend by hans-ai-whatsapp service
- Uses ReportLab for professional 5-page PDF generation
- Includes charts, predictions, and remedies
- Sent directly to user's WhatsApp as a document
- Generation takes 2-3 minutes

## Troubleshooting

If PDF generation fails:
1. Check if birth details are correct
2. Verify the PDF_REQUEST format is correct
3. Check backend logs for errors

If the user doesn't receive the PDF:
1. The PDF generation may have failed
2. Check if WhatsApp API is working
3. Offer to regenerate the PDF
