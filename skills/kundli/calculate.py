import sys
import os
import json
import argparse
from datetime import datetime, timedelta
from geopy.geocoders import Nominatim
import jyotishganit

try:
    from timezonefinder import TimezoneFinder
    from zoneinfo import ZoneInfo
    _TZ_FINDER = TimezoneFinder()
except ImportError:
    _TZ_FINDER = None

# --- MONKEY PATCH FOR 100% OFFLINE ROBUSTNESS ---
# This overrides jyotishganit to use hardcoded Spica coordinates 
# and enforces 100% offline mode for all calculations.
def patch_jyotishganit():
    from skyfield.api import Star, Loader
    import jyotishganit.core.astronomical as astro
    
    # 1. Hardcode Spica (Alpha Virginis) J2000.0 coordinates
    # This removes the dependency on the ~55MB hip_main.dat file
    def get_spica_patch():
        return Star(
            ra_hours=13.419881,
            dec_degrees=-11.161333,
            ra_mas_per_year=-42.50,
            dec_mas_per_year=-31.73,
            parallax_mas=12.44,
            radial_km_per_s=1.0
        )
    astro._get_spica = get_spica_patch

    # 2. Enforce Offline Mode for the Data Loader
    # This prevents ANY connection attempts to astrology servers
    if hasattr(astro, 'DATA_DIR'):
        astro.loader = Loader(astro.DATA_DIR, expire=False)

try:
    patch_jyotishganit()
except Exception as e:
    # Non-fatal: if patching fails, it will attempt normal operation
    pass
# ------------------------------------------------

# Use relative path for reliability across environments
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CITIES_FILE = os.path.join(SCRIPT_DIR, 'cities_india.json')

# ✅ FIX #6: Nakshatra degree ranges for validation
# Each nakshatra spans 13°20' (13.333°) of the zodiac
NAKSHATRA_RANGES = [
    ("Ashwini", 0, 13.333),
    ("Bharani", 13.333, 26.666),
    ("Krittika", 26.666, 40),
    ("Rohini", 40, 53.333),
    ("Mrigashira", 53.333, 66.666),
    ("Ardra", 66.666, 80),
    ("Punarvasu", 80, 93.333),
    ("Pushya", 93.333, 106.666),
    ("Ashlesha", 106.666, 120),
    ("Magha", 120, 133.333),
    ("Purva Phalguni", 133.333, 146.666),
    ("Uttara Phalguni", 146.666, 160),
    ("Hasta", 160, 173.333),
    ("Chitra", 173.333, 186.666),
    ("Swati", 186.666, 200),
    ("Vishakha", 200, 213.333),
    ("Anuradha", 213.333, 226.666),
    ("Jyeshtha", 226.666, 240),
    ("Mula", 240, 253.333),
    ("Purva Ashadha", 253.333, 266.666),
    ("Uttara Ashadha", 266.666, 280),
    ("Shravana", 280, 293.333),
    ("Dhanishta", 293.333, 306.666),
    ("Shatabhisha", 306.666, 320),
    ("Purva Bhadrapada", 320, 333.333),
    ("Uttara Bhadrapada", 333.333, 346.666),
    ("Revati", 346.666, 360),
]

