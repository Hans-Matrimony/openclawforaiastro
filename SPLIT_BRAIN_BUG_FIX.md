# Split-Brain Bug Fix - Summary

## The Problem (Identified by Gemini)

Gemini found a critical **split-brain bug** in the Kundli calculation:

```
Nakshatra field: "Ashwini"
Dasha calculation: Sun Mahadasha (1998-2004)

But Sun rules Krittika, not Ashwini!
```

This was a **data contradiction** - the system couldn't decide whether the Moon was in Ashwini or Krittika.

## Root Cause

### 1. The `.get('degree', 0)` Fallback Trap

```python
# ❌ WRONG CODE
moon_data = moon_planet.to_dict()
moon_degree = moon_data.get('degree', 0)  # ← Falls back to 0 if 'degree' key doesn't exist
```

**Problem**: jyotishganit's `to_dict()` returns `signDegrees`, not `degree`.

When the code didn't find 'degree', it defaulted to **0**, which is astronomically impossible for November 23, 1999.

### 2. The Aggressive Validator

```python
# The validator saw 0.0° Aries and "corrected" the Nakshatra
moon_nakshatra, moon_pada, was_corrected = validate_or_correct_nakshatra(
    moon_sign,    # "Aries"
    moon_degree,  # 0.0 ← WRONG!
    moon_nakshatra,  # "Krittika" (from jyotishganit - CORRECT)
    moon_pada
)
# Result: "Corrected to 'Ashwini'" ❌
```

### 3. The Dasha Contradiction

- **Dasha said**: Sun Mahadasha (1998-2004)
- **Sun rules**: Krittika Nakshatra
- **Nakshatra field said**: Ashwini ❌
- **Conclusion**: Moon was actually in **Krittika**, not Ashwini

## The Fix

### ✅ Fix 1: Check Multiple Degree Keys

```python
# ✅ FIXED CODE
moon_degree = moon_data.get('signDegrees',      # ← jyotishganit's actual key
                      moon_data.get('degree',
                        moon_data.get('normDegree',
                          moon_data.get('longitude_in_sign',
                            moon_data.get('longitude', None)))))

if moon_degree is None:
    raise ValueError(f"Moon degree not found. Available keys: {list(moon_data.keys())}")
```

### ✅ Fix 2: Reject Exactly 0.0 Degrees

```python
# ✅ FIXED CODE
if moon_degree == 0.0:
    raise ValueError("Moon degree is exactly 0.0° - this is likely a data error")
```

True 0.0000° alignments are astronomically rare and usually indicate missing data.

### ✅ Fix 3: Safeguard the Validator

```python
# ✅ FIXED CODE
def validate_or_correct_nakshatra(moon_sign, moon_degree, moon_nakshatra, moon_pada=None):
    # ✅ CRITICAL FIX: If degree is exactly 0.0, refuse to "correct"
    if moon_degree == 0.0 and moon_sign == "Aries":
        # This is almost certainly a data error, not a real position
        # Don't override the library's Nakshatra calculation
        return moon_nakshatra, moon_pada, False

    # ... rest of validation
```

### ✅ Fix 4: Remove Duplicate Code

Found and removed duplicate `moon_planet` extraction block (was repeated twice).

### ✅ Fix 5: Update Test Expected Value

```python
# ❌ WRONG (before)
"expected": {
    "nakshatra": "Ashwini",  # WRONG!
}

# ✅ CORRECT (after)
"expected": {
    "nakshatra": "Krittika",  # Confirmed by Dasha analysis
}
```

## Results

### Before Fix
```
Nakshatra: Ashwini ❌
Moon degree: 0.00° (data error)
Dasha: Sun Mahadasha (1998-2004)
Contradiction: Sun rules Krittika, but Nakshatra says Ashwini
```

### After Fix
```
Nakshatra: Krittika ✅
Moon degree: 28.72° (actual data)
Dasha: Sun Mahadasha (1998-2004)
Consistent: Sun rules Krittika, and Nakshatra is Krittika ✅
```

## Test Output

```bash
$ python tests/test_ephemeris_accuracy.py

[ACCURACY CHECK]
   [OK] Moon sign: Aries (CORRECT)
   [OK] Nakshatra: Krittika (CORRECT)  ← FIXED!
   [OK] Lagna: Leo (CORRECT)
   [X] Mercury: Libra (expected Scorpio)
   [X] Mars: Capricorn (expected Sagittarius)

[WARNINGS]
   - Moon is in Krittika (a transition nakshatra) near sign edge at 28.72°
```

## What's Fixed vs What Remains

### ✅ FIXED
- Moon sign: Correct
- Nakshatra: Correct (Krittika, not Ashwini)
- Lagna: Correct
- Dasha consistency: Fixed (no more contradiction)
- Data integrity: Fixed (0.00° bug eliminated)

### ❌ REMAINING (requires pyswisseph)
- Mercury: Libra (should be Scorpio)
- Mars: Capricorn (should be Sagittarius)

**To reach 100% accuracy**: Install pyswisseph (see [INSTALL_PYSWISSEPH.md](INSTALL_PYSWISSEPH.md))

## Files Modified

1. **[calculate.py](skills/kundli/calculate.py)** - Fixed degree extraction and validator
2. **[tests/test_ephemeris_accuracy.py](tests/test_ephemeris_accuracy.py)** - Fixed expected value

## Credits

- **Bug discovered by**: Gemini (Google AI)
- **Root cause analysis**: `.get('degree', 0)` fallback trap
- **Dasha contradiction proof**: Sun Mahadasha + Krittika connection

## Conclusion

The split-brain bug is **fixed**. The system now correctly reports **Krittika** Nakshatra, which is consistent with the Dasha calculation.

The remaining Mercury/Mars errors are jyotishganit calculation inaccuracies that can only be fixed by installing pyswisseph for 100% Swiss Ephemeris accuracy.
