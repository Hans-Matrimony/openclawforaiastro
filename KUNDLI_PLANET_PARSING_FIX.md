# Kundli Chart Empty Issue - Root Cause & Fix

## 🚨 The Problem

**Symptom:** Kundli chart images are showing EMPTY (no Hindi keywords, no planets) - only the grid lines and zodiac signs.

**Root Cause:** The `--planets` argument is being passed with MALFORMED JSON, causing silent failure in `draw_kundli_traditional.py`.

---

## 🔍 What Was Happening

### The Silent Error

**BEFORE (Fixed):**
```python
try:
    planets = json.loads(args.planets) if args.planets else []
except:  # ← SILENTLY catching ALL errors!
    planets = []  # ← Empty array = empty chart!
```

When the JSON parsing failed, the script:
1. ❌ Silently caught the exception
2. ❌ Defaulted to `planets = []`
3. ❌ Drew an EMPTY chart (only Lagna ल shown)
4. ❌ Gave NO indication of what went wrong

### Why JSON Parsing Fails

The `--planets` argument must be a **valid JSON array string**:

```bash
# ✅ CORRECT - Properly formatted JSON
--planets '["Moon is in House 1", "Sun is in House 10"]'

# ❌ WRONG - Missing quotes
--planets '[Moon is in House 1, Sun is in House 10]'

# ❌ WRONG - Single quotes inside (invalid JSON)
--planets "['Moon is in House 1', 'Sun is in House 10']"

# ❌ WRONG - Not stringified
--planets ["Moon is in House 1", "Sun is in House 10"]
```

---

## ✅ The Fix

### 1. Un-hide the Error

**AFTER (Fixed):**
```python
try:
    planets = json.loads(args.planets) if args.planets else []
except Exception as e:
    print(f"⚠️ ERROR PARSING PLANETS: {e} | Raw input: {repr(args.planets)}", file=sys.stderr)
    print(f"⚠️ TIP: --planets must be valid JSON array, e.g., '[\"Moon is in House 1\"]'", file=sys.stderr)
    planets = []
```

Now when JSON parsing fails, you'll see:
```
⚠️ ERROR PARSING PLANETS: Expecting value: line 1 column 2 (char 1) | Raw input: '[Moon, Sun]'
⚠️ TIP: --planets must be valid JSON array, e.g., '["Moon is in House 1"]'
```

### 2. Add Debug Logging

The script now logs every step of planet parsing:

```
🪐 Parsed 9 planet positions from --planets argument
🔍 DEBUG: Processing 9 planet positions
  ✓ Saturn → House 1 → कु
  ✓ Jupiter → House 2 → गु
  ✓ Moon → House 11 → च
  ✓ Sun → House 10 → सु
  ...
📊 RESULT: Planets in 8 houses: [1, 2, 8, 9, 10, 11]
```

### 3. Validate Planet Data

```python
def parse_planet_positions(planets_list):
    if not planets_list:
        print(f"⚠️ WARNING: planets_list is empty or None", file=sys.stderr)
        return house_planets

    for item in planets_list:
        if not isinstance(item, str):
            print(f"⚠️ WARNING: Skipping non-string planet item: {type(item)} = {repr(item)}", file=sys.stderr)
            continue
        # ... rest of parsing
```

---

## 🧪 How to Test

### Run the Test Script

```bash
cd skills/kundli
python test_draw_kundli.py
```

This will run 3 tests:
1. ✅ Example Planets - Tests with correct JSON
2. ✅ Empty Planets - Tests with empty array
3. ✅ Malformed JSON - Tests error handling

### Manual Testing

Test with CORRECT format:
```bash
python draw_kundli_traditional.py \
  --lagna "Taurus" \
  --moon-sign "Pisces" \
  --nakshatra "Revati" \
  --planets '["Saturn is in House 1", "Jupiter is in House 2", "Moon is in House 11"]'
```

Expected output:
```
🪐 Parsed 3 planet positions from --planets argument
🔍 DEBUG: Processing 3 planet positions
  ✓ Saturn → House 1 → कु
  ✓ Jupiter → House 2 → गु
  ✓ Moon → House 11 → च
📊 RESULT: Planets in 3 houses: [1, 2, 11]
IMAGE_URL: https://i.ibb.co/xxxxx/xxxxx.png
```

