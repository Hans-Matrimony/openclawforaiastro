---
name: kundli
description: Calculate Vedic Astrology birth charts (Kundli) with optional image generation.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔮",
        "requires": { "bins": ["python3", "uv"] },
        "env": ["GEMINI_API_KEY"],
        "envNote": "GEMINI_API_KEY is only required for chart image generation"
      },
  }
---

# Skill: Kundli Calculation

This skill allows you to calculate a Vedic Astrology birth chart (Kundli) for a user based on their birth details.

## Description
Uses a local high-precision Vedic astrology engine to compute Lagna, Moon Sign, Nakshatra, Planetary positions across zodiac signs and houses, and Vimshottari Dashas.

## Usage

**CRITICAL: ALWAYS check mem0 first before asking for birth details**

For EVERY user message related to Kundli:
1. **FIRST** search mem0 for existing birth details:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "birth details date of birth time place" --user-id "<USER_ID>"
   ```
2. If birth details found in mem0, use them directly
3. Only ask for birth details if NOT found in mem0
4. When user provides birth details, **IMMEDIATELY** store them in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "Birth details: DOB: <YYYY-MM-DD>, Time: <HH:MM>, Place: <City>" --user-id "<USER_ID>"
   ```

Call this skill whenever a user provides their birth details (Date, Time, and Place of birth).

### Calculate Kundli (Text Output)
```bash
python3 ~/.openclaw/skills/kundli/calculate.py --dob "YYYY-MM-DD" --tob "HH:MM" --place "City Name"
```

### Generate Kundli Chart Image
When a user asks to **"make kundali chart"**, **"generate chart image"**, or **"show my chart"**, first calculate their kundli to get the details, then generate a visual chart:

```bash
python3 ~/.openclaw/skills/kundli/generate_chart_image.py --lagna "Leo" --moon-sign "Scorpio" --nakshatra "Anuradha" --filename "kundli_chart.png"
```

**IMPORTANT**: This script ONLY generates astrology-related images (Kundli charts). Do NOT use it for any other image generation purposes. For general images, use the dedicated image generation skills.

### Parameters (calculate.py)
- `--dob`: Date of Birth in YYYY-MM-DD format (e.g., 1990-10-15)
- `--tob`: Time of Birth in HH:MM (24-hour format, e.g., 14:30)
- `--place`: Place of Birth (e.g., "Delhi", "Mumbai", "London")

### Parameters (generate_chart_image.py)
- `--lagna`: Ascendant sign (e.g., Leo, Scorpio, Aries) - **required**
- `--moon-sign`: Moon sign/Rashi (e.g., Scorpio, Pisces, Cancer) - **required**
- `--nakshatra`: Birth star/Nakshatra (e.g., Anuradha, Rohini, Ashwini) - **required**
- `--filename`: Output filename (default: kundli-chart-YYYY-MM-DD-HHMMSS.png)
- `--resolution`: Image resolution - 1K, 2K (default), or 4K

## Output
The calculate.py tool returns a detailed JSON object containing:
- **metadata**: Echoes input and provides GPS coordinates.
- **lagna**: The Ascendant sign.
- **moon_sign**: The Rashi sign.
- **nakshatra**: The Moon's birth star (Janma Nakshatra). This is ALWAYS the Moon's Nakshatra. Do NOT use the nakshatra of any other planet (e.g. Saturn in House 1) as the birth Nakshatra.
- **panchang**: Tithi, Yoga, Karana, Weekday.
- **planets**: A list of all planets and their positions.
- **dashas**: Current Vimshottari Mahadasha and Antardasha.

The generate_chart_image.py tool creates and returns a visual Kundli chart image file.

## Guidelines for Interpretation
1. **Lagna**: This is the most important part of the self. Interpret the 1st house based on this.
2. **Moon Sign (Rashi)**: Represents the mind and emotions.
3. **Dashas**: These determine "when" things happen. Always check the current Mahadasha before giving predictions.
4. **Remedies**: Use the Qdrant knowledge base to suggest remedies based on the planetary placements you find in the calculation.

## Image Generation Policy
- This skill generates **ONLY astrology-related images** (Kundli charts, birth charts, horoscope diagrams)
- It will NOT generate any other types of images
- All chart images are generated using Gemini 3 Pro Image (Nano Banana Pro) via GEMINI_API_KEY
