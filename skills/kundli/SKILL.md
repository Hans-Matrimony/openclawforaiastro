---
name: kundli
description: Calculate Vedic Astrology birth charts (Kundli) with optional image generation.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔮",
        "requires": { "bins": ["python3"] }
      },
  }
---

# Skill: Kundli Calculation

## Topic readings without extra retrieval

For a divorce or separation question after the user has confirmed marriage, use
`--reading-topic separation --render-reading` with the confirmed subject's birth
details. Add `--reading-intent timing` for a timing question. The separate result
checks selected separation and relationship-strain rules, including exceptions;
it does not treat generic marriage themes as separation evidence. Preserve the
fixed reviewed text rather than adding new interpretations. The assessment's
`not_established` status means the selected checks did not establish an indication,
not that divorce is impossible. Neither its dasha boundaries nor an unevaluated
condition can become a separation window or court date. A Saturn aspect alone
and a Venus-Mars conjunction outside the reviewed condition are not divorce rules.
Confirmed marital status comes from the user, not a guessed past event in a chart.

For a personal career, education or marriage reading, use the confirmed subject's
birth details and one compact call:

```bash
python3 ~/.openclaw/skills/kundli/calculate.py --dob "2002-02-16" --tob "08:19" --place "Delhi" --reading-topic career
```

Choose `career`, `education` or `marriage` from the actual question. These example
birth details are synthetic, never the current user's profile. Read the confirmed
backend/session profile first; fetch MongoDB/Mem0 only for missing or conflicting
fields. This lookup rule takes priority over the unconditional lookup examples below.
Save new and corrected details using the existing persistence workflow.

For a reviewed response without generative interpretation, add `--render-reading`
and `--reading-language english|hinglish` to the same topic command. For a marriage
date question, add `--reading-intent timing`: it states that the evaluated factors
do not establish an event window. The result contains `text`, its verified
`evidence`, language/intent and zero model-call/token counters. Hinglish uses fixed
reviewed wording, not a translation model. Other languages and friend conversation
handling retain their existing paths.

The packet contains `chart_facts`, `current_period`, `settings`, an input fingerprint,
and at most three `factors` with checked placements and reviewed traditional themes.
Explain the most relevant meaning and a practical example in the existing friend
voice and user language. Source IDs are internal traceability, not user-facing labels.
General house symbolism is explicitly separate from VedAstro classical entries.
Do not turn dasha boundaries into event forecasts or claim checked aspects, strength,
divisional charts, aptitude, spouse traits or guaranteed results. Interpretive themes
are not probabilities. Skip Qdrant when the packet covers the question; otherwise
use one targeted search with --limit 3. Do not retry identical failed tool calls.
For topic-reading-v1, only its factors supply personal interpretations. State
period dates as facts, without adding an unsupplied meaning for Ketu/Jupiter/etc.
Practical examples are hypothetical options, not claims about this user's habits,
preferences or abilities. Keep the source theme distinct from observed user facts.

Normal chart, all-position and image requests retain the existing default output,
all nine positions and IMAGE_URL contract. Do not combine --reading-topic with
--full or --legacy-full. Emotional-only and casual messages need no calculation.
The topic packet makes no network or LLM calls of its own. It requires the primary
Swiss Ephemeris chart; it refuses conflicting or incomplete positions. Dependencies
and timezone data must be installed at image build time; no runtime installation or
silent IST timezone fallback is used.
Normal calculations also stop on a missing/failed primary engine rather than
silently switching conventions. --legacy-full remains an explicit legacy operation;
KUNDLI_ALLOW_LEGACY_FALLBACK=1 is for deliberate legacy diagnostics, not production
topic readings. Reviewed topic readings reject that fallback even when enabled.
The existing lunar-node default remains true. --node-convention mean is an explicit
comparison option when the other provider uses mean Rahu/Ketu. The returned settings
and fingerprint include this choice. Never silently mix either convention into a
saved reading; a comparison also needs the same ayanamsa and house system.

For confirmed coordinates outside the local city catalogue, pass `--latitude`
and `--longitude` together. Global geocoding must resolve to one location; ask
for city, region and country if ambiguous. An explicitly confirmed birth UTC
offset can be passed with `--utc-offset` (hours, e.g. -5 or 5.5) to resolve a DST
overlap. Never infer an offset merely to silence a timezone error.

