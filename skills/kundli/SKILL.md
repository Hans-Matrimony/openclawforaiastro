---
name: kundli
description: Calculate Vedic Astrology birth charts (Kundli) with optional image generation.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔮",
        "requires": { "bins": ["python3", "uv"] },
        "env": ["OPENAI_API_KEY"],
        "envNote": "OPENAI_API_KEY is only required for chart image generation"
      },
  }
---

# Skill: Kundli Calculation

This skill allows you to calculate a Vedic Astrology birth chart (Kundli) for a user based on their birth details.

## Description
Uses a local high-precision Vedic astrology engine to compute Lagna, Moon Sign, Nakshatra, Planetary positions across zodiac signs and houses, and Vimshottari Dashas.

## Usage

**CRITICAL - CHART IMAGE GENERATION RULES:**
When generating Kundli chart images, you MUST:
1. Run `calculate.py` to get the planet positions
2. Extract the `planet_positions` array from the output
3. Pass ALL 9 planet positions to `draw_kundli_traditional.py` using the `--planets` parameter
4. If you skip the `--planets` parameter, the chart will be WRONG and RANDOM
5. 🚨 **LAZINESS ALERT:** You MUST include ALL 9 planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu). DO NOT be lazy and only include 3-4 planets! The entire `planet_positions` array must be copied EXACTLY as-is from calculate.py output.

**CRITICAL - PRESERVE OUTPUT FORMAT:**
- When the `draw_kundli_traditional.py` script outputs `IMAGE_URL: <url>`, you MUST include this EXACTLY as-is in your response
- DO NOT convert it to Markdown link format like `[IMAGE_URL](url)`
- DO NOT modify, wrap, or reformat the `IMAGE_URL:` line in any way
- Simply include the full `IMAGE_URL: <url>` line verbatim in your response

**CRITICAL: ALWAYS check mem0 first before asking for birth details**