# ✅ FIX: Calculate correct Pada (1-4) based on degree position within nakshatra
def calculate_pada(absolute_degree, nakshatra_start):
    """
    Calculate the Pada (quarter) of a nakshatra.
    Each nakshatra (13°20') is divided into 4 padas of 3°20' (3.333°) each.
    """
    degree_within_nakshatra = absolute_degree - nakshatra_start
    pada = int(degree_within_nakshatra // 3.333) + 1  # 1-4
    return min(pada, 4)  # Ensure we don't exceed 4

# ✅ FIX #6: Helper to validate and correct nakshatra AND pada based on degree
def validate_or_correct_nakshatra(moon_sign, moon_degree, moon_nakshatra, moon_pada=None):
    """
    Cross-check that the reported nakshatra and pada match the expected values
    for the given Moon sign and degree. If mismatch found, return the CORRECT values.
    """
    # Map sign names to indices
    sign_to_index = {
        "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5,
        "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11
    }

    sign_idx = sign_to_index.get(moon_sign, 0)

    # Calculate absolute zodiac degree (0-360)
    moon_abs_degree = sign_idx * 30 + moon_degree

    # Find expected nakshatra for this degree
    expected_nakshatra = None
    nakshatra_start = None
    for nakshatra, start, end in NAKSHATRA_RANGES:
        if start <= moon_abs_degree < end:
            expected_nakshatra = nakshatra
            nakshatra_start = start
            break

    if expected_nakshatra is None:
        return moon_nakshatra, moon_pada, False  # Can't determine, return as-is

    # ✅ FIX: Calculate CORRECT pada based on absolute degree
    correct_pada = calculate_pada(moon_abs_degree, nakshatra_start)

    # Normalize nakshatra names (handle variations like "Uttara Ashadha" vs "Uttara Ashadha 1")
    nakshatra_corrected = False
    pada_corrected = False

    if moon_nakshatra:
        moon_nakshatra_base = moon_nakshatra.split()[0] if moon_nakshatra else moon_nakshatra
        expected_nakshatra_base = expected_nakshatra.split()[0] if expected_nakshatra else expected_nakshatra

        if moon_nakshatra_base != expected_nakshatra_base:
            nakshatra_corrected = True

    # Check if pada is correct
    if moon_pada and moon_pada != correct_pada:
        pada_corrected = True

    # Return corrected values if needed
    final_nakshatra = expected_nakshatra if nakshatra_corrected else moon_nakshatra
    final_pada = correct_pada if (pada_corrected or nakshatra_corrected) else moon_pada

    return final_nakshatra, final_pada, (nakshatra_corrected or pada_corrected)

def get_coordinates(place):
    # Try local fallback first (case-insensitive)
    try:
        with open(CITIES_FILE, 'r') as f:
            cities = json.load(f)
            # Case-insensitive lookup
            place_lower = place.strip().lower()
            for city_name, coords in cities.items():
                if city_name.lower() == place_lower:
                    return coords[0], coords[1]
    except:
        pass

    # Try live geocoding
    try:
        geolocator = Nominatim(user_agent="acharya_sharma_astro")
        location = geolocator.geocode(place + ", India")
        if location:
            return location.latitude, location.longitude
    except:
        pass

    # ✅ FIX #3: FAIL LOUDLY instead of silent Delhi fallback
    # Using wrong coordinates completely changes Lagna and Moon positions
    raise ValueError(f"Could not find coordinates for '{place}'. Please provide a valid city name in India.")


def get_timezone_offset(lat, lon, birth_dt=None):
    """
    Detect timezone offset from coordinates.
    ✅ FIX #1 (CRITICAL): Use actual birth date/time instead of fixed reference

    Timezone offsets depend on the actual date (DST, historical changes, etc.)
    Using a fixed reference (2000-06-15) causes incorrect Lagna and Moon calculations.
    """
    if _TZ_FINDER is None:
        return 5.5  # Fallback to IST if timezonefinder not installed

    try:
        tz_name = _TZ_FINDER.timezone_at(lat=lat, lng=lon)
        if tz_name:
            from datetime import timezone as _tz
            tz = ZoneInfo(tz_name)

            # ✅ FIX #1: Use actual birth datetime instead of fixed reference
            # This ensures correct offset accounting for DST, historical changes, etc.
            if birth_dt:
                # Use actual birth date/time
                localized_dt = birth_dt.replace(tzinfo=tz)
            else:
                # Fallback to current time if birth_dt not provided (shouldn't happen)
                localized_dt = datetime.now(tz)

            offset_seconds = localized_dt.utcoffset().total_seconds()
            return offset_seconds / 3600
    except Exception:
        pass

    return 5.5  # Fallback to IST

def parse_date(dob_str):
    """Parse date string in various formats."""
    dob_str = dob_str.strip()
    
    # Try various date formats
    formats = [
        "%Y-%m-%d",       # 2001-08-08
        "%d-%m-%Y",       # 08-08-2001
        "%d/%m/%Y",       # 08/08/2001
        "%d %B %Y",       # 08 August 2001
        "%d %b %Y",       # 08 Aug 2001
        "%B %d, %Y",      # August 08, 2001
        "%B %d %Y",       # August 08 2001
        "%b %d, %Y",      # Aug 08, 2001
        "%d-%B-%Y",       # 08-August-2001
        "%Y/%m/%d",       # 2001/08/08
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(dob_str, fmt).date()
        except ValueError:
            continue
    
    raise ValueError(f"Unable to parse date '{dob_str}'. Use formats like '2001-08-08', '08 August 2001', or '08-08-2001'")

def parse_time(tob_str):
    """Parse time string in various formats (12-hour with AM/PM or 24-hour)."""
    tob_str = tob_str.strip()

    # ✅ FIX #7: Handle ambiguous "12" (noon vs midnight)
    # Users often write just "12" without AM/PM, causing confusion
    if tob_str in ["12", "12:00", "12.00"]:
        raise ValueError(
            f"Ambiguous time '{tob_str}'. Could be noon (12:00 PM) or midnight (12:00 AM). "
            f"Please specify AM/PM or use 24-hour format (12:00 for noon, 00:00 for midnight)."
        )

    # Try 12-hour format with AM/PM (e.g., "09:50 AM", "9:50 PM", "12 PM", "5AM")
    for fmt in ["%I:%M %p", "%I:%M%p", "%I:%M:%S %p", "%I:%M:%S%p", "%I %p", "%I%p"]:
        try:
            return datetime.strptime(tob_str, fmt).time()
        except ValueError:
            continue

    # Try 24-hour format (e.g., "09:50", "21:30", "9")
    for fmt in ["%H:%M", "%H:%M:%S", "%H"]:
        try:
            return datetime.strptime(tob_str, fmt).time()
        except ValueError:
            continue

    # If all fail, raise error with helpful message
    raise ValueError(f"Unable to parse time '{tob_str}'. Use formats like '09:50', '21:30', '09:50 AM', or '9:50 PM'")

# ✅ FIX: Planet validation layer - Ephemeris sanity checks
def validate_planet_positions(chart_data):
    """
    Validate that key planets (Sun, Mercury, Mars) are in plausible positions.
    This catches ephemeris calculation errors from jyotishganit.
    """
    validation_errors = []

    d1 = chart_data.get('d1Chart', {})
    planets = d1.get('planets', [])

    planet_positions = {}
    for planet in planets:
        name = planet.get('celestialBody', '')
        sign = planet.get('sign', '')
        degree = planet.get('degree', 0)
        planet_positions[name] = {'sign': sign, 'degree': degree}

    # ✅ CRITICAL VALIDATION: Check for impossible planet positions
    # Note: This is a basic sanity check. For production, use Swiss Ephemeris.

    # Mercury should never be more than 28 degrees from Sun
    if 'Sun' in planet_positions and 'Mercury' in planet_positions:
        sun_sign = planet_positions['Sun']['sign']
        merc_sign = planet_positions['Mercury']['sign']

        sign_to_index = {
            "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5,
            "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11
        }

        sun_idx = sign_to_index.get(sun_sign, 0)
        merc_idx = sign_to_index.get(merc_sign, 0)

        # Calculate angular distance (0-180°)
        distance = abs(merc_idx - sun_idx) * 30
        if distance > 180:
            distance = 360 - distance

        # Mercury should be within 28° of Sun
        if distance > 28:
            validation_errors.append(
                f"Mercury is in {merc_sign} ({distance:.0f}° from Sun in {sun_sign}). "
                f"This exceeds maximum elongation of 28°. Ephemeris calculation may be incorrect."
            )

    # Mars should never be more than 47 degrees from Sun
    if 'Sun' in planet_positions and 'Mars' in planet_positions:
        sun_idx = sign_to_index.get(planet_positions['Sun']['sign'], 0)
        mars_idx = sign_to_index.get(planet_positions['Mars']['sign'], 0)

        distance = abs(mars_idx - sun_idx) * 30
        if distance > 180:
            distance = 360 - distance

        if distance > 47:
            validation_errors.append(
                f"Mars is in {planet_positions['Mars']['sign']} ({distance:.0f}° from Sun in {planet_positions['Sun']['sign']}). "
                f"This exceeds maximum elongation of 47°. Ephemeris calculation may be incorrect."
            )

    return validation_errors


def calculate_kundli(dob_str, tob_str, place):
    # ✅ FIX #3: get_coordinates now raises ValueError if place not found
    # No more silent Delhi fallback
    lat, lon = get_coordinates(place)

    # Parse date and time into a single datetime object
    birth_time = parse_time(tob_str)
    birth_date = parse_date(dob_str)
    birth_dt = datetime.combine(birth_date, birth_time)

    # ✅ FIX #1: Pass birth_dt to get correct timezone offset
    # Timezone offsets depend on actual birth date (DST, historical changes)
    tz_offset = get_timezone_offset(lat, lon, birth_dt)
    
    # Call the top-level API function
    # Signature: birth_date (datetime), latitude (float), longitude (float), timezone_offset (float)
    chart = jyotishganit.calculate_birth_chart(
        birth_date=birth_dt,
        latitude=lat,
        longitude=lon,
        timezone_offset=tz_offset,
        name="User"
    )
    
    # Extract data using to_dict()
    chart_data = chart.to_dict()
    
    # helper for summary
    def get_sign(obj):
        if hasattr(obj, 'to_dict'):
            return obj.to_dict().get('sign')
        return None

    # ADD FLATTENED SUMMARY FOR AI (CRITICAL FOR ACCURACY)
    try:
        # ✅ FIX 4: Prefer chart.ascendant if available (more reliable)
        if hasattr(chart, 'ascendant') and chart.ascendant:
            # Note: jyotishganit doesn't provide degree in ascendant object, only sign
            lagna = chart.ascendant.sign if hasattr(chart.ascendant, 'sign') else chart.ascendant.to_dict().get('sign')
        else:
            # Fallback: Find House 1 by number, NOT by index (houses may be unordered!)
            lagna_house = next((h for h in chart.d1_chart.houses if h.to_dict().get('number') == 1), None)
            lagna = lagna_house.to_dict().get('sign') if lagna_house else None

        # ✅ FIX 2: Case-insensitive moon extraction (some libraries use "MOON" or "moon")
        moon_planet = next(
            (p for p in chart.d1_chart.planets if p.celestial_body.lower() == 'moon'),
            None
        )
        if not moon_planet:
            raise ValueError("Moon planet not found in chart data")

        # ✅ FIX 5: Validate Moon degree (CRITICAL for boundary cases)
        moon_data = moon_planet.to_dict()
        moon_degree = moon_data.get('degree', 0)

        if not (0 <= moon_degree <= 30):
            raise ValueError(f"Invalid Moon degree: {moon_degree}. Must be between 0-30. Chart calculation may be incorrect.")

        moon_sign = moon_data.get('sign')
        # CRITICAL: Always use the Moon's own nakshatra, NOT panchanga or any other planet
        moon_nakshatra = moon_data.get('nakshatra')
        # Fall back to panchanga only if Moon nakshatra unavailable
        if not moon_nakshatra:
            moon_nakshatra = chart.panchanga.nakshatra
        moon_pada = moon_data.get('pada')

        # ✅ FIX 6 & 7: Initialize confidence and warnings BEFORE using them
        confidence = "high"
        warnings = []

        # ✅ FIX 1: Validate and correct BOTH nakshatra AND pada based on degree (CRITICAL)
        moon_nakshatra, moon_pada, was_corrected = validate_or_correct_nakshatra(moon_sign, moon_degree, moon_nakshatra, moon_pada)

        # Add warning if nakshatra or pada was corrected
        if was_corrected:
            warnings.append(f"Library error detected. Corrected to '{moon_nakshatra} Pada {moon_pada}' based on Moon's actual position ({moon_degree:.2f}° in {moon_sign}).")
            confidence = "medium"

        # Check if Moon is near sign boundary (within 1 degree)
        if moon_degree > 29.0 or moon_degree < 1.0:
            warnings.append(f"Moon is at {moon_degree:.2f}° in {moon_sign}, very near sign boundary. Small time difference (±2-3 minutes) could change Moon sign.")
            confidence = "medium"

        # Check if Moon is in a nakshatra that spans two signs (transition zones)
        transition_nakshatras = ["Krittika", "Mrigashira", "Punarvasu", "Pushya", "Ashlesha",
                                "Uttara Phalguni", "Hasta", "Chitra", "Vishakha", "Anuradha", "Jyeshtha",
                                "Mula", "Purva Ashadha", "Shravana", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"]

        moon_nakshatra_base = moon_nakshatra.split()[0] if moon_nakshatra else moon_nakshatra
        if moon_nakshatra_base in transition_nakshatras:
            if moon_degree > 13.0 or moon_degree < 0.33:
                warnings.append(f"Moon is in {moon_nakshatra} (a transition nakshatra) near sign edge at {moon_degree:.2f}°. Verification recommended.")
                if confidence == "high":
                    confidence = "medium"

        # ✅ FIX: Validate planet positions (Mercury, Mars, Sun)
        planet_validation_errors = validate_planet_positions(chart_data)
        if planet_validation_errors:
            warnings.extend(planet_validation_errors)
            confidence = "low"
        # Rashi mapping for AI prompts
        HINDI_RASHI = {
            "Aries": "Mesh", "Taurus": "Vrishabh", "Gemini": "Mithun", "Cancer": "Kark",
            "Leo": "Singh", "Virgo": "Kanya", "Libra": "Tula", "Scorpio": "Vrishchik",
            "Sagittarius": "Dhanu", "Capricorn": "Makar", "Aquarius": "Kumbh", "Pisces": "Meen"
        }
        lagna_hindi = HINDI_RASHI.get(lagna, lagna) if lagna else lagna
        moon_hindi = HINDI_RASHI.get(moon_sign, moon_sign) if moon_sign else moon_sign
        
        # Format current dasha
        # NOTE: Assumes dashas['current']['mahadashas'] is ordered with current dasha first.
        # This is typically true for jyotishganit library, but may vary across versions.
        dashas = chart_data.get('dashas', {}).get('current', {}).get('mahadashas', {})
        dasha_str = "Vimshottari Dasha is active. Check full 'dashas' field for timings."
        if dashas:
            md_planet = list(dashas.keys())[0]
            md_data = dashas[md_planet]
            md_end = md_data.get('end')
            dasha_str = f"Current Mahadasha: {md_planet} (Ends {md_end}). "
            
            ads = md_data.get('antardashas', {})
            if ads:
                ad_planet = list(ads.keys())[0]
                ad_end = ads[ad_planet].get('end')
                dasha_str += f"Current Antardasha: {ad_planet} (Ends {ad_end})."

        # Format Planets in houses
        # ✅ FIX 3: Sort houses by number to ensure consistent ordering
        d1 = chart_data.get('d1Chart', {})
        houses_sorted = sorted(d1.get('houses', []), key=lambda x: x.get('number', 0))

        planets_summary = []
        for house in houses_sorted:
            h_num = house.get('number')
            for occ in house.get('occupants', []):
                p_name = occ.get('celestialBody')
                p_sign = occ.get('sign')
                p_sign_hindi = HINDI_RASHI.get(p_sign, p_sign)
                planets_summary.append(f"{p_name} is in House {h_num} ({p_sign}/{p_sign_hindi})")
        
        # CONSTRUCT FINAL OUTPUT WITH SUMMARY AT THE TOP (To prevent truncation issues)
        final_output = {
            "summary": {
                "lagna": str(lagna),
                "moon_sign": str(moon_sign),
                "nakshatra": str(moon_nakshatra),  # MOON's Nakshatra (Janma Nakshatra)
                "nakshatra_note": "This is the Moon's Nakshatra (Janma Nakshatra/birth star). Not Saturn or any other planet.",
                "current_dasha": dasha_str,
                # ✅ FIX 7: Add confidence and warnings to output
                "confidence": confidence,
            },
            "ai_summary": {
                "rashi_info": f"Rashi (Moon Sign): {moon_sign} ({moon_hindi}). Lagna (Ascendant): {lagna} ({lagna_hindi}). Nakshatra: {moon_nakshatra} Pada {moon_pada}.",
                "dasha_info": dasha_str,
                "planet_positions": planets_summary,
                "instructions_for_ai": f"SYSTEM INSTRUCTION: DO NOT GUESS ZODIAC SIGNS! You MUST reply saying their Rashi is exactly what is written in rashi_info above ({moon_sign}/{moon_hindi}). If you state any other Rashi, you are hallucinating Western astrology dates and will be penalized. Look at dasha_info for timing predictions."
            }
        }

        # ✅ FIX 7: Add warnings if any boundary issues detected
        if warnings:
            final_output["summary"]["warnings"] = warnings
        
        # Add back all the raw chart data for detail-heavy queries
        final_output.update(chart_data)
        
        # Extra top-level keys for backup - all three must be consistent
        final_output["lagna"] = final_output["summary"]["lagna"]
        final_output["moon_sign"] = final_output["summary"]["moon_sign"]
        final_output["nakshatra"] = final_output["summary"]["nakshatra"]  # MOON's Nakshatra explicitly

    except Exception as e:
        final_output = {
            "summary_error": str(e),
            "raw_data": chart_data
        }

    # Add metadata
    final_output["user_input"] = {
        "dob": dob_str,
        "tob": tob_str,
        "place": place,
        "coordinates": {"lat": lat, "lon": lon},
        "timezone_offset": tz_offset
    }

    # ✅ FIX #3: No silent fallback warning anymore - we fail loudly instead
    # If we reach here, coordinates are valid

    return final_output

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Acharya Sharma Kundli Engine')
    parser.add_argument('--dob', required=True, help='Date of Birth (YYYY-MM-DD, DD Month YYYY, etc.)')
    parser.add_argument('--tob', required=True, help='Time of Birth (HH:MM or HH:MM AM/PM)')
    parser.add_argument('--place', required=True, help='Place of Birth')
    parser.add_argument('--full', action='store_true', help='Return full raw data (warning: 7000+ lines)')
    
    args = parser.parse_args()
    
    try:
        output = calculate_kundli(args.dob, args.tob, args.place)
        
        # If not full mode, trim the output to essentials to prevent LLM confusion
        if not args.full:
            trimmed = {
                "summary": output.get("summary"),
                "ai_summary": output.get("ai_summary"),
                "lagna": output.get("lagna"),
                "moon_sign": output.get("moon_sign"),
                "nakshatra": output.get("nakshatra"),
                "user_input": output.get("user_input"),
                "note": "Raw planet/dasha data hidden. Run with --full if you need specific degrees or full dasha tables."
            }
            output = trimmed
            
        print(json.dumps(output, indent=2, default=lambda x: str(x)))
    except Exception as e:
        import traceback
        error_info = {
            "status": "error", 
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))
        sys.exit(1)