The image enables a bounded natal-only SQLite cache in the private state directory
with `KUNDLI_NATAL_CACHE_PATH`. It keys the UTC birth instant, coordinates, node,
engine, calculator revision and ephemeris files. It contains no user IDs or reply
text. Current dashas and reading timestamps are refreshed on every request; never
cache the complete topic packet as a timeless reading. Invalid/expired cache data
is recomputed; storage failure does not substitute a chart.

This skill allows you to calculate a Vedic Astrology birth chart (Kundli) for a user based on their birth details.

## Description
For English/Hinglish own-profile career, education, marriage, relationship and
finance requests, `--verified-topic <topic> --reading-language <language>` returns
`reviewed-topic-v1`. `--topic-intent` accepts overview, timing, detail, brief and
relationship-only contact. This checks current-user natal house meanings and
explicitly leaves strength, divisional charts, transits and event timing
unevaluated. Never convert its themes into an arrival promise or a favourable
dasha verdict. Detail supplies the other checked factor rather than repeating
the overview. The authenticated `/astrofriend/topic-reading` route delivers this
contract to the PWA, which independently verifies birth-request binding,
freshness, positions, factors and exact rendered wording. Calculation failure
must not trigger a speculative replacement reading. Existing raw charts,
`--reading-topic`, separation and image output modes retain their contracts.

Uses a local high-precision Vedic astrology engine to compute Lagna, Moon Sign, Nakshatra, Planetary positions across zodiac signs and houses, and Vimshottari Dashas.

## Usage

**CRITICAL - CHART IMAGE GENERATION RULES:**
When generating Kundli chart images, you MUST:
1. Run `calculate.py` to get the planet positions
2. Extract the `planet_positions` array from the output
3. Pass ALL 9 planet positions to `draw_kundli_traditional.py` using the `--planets` parameter
4. If you skip the `--planets` parameter, the chart will be WRONG and RANDOM
5. 🚨 **LAZINESS ALERT:** You MUST include ALL 9 planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu). DO NOT be lazy and only include 3-4 planets! The entire `planet_positions` array must be copied EXACTLY as-is from calculate.py output.
6. ✅ **SHELL SYNTAX FIX:** The `planet_positions` format has been updated to NOT include degree symbols (e.g., removed "at 17.88°"). This prevents "Unterminated quoted string" errors when the AI copies the data to the shell command. You can copy the entire array exactly as shown in calculate.py output without worrying about special characters.

**CRITICAL - PRESERVE OUTPUT FORMAT:**
- When the `draw_kundli_traditional.py` script outputs `IMAGE_URL: <url>`, you MUST include this EXACTLY as-is in your response
- DO NOT convert it to Markdown link format like `[IMAGE_URL](url)`
- DO NOT modify, wrap, or reformat the `IMAGE_URL:` line in any way
- Simply include the full `IMAGE_URL: <url>` line verbatim in your response

**Birth lookup when confirmed backend/session details are incomplete**

Only when needed details are missing or conflicting, use this lookup workflow:
1. **FIRST** check MongoDB API for existing birth details (FAST! 5-20ms):
   ```bash
   # Try MongoDB (5 second timeout - don't wait forever if slow)
   MONGO_DATA=$(curl -s --max-time 5 "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata/<USER_ID>")
   
   # Check if MongoDB has birth data
   DOB=$(echo "$MONGO_DATA" | grep -o '"dateOfBirth":"[^"]*"' | cut -d'"' -f4)
   TOB=$(echo "$MONGO_DATA" | grep -o '"timeOfBirth":"[^"]*"' | cut -d'"' -f4)
   PLACE=$(echo "$MONGO_DATA" | grep -o '"birthPlace":"[^"]*"' | cut -d'"' -f4)
   
   # If MongoDB has all required data, use it!
   if [ -n "$DOB" ] && [ -n "$TOB" ] && [ -n "$PLACE" ]; then
       echo "Found birth data in MongoDB: DOB=$DOB, TOB=$TOB, Place=$PLACE"
   ```
2. **FALLBACK** If MongoDB doesn't have complete data, check Mem0 once; either service can be unavailable:
   ```bash
   else
       echo "MongoDB incomplete or unavailable - checking Mem0..."
       python3 ~/.openclaw/skills/mem0/mem0_client.py list --user-id "<USER_ID>"
   fi
   ```
