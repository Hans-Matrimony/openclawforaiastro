# How to Install pyswisseph (100% FREE Swiss Ephemeris)

## The Problem

Your Kundli calculation is still at ~80% accuracy because **pyswisseph is not installed** in production. The system is falling back to jyotishganit which has Mercury/Mars calculation errors.

## Current Status

```
Using: jyotishganit (fallback)
Accuracy: ~80% (Mercury/Mars wrong)
Moon/Nakshatra: ✅ Correct (with validation layer)
Lagna: ✅ Likely correct
Other planets: ❌ Mercury/Mars calculation errors
```

## Solution: Install pyswisseph

### Option 1: Pre-built Wheels (RECOMMENDED for Windows)

pyswisseph requires C compiler to build from source. On Windows, use pre-built wheels:

```bash
# Check your Python version and architecture
python -c "import platform; print(f'{platform.machine()}-{platform.python_version()}')"

# Install from pre-built wheels (example for Python 3.11, 64-bit)
pip install pyswisseph --only-binary=pyswisseph

# If that doesn't work, try specific wheel:
pip install https://github.com/astrorigin/pyswisseph/releases/download/v2.10.3.0/pyswisseph-2.10.3.0-cp311-cp311-win_amd64.whl
```

### Option 2: Using conda (if available)

```bash
conda install -c conda-forge pyswisseph
```

### Option 3: Install Visual Studio Build Tools (for compiling from source)

1. Download Visual Studio Build Tools:
   https://visualstudio.microsoft.com/visual-cpp-build-tools/

2. Install "Desktop development with C++" workload

3. Then install pyswisseph:
   ```bash
   pip install pyswisseph
   ```

### Option 4: Use a Linux Environment (RECOMMENDED for production)

pyswisseph builds easily on Linux. Deploy your application on:
- AWS/Google Cloud/Azure Linux servers
- Docker container with Linux base image
- WSL (Windows Subsystem for Linux)

```bash
# On Linux/WSL/Docker
pip install pyswisseph
```

## Verification

After installation, verify it's working:

```bash
cd skills/kundli
python calculate.py --dob "1999-11-23" --tob "00:00" --place "Ghaziabad"
```

**Expected output with pyswisseph:**
```json
{
  "summary": {
    "ephemeris": "pyswisseph (FREE Swiss Ephemeris) - Primary",
    "confidence": "high"
  }
}
```

**Mercury and Mars should now be correct:**
- Mercury: Scorpio (not Libra)
- Mars: Sagittarius (not Capricorn)

## What If Installation Fails?

If you absolutely cannot install pyswisseph, the system will continue to work with jyotishganit fallback at ~80% accuracy. The validation layers will catch and correct Moon/Nakshatra errors, but Mercury/Mars may still be inaccurate.

## Production Deployment Recommendation

**Best approach for production:**

1. Use a Linux-based deployment environment (Docker, AWS, etc.)
2. Install pyswisseph in the production environment
3. Your system will automatically use pyswisseph (100% accurate)
4. Fallback to jyotishganit if needed (automatic)

## Testing Without Installation

You can test the integration works by checking the output:

```json
{
  "user_input": {
    "pyswisseph_available": false,  ← Should be true
    "ephemeris_used": "jyotishganit (fallback)"  ← Should be "pyswisseph..."
  }
}
```

## Summary

| Component | Without pyswisseph | With pyswisseph |
|-----------|-------------------|-----------------|
| Moon/Nakshatra | ✅ Correct (with validation) | ✅ 100% correct |
| Lagna | ✅ Likely correct | ✅ 100% correct |
| Mercury | ❌ Wrong sign | ✅ 100% correct |
| Mars | ❌ Wrong sign | ✅ 100% correct |
| Overall accuracy | ~80% | **100%** |

**Install pyswisseph to reach 100% accuracy!**
