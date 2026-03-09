# Skill: Kundli Calculation

This skill allows you to calculate a Vedic Astrology birth chart (Kundli) for a user based on their birth details.

## Description
Uses a local high-precision Vedic astrology engine to compute Lagna, Moon Sign, Nakshatra, Planetary positions across zodiac signs and houses, and Vimshottari Dashas.

## Usage
Call this skill whenever a user provides their birth details (Date, Time, and Place of birth). You should also check if these details are already stored in the user's memory (Mem0) before asking for them again.

### Command
```bash
python3 ~/.openclaw/skills/kundli/calculate.py --dob "YYYY-MM-DD" --tob "HH:MM" --place "City Name"
```

### Parameters
- `--dob`: Date of Birth in YYYY-MM-DD format (e.g., 1990-10-15)
- `--tob`: Time of Birth in HH:MM (24-hour format, e.g., 14:30)
- `--place`: Place of Birth (e.g., "Delhi", "Mumbai", "London")

## Output
The tool returns a detailed JSON object containing:
- **metadata**: Echoes input and provides GPS coordinates.
- **lagna**: The Ascendant sign.
- **moon_sign**: The Rashi sign.
- **nakshatra**: The Moon's birth star (Janma Nakshatra). This is ALWAYS the Moon's Nakshatra. Do NOT use the nakshatra of any other planet (e.g. Saturn in House 1) as the birth Nakshatra.
- **panchang**: Tithi, Yoga, Karana, Weekday.
- **planets**: A list of all planets and their positions.
- **dashas**: Current Vimshottari Mahadasha and Antardasha.

## Guidelines for Interpretation
1. **Lagna**: This is the most important part of the self. Interpret the 1st house based on this.
2. **Moon Sign (Rashi)**: Represents the mind and emotions.
3. **Dashas**: These determine "when" things happen. Always check the current Mahadasha before giving predictions.
4. **Remedies**: Use the Qdrant knowledge base to suggest remedies based on the planetary placements you find in the calculation.