3. Ask only for missing or conflicting details. Failed lookups do not prove details were never supplied.
4. When user provides birth details, **IMMEDIATELY** store them in BOTH MongoDB AND Mem0:
   ```bash
   # Save to MongoDB user_metadata (for fast lookup next time)
   curl -X POST "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata" \
     -H "Content-Type: application/json" \
     -d '{"userId": "<USER_ID>", "dateOfBirth": "<DOB>", "timeOfBirth": "<TOB>", "birthPlace": "<PLACE>"}'

   # ALSO save to Mem0 (keeps existing Mem0 functionality working!)
   python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "birth details" \
     --content "DOB: <DOB>, TOB: <TOB>, Place: <PLACE>" \
     --user-id "<USER_ID>" \
     --metadata '{"source":"kundli_skill"}'
   ```

> **✅ IMPORTANT:** 
> - MongoDB user_metadata = Fast lookup layer (NEW optimization)
> - Mem0 = Continues working as before (NO functionality broken!)
> - Save to BOTH places = Best of both worlds!

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
The default calculate.py response contains `summary`, `ai_summary`, `lagna`, `moon_sign`, `nakshatra`, and `user_input`:
- **user_input**: Echoes input, coordinates, timezone offset, and calculation engine.
- **lagna**: The Ascendant sign.
- **moon_sign**: The Rashi sign.
- **nakshatra**: The Moon's birth star (Janma Nakshatra). This is ALWAYS the Moon's Nakshatra. Do NOT use the nakshatra of any other planet (e.g. Saturn in House 1) as the birth Nakshatra.
- **ai_summary.planet_positions**: All nine placements, formatted for the existing image tool.
- **summary.current_dasha**: Current Vimshottari Mahadasha and Antardasha.

With `--full`, the Swiss Ephemeris path also returns numeric `planet_positions`, date-specific `ayanamsa`, and `dashas.current.mahadashas`. Vimshottari uses the birth Moon position, its remaining period balance, and a 365.25-day year. Period timestamps are UTC.

Extended legacy data, including panchanga, is optional and lives under `supplemental_jyotishganit`. It uses independent calculation conventions: never substitute its signs or dashas for the primary summary or combine the two charts into one reading. If that engine fails, `supplemental_error` explains why the extra data is absent; the primary chart remains usable. On the jyotishganit fallback path, the full raw chart belongs to that engine instead, as indicated by `user_input.ephemeris_used`.

Calculation failures return error JSON and a nonzero process exit. Do not interpret missing fields as zero positions or invent a chart after failure. `12:00` is accepted as noon in 24-hour notation; `00:00` is midnight.

The draw_kundli_traditional.py tool creates and returns a visual Kundli chart image file.

## Guidelines for Interpretation
For timing or a fuller topic reading use `--timing-topic career|education|finance|marriage|relationship|separation`
with `--topic-intent timing|overview|detail|brief|contact|harmony` and `--reading-language english|hinglish`.
This returns `reviewed-timing-v1`: MD/AD/PD, selected strength/D9 factors,
105 future transit samples and independently reproducible candidate month screening.
Use only its reviewed text or explicitly labelled evidence; no dasha boundary or
mixed observation is an event deadline. See [TIMING_METHOD.md](TIMING_METHOD.md).
For multiple supported questions calculate each requested topic and preserve
their distinct results. For unsupported methods, correct/missing birth inputs,
other languages or media retain the existing agent flow; do not pretend this
screen covers those methods. This is not full Shadbala or a calibrated predictor.
For a confirmed existing marriage use the marriage-only `harmony` intent; its
months concern partnership context, never a new wedding forecast. If a known
married user asks when they will marry, clarify remarriage versus existing harmony.

1. **Lagna and Moon**: State calculated placements accurately. Use only reviewed evidence for personal interpretations; sign labels alone do not establish personality or emotions.
2. **Dashas**: Dates describe calculated period boundaries. Without separately evaluated timing evidence, they cannot establish when a job, marriage or other event will happen.
3. **Limitations**: Do not infer aspects, planetary strength, divisional-chart results, aptitude or partner traits from unevaluated data.
4. **Remedies**: When relevant or requested, use one targeted retrieval for optional low-risk traditional practices. Respect the user's beliefs and avoid guaranteed outcomes.

## Image Generation Policy
- This skill generates **ONLY astrology-related images** (Kundli charts, birth charts, horoscope diagrams)
- It will NOT generate any other types of images
- `draw_kundli_traditional.py` draws the verified placements locally with Pillow; it does not require an image-model API key.

Full-output compatibility: `--full` includes legacy raw fields such as `d1Chart` and `panchanga` as aliases, with engine provenance in `field_sources`. These aliases use jyotishganit's conventions; the primary summary, planets and dashas remain Swiss-based. Use `--legacy-full` when a consumer requires only the original jyotishganit raw schema. It fails explicitly if that engine is unavailable.
