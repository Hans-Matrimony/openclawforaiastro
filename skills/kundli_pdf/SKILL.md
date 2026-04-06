---
name: kundli_pdf
description: Generate detailed Janam Kundli PDF report with charts, predictions, and remedies.
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

## ⚠️ CRITICAL: READ THIS FIRST!

**PDF generation happens in the backend!**

**Your job:**
1. Check mem0 for birth details
2. Execute `request_pdf.py` script with birth details
3. The script will output the PDF_REQUEST message that backend detects
4. Tell user "PDF is being generated, please wait 2-3 minutes"

**What happens:**
- Backend detects the `PDF_REQUEST:` message from the script output
- Backend generates the PDF with ReportLab
- Backend uploads to WhatsApp Media API
- Backend sends the PDF to the user
- User receives the actual PDF file on WhatsApp ✅

**DO NOT:**
- ❌ Try to find or use generate_pdf.py (it's disabled)
- ❌ Try to generate PDFs yourself
- ❌ Create local files or sandbox: paths
- ❌ Any other approach

**ONLY DO:**
- ✅ Execute `request_pdf.py` with birth details parameters

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

If birth details are found, extract them and proceed to Step 2.

### Step 2: Trigger PDF generation (execute request_pdf.py)

**Execute the request_pdf.py script with birth details:**

```bash
python3 ~/.openclaw/skills/kundli_pdf/request_pdf.py "<DOB>" "<TOB>" "<PLACE>" "<NAME>"
```

**Parameters:**
- `DOB`: Date of birth in YYYY-MM-DD format (e.g., 2002-02-16)
- `TOB`: Time of birth in HH:MM format (e.g., 00:00)
- `PLACE`: Place of birth (e.g., Meerut)
- `NAME`: User's name (optional, defaults to "User")

**Example:**
```bash
python3 ~/.openclaw/skills/kundli_pdf/request_pdf.py "2002-02-16" "00:00" "Meerut" "Vardhan"
```

**What happens next:**
- The script will output a `PDF_REQUEST:` message
- The backend will detect this message and generate the PDF
- The PDF will be sent to the user's WhatsApp in 2-3 minutes

### Step 3: Inform the user

After executing the script, send this confirmation message:

"Generating your detailed Janam Kundli PDF now! ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp! 📄"

## Example Flow

**User:** "Generate my Kundli PDF"

**AI:** (checks mem0) (if details found, proceeds; if not, asks for details)

**User:** "16 feb 2002, 12:00 am, Meerut"

**AI:** (stores in mem0) "Thank you! Let me generate your Kundli PDF."

**AI:** (executes request_pdf.py script)
```bash
python3 ~/.openclaw/skills/kundli_pdf/request_pdf.py "2002-02-16" "00:00" "Meerut" "Vardhan"
```

**AI:** "Great! I'm generating your detailed Janam Kundli PDF. ✨

This will include:
• Birth Charts (Lagna + Navamsa)
• Planetary Positions
• Life Predictions (Career, Marriage, Health, Wealth)
• Astrological Remedies

Please wait 2-3 minutes... I'll send it to your WhatsApp! 📄"

(Behind the scenes: Script outputs "PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan" which triggers the backend)

## Notes

- The PDF is generated in the backend by hans-ai-whatsapp service
- Uses ReportLab for professional 5-page PDF generation
- Includes charts, predictions, and remedies
- Sent directly to user's WhatsApp as a document
- Generation takes 2-3 minutes
- The request_pdf.py script simply outputs the PDF_REQUEST message that triggers backend processing

## Troubleshooting

If the script doesn't execute:
1. Verify the script path: `~/.openclaw/skills/kundli_pdf/request_pdf.py`
2. Check that all 3 required parameters are provided (dob, tob, place)
3. Name is optional - will default to "User" if not provided

If PDF generation fails:
1. Check if birth details are correct
2. Verify the script output contains "PDF_REQUEST:"
3. Check backend logs for errors

If the user doesn't receive the PDF:
1. The PDF generation may have failed
2. Check if WhatsApp API is working
3. Offer to regenerate the PDF
