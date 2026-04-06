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

### Step 3: Generate PDF (using local script)

**IMPORTANT:** Run the PDF generation script from the kundli_pdf skill directory:

```bash
cd ~/.openclaw/skills/kundli_pdf && python3 generate_pdf.py --dob "YYYY-MM-DD" --tob "HH:MM" --place "City Name" --name "User Name"
```

**Parameters:**
- `--dob`: Date of birth in YYYY-MM-DD format (e.g., 2002-02-16)
- `--tob`: Time of birth in HH:MM format (e.g., 00:00)
- `--place`: Place of birth (e.g., Meerut)
- `--name`: User's name (optional, defaults to "User")

**Example:**
```bash
cd ~/.openclaw/skills/kundli_pdf && python3 generate_pdf.py --dob "2002-02-16" --tob "00:00" --place "Meerut" --name "Vardhan"
```

**Output:** The script will print the PDF file path which will be automatically sent to the user.

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

Please wait 10-15 seconds... I'll send it to your WhatsApp now! 📄"

## Notes

- The PDF is generated locally using ReportLab
- The PDF file path is printed and automatically sent to the user
- Generation takes 5-10 seconds
- PDF includes 5 pages: Title, Planetary Positions, Life Predictions (2 pages), Remedies

## Troubleshooting

If PDF generation fails:
1. Check if reportlab is installed: `pip list | grep reportlab`
2. Verify birth details are in correct format
3. Check if the kundli calculation is working

If the user doesn't receive the PDF:
1. Check if the PDF file was created successfully
2. Verify the file path was printed correctly
3. Offer to regenerate the PDF