For EVERY user message related to Kundli:
1. **FIRST** check mem0 for existing birth details using **LIST**:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
   ```
   > **NOTE:** Use `list` to get all stored memories. Use `search` only when you need semantic matching for a specific topic.
2. If birth details found in mem0 (`"count": > 0`), extract: DOB, Time, Place from memories
3. Only ask for birth details if NOT found in mem0 (`"count": 0`)
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
When a user asks to **"make kundali chart"**, **"generate chart image"**, or **"show my chart"**, follow these EXACT steps:

**Step 1: Calculate Kundli**
```bash
python3 ~/.openclaw/skills/kundli/calculate.py --dob "YYYY-MM-DD" --tob "HH:MM" --place "City"
```

**Step 2: Extract planet positions from the output**
Look for `"planet_positions"` array in the JSON output. Copy EVERY entry from this array.

**Step 3: Generate the chart image with ALL planet positions**

**TEMPLATE - Copy this and fill in the values (CRITICAL: MUST BE ON A SINGLE LINE):**
```bash
cd ~/.openclaw/skills/kundli && python3 -u draw_kundli_traditional.py --lagna "<PASTE_LAGNA_HERE>" --moon-sign "<PASTE_MOON_SIGN_HERE>" --nakshatra "<PASTE_NAKSHATRA_HERE>" --planets '<PASTE_ENTIRE_PLANET_POSITIONS_ARRAY_HERE>' --user-id "<USER_ID>"
```

**CRITICAL CHECKLIST before running the command:**
- [ ] I ran `calculate.py` first and have the JSON output
- [ ] I extracted the `planet_positions` array (it starts with `[` and ends with `]`)
- [ ] I am passing the ENTIRE `planet_positions` array to `--planets` (every single entry!)
- [ ] The `--planets` value is wrapped in single quotes: `--planets '[...]'`
- [ ] The array inside is wrapped in double quotes: `["item1", "item2"]`

REAL EXAMPLE:
If `planet_positions` contains:
```
["Saturn is in House 1 (Taurus/Vrishabh)", "Jupiter is in House 2 (Gemini/Mithun)", "Rahu is in House 2 (Gemini/Mithun)", "Ketu is in House 8 (Sagittarius/Dhanu)", "Mercury is in House 9 (Capricorn/Makar)", "Sun is in House 10 (Aquarius/Kumbh)", "Venus is in House 10 (Aquarius/Kumbh)", "Moon is in House 11 (Pisces/Meen)", "Mars is in House 11 (Pisces/Meen)"]
```

Then you MUST run (ON ONE SINGLE LINE):
```bash
cd ~/.openclaw/skills/kundli && python3 -u draw_kundli_traditional.py --lagna "Taurus" --moon-sign "Pisces" --nakshatra "Uttara Bhadrapada" --planets '["Saturn is in House 1 (Taurus/Vrishabh)", "Jupiter is in House 2 (Gemini/Mithun)", "Rahu is in House 2 (Gemini/Mithun)", "Ketu is in House 8 (Sagittarius/Dhanu)", "Mercury is in House 9 (Capricorn/Makar)", "Sun is in House 10 (Aquarius/Kumbh)", "Venus is in House 10 (Aquarius/Kumbh)", "Moon is in House 11 (Pisces/Meen)", "Mars is in House 11 (Pisces/Meen)"]' --user-id "USER_PHONE_NUMBER"
```

**CRITICAL:** You MUST include the `--planets` parameter with ALL planet positions. If you skip this, the chart will be RANDOM and WRONG!

**IMPORTANT**: This script ONLY generates astrology-related images (Kundli charts). Do NOT use it for any other image generation purposes. For general images, use the dedicated image generation skills.

### Parameters (calculate.py)
- `--dob`: Date of Birth in YYYY-MM-DD format (e.g., 1990-10-15)
- `--tob`: Time of Birth - accepts multiple formats:
  - 24-hour: HH:MM (e.g., 14:30, 09:50)
  - 12-hour with AM/PM: HH:MM AM/PM (e.g., 2:30 PM, 09:50 AM)
- `--place`: Place of Birth (e.g., "Delhi", "Mumbai", "London")

### Parameters (draw_kundli_traditional.py)
- `--lagna`: Ascendant sign (e.g., Leo, Scorpio, Aries) - **required**
- `--moon-sign`: Moon sign/Rashi (e.g., Scorpio, Pisces, Cancer) - **required**
- `--nakshatra`: Birth star/Nakshatra (e.g., Anuradha, Rohini, Ashwini) - **required**
- `--planets`: JSON array of planet positions (e.g., '["Saturn is in House 1", "Moon is in House 11"]') - **CRITICAL for accurate charts**
- `--user-id`: User ID to store the generated chart against and return the correct webhook URL.

## Output
The calculate.py tool returns a detailed JSON object containing:
- **metadata**: Echoes input and provides GPS coordinates.
- **lagna**: The Ascendant sign.
- **moon_sign**: The Rashi sign.
- **nakshatra**: The Moon's birth star (Janma Nakshatra). This is ALWAYS the Moon's Nakshatra. Do NOT use the nakshatra of any other planet (e.g. Saturn in House 1) as the birth Nakshatra.
- **panchang**: Tithi, Yoga, Karana, Weekday.
- **planets**: A list of all planets and their positions.
- **dashas**: Current Vimshottari Mahadasha and Antardasha.

The draw_kundli_traditional.py tool creates and returns a visual Kundli chart image file.

## Guidelines for Interpretation
1. **Lagna**: This is the most important part of the self. Interpret the 1st house based on this.
2. **Moon Sign (Rashi)**: Represents the mind and emotions.
3. **Dashas**: These determine "when" things happen. Always check the current Mahadasha before giving predictions.
4. **Remedies**: Use the Qdrant knowledge base to suggest remedies based on the planetary placements you find in the calculation.

## Image Generation Policy
- This skill generates **ONLY astrology-related images** (Kundli charts, birth charts, horoscope diagrams)
- It will NOT generate any other types of images
- All chart images are generated using Gemini 3 Pro Image (Nano Banana Pro) via GEMINI_API_KEY