Test with WRONG format (should show error):
```bash
python draw_kundli_traditional.py \
  --lagna "Taurus" \
  --moon-sign "Pisces" \
  --nakshatra "Revati" \
  --planets '[Saturn, Jupiter]'  # ← WRONG! Missing quotes around strings
```

Expected output:
```
⚠️ ERROR PARSING PLANETS: Expecting value: line 1 column 2 (char 1) | Raw input: '[Saturn, Jupiter]'
⚠️ TIP: --planets must be valid JSON array, e.g., '["Moon is in House 1"]'
⚠️ WARNING: No planet positions provided. Chart will show only Lagna.
```

---

## 🔧 How OpenClaw Agent Should Call This

### From KUNDLI_RESPONSE.md

**STEP 1:** Calculate Kundli with calculate.py
**STEP 2:** Extract `planet_positions` from the output

**STEP 3:** Call draw_kundli_traditional.py with CORRECT format:

```bash
cd ~/.openclaw/skills/kundli && python3 -u draw_kundli_traditional.py \
  --lagna "Taurus" \
  --moon-sign "Pisces" \
  --nakshatra "Revati" \
  --planets '["Saturn is in House 1 (Taurus/Vrishabh)", "Jupiter is in House 2 (Gemini/Mithun)"]' \
  --user-id "+919760347653" \
  --session-id "whatsapp:direct:+919760347653"
```

**CRITICAL:**
- ✅ Use SINGLE quotes around the entire `--planets` value
- ✅ Use DOUBLE quotes around each string inside the array
- ✅ Properly escape if needed: `'["String with \"quotes\"]'`

---

## 📋 Common Mistakes

### Mistake 1: Wrong Quote Types

```bash
# ❌ WRONG - Single quotes inside (invalid JSON)
--planets '['Saturn is in House 1', 'Jupiter is in House 2']'

# ✅ CORRECT - Double quotes inside
--planets '["Saturn is in House 1", "Jupiter is in House 2"]'
```

### Mistake 2: Not Stringifying Array

```python
# ❌ WRONG IN PYTHON - Passing list directly
subprocess.run([
    'python', 'draw_kundli_traditional.py',
    '--planets', ['Saturn is in House 1', 'Jupiter is in House 2']  # ← List, not string!
])

# ✅ CORRECT IN PYTHON - Stringify first
import json
planets_json = json.dumps(['Saturn is in House 1', 'Jupiter is in House 2'])
subprocess.run([
    'python', 'draw_kundli_traditional.py',
    '--planets', planets_json  # ← Properly stringified JSON
])
```

### Mistake 3: Agent Not Extracting planet_positions

The agent MUST extract `planet_positions` from the calculate.py output:

```json
{
  "ai_summary": {
    "planet_positions": [
      "Saturn is in House 1 (Taurus/Vrishabh)",
      "Jupiter is in House 2 (Gemini/Mithun)",
      ...
    ]
  }
}
```

Then pass this EXACT array to draw_kundli_traditional.py.

---

## 🎯 Summary

| Issue | Before Fix | After Fix |
|-------|-----------|-----------|
| **JSON Error** | Silent failure | Shows error + raw input |
| **Empty Planets** | No warning | Shows "no planets provided" |
| **Debug Info** | None | Shows each planet being parsed |
| **Validation** | None | Checks for non-string items |
| **Error Message** | Generic | Shows exactly what's wrong |

**Files Modified:**
- [skills/kundli/draw_kundli_traditional.py](skills/kundli/draw_kundli_traditional.py) - Added error logging
- [skills/kundli/test_draw_kundli.py](skills/kundli/test_draw_kundli.py) - Test script

**Next Steps:**
1. ✅ Run `python test_draw_kundli.py` to verify
2. ⏳ Update OpenClaw agent to pass `--planets` correctly
3. ⏳ Monitor stderr for parsing errors

The script now provides CLEAR debugging information when something goes wrong! 🎉
