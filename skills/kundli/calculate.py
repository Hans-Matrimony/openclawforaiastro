import sys
import os
import json
import argparse
import math
import hashlib
from pathlib import Path
from bisect import bisect_right
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from vimshottari import current_period
from natal_cache import cached_natal
from geopy.geocoders import Nominatim

# Dependencies are installed at build time; imports must not mutate the runtime.
_PYSWISSEPH_AVAILABLE = False

def ensure_pyswisseph():
    """
    Check for the build-time ephemeris dependency without installing packages.
    """
    global _PYSWISSEPH_AVAILABLE

    # First check if already available
    try:
        import swisseph as swe
        _PYSWISSEPH_AVAILABLE = True
        return True
    except ImportError:
        pass

    _PYSWISSEPH_AVAILABLE = False
    return False

# Try to ensure pyswisseph is available on import
ensure_pyswisseph()

if _PYSWISSEPH_AVAILABLE:
    import swisseph as swe


try:
    import jyotishganit
except ImportError:
    jyotishganit = None

try:
    from timezonefinder import TimezoneFinder
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

# ✅ PYSWISSEPH CONSTANTS (FREE Swiss Ephemeris)
# CORRECT Planet IDs (Ketu removed, handled manually)
PYSWISSEPH_PLANETS = {
    'Sun': 0, 'Moon': 1, 'Mercury': 2, 'Venus': 3,
    'Mars': 4, 'Jupiter': 5, 'Saturn': 6, 'Rahu': 11
}

PYSWISSEPH_SIDEREAL_MODES = {'LAHIRI': 1, 'RAMAN': 3, 'KP': 5}

# Sign names
SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
         'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']

HINDI_RASHI = {
    "Aries": "Mesh", "Taurus": "Vrishabh", "Gemini": "Mithun", "Cancer": "Kark",
    "Leo": "Singh", "Virgo": "Kanya", "Libra": "Tula", "Scorpio": "Vrishchik",
    "Sagittarius": "Dhanu", "Capricorn": "Makar", "Aquarius": "Kumbh", "Pisces": "Meen"
}

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
    if not math.isfinite(absolute_degree) or not 0 <= absolute_degree < 360:
        raise ValueError("Invalid sidereal longitude")
    # Subtracting the star start before division loses precision at boundaries
    # such as 20 degrees. Compare against global boundaries instead.
    quarter = bisect_right([i * (360 / 108) for i in range(108)], absolute_degree) - 1
    return quarter % 4 + 1

# ✅ FIX #6: Helper to validate and correct nakshatra AND pada based on degree
def validate_or_correct_nakshatra(moon_sign, moon_degree, moon_nakshatra, moon_pada=None):
    """Derive the birth star and quarter from a validated Moon position."""
    if moon_sign not in SIGNS or not math.isfinite(moon_degree) or not 0 <= moon_degree < 30:
        raise ValueError("Invalid Moon position")
    longitude = SIGNS.index(moon_sign) * 30 + moon_degree
    expected, start = get_nakshatra_from_degree(longitude)
    pada = calculate_pada(longitude, start)
    return expected, pada, (expected != moon_nakshatra or pada != moon_pada)


def get_nakshatra_from_degree(degree):
    """Use exact equal divisions rather than rounded boundary constants."""
    if not math.isfinite(degree) or not 0 <= degree < 360:
        raise ValueError("Invalid sidereal longitude")
    index = bisect_right([i * (360 / 27) for i in range(27)], degree) - 1
    return NAKSHATRA_RANGES[index][0], index * (360 / 27)

def degree_to_sign_degree(degree, ayanamsa):
    """Convert tropical degree to sidereal sign and degree"""
    # Apply ayanamsa correction
    sidereal_degree = (degree - ayanamsa) % 360
    sign_idx = int(sidereal_degree // 30)
    degree_in_sign = sidereal_degree % 30
    return SIGNS[sign_idx], degree_in_sign, sidereal_degree

def get_house_from_sign(planet_sign, lagna_sign):
    """
    Calculate House number strictly using the Vedic Whole Sign (Rashi) system.
    House 1 is always the entire sign of the Lagna.
    """
    sign_to_index = {
        "Aries": 0, "Taurus": 1, "Gemini": 2, "Cancer": 3, "Leo": 4, "Virgo": 5,
        "Libra": 6, "Scorpio": 7, "Sagittarius": 8, "Capricorn": 9, "Aquarius": 10, "Pisces": 11
    }
    
    p_idx = sign_to_index.get(planet_sign, 0)
    l_idx = sign_to_index.get(lagna_sign, 0)
    
    # Calculate difference in signs (1 to 12)
    house = ((p_idx - l_idx) % 12) + 1
    return house

# ✅ PYSWISSEPH CALCULATION ENGINE (100% FREE, 100% ACCURATE)
def calculate_kundli_pyswisseph(birth_dt, lat, lon, ayanamsa_name='LAHIRI', node_convention='true'):
    """
    Calculate Kundli using FREE pyswisseph (Swiss Ephemeris).
    This is 100% FREE and provides professional-grade accuracy.

    Returns complete planet positions with house numbers.
    """
    if not _PYSWISSEPH_AVAILABLE:
        raise ImportError("pyswisseph is not installed. Run: pip install pyswisseph")
    if node_convention not in ('true', 'mean'):
        raise ValueError('Node convention must be true or mean')
    validate_coordinates(lat, lon)
    if birth_dt.tzinfo is not None:
        birth_dt = birth_dt.astimezone(timezone.utc).replace(tzinfo=None)
    if ayanamsa_name not in PYSWISSEPH_SIDEREAL_MODES:
        raise ValueError('Unsupported ayanamsa')

    # Optional local ephemeris files; Swiss Ephemeris itself does not download.
    # A read-only skill mount is valid, so do not create runtime directories here.
    ephe_path = os.path.join(SCRIPT_DIR, 'ephe')
    swe.set_ephe_path(ephe_path)

    # Convert to Julian Day
    # ✅ FIX: Try different method signatures for swe.julday()
    # Old pyswisseph: swe.julday(year, month, day, hour, minute, second)
    # New pyswisseph: swe.julday(timestamp) or swe.julday(year, month, day, ...)
    # Try old-style (year, month, day, hour(fractional))
    try:
        hour_fractional = birth_dt.hour + birth_dt.minute/60.0 + birth_dt.second/3600.0
        jd = swe.julday(birth_dt.year, birth_dt.month, birth_dt.day, hour_fractional)
    except Exception as e:
        print(f"⚠️ swe.julday failed with {e}, trying alternative...", file=sys.stderr)
        # Try timestamp fallback if the version is weird
        jd = swe.julday(birth_dt.timestamp())

    swe.set_sid_mode(PYSWISSEPH_SIDEREAL_MODES[ayanamsa_name])
    ayanamsa = swe.get_ayanamsa_ut(jd)

    # ✅ Calculate houses (including Lagna/Ascendant)
    # pyswisseph returns (cusps, ascmc); ascmc[0] is the ascendant.
    try:
        # Try different swe.houses() signatures
        # Old: swe.houses(jd, lat, lon, b'P')
        # New: swe.houses(jd, lat, lon, b'P', optionally more flags)
        try:
            houses_long = swe.houses(jd, lat, lon, b'W')
        except TypeError as e:
            print(f"⚠️ Trying alternative houses() format: {e}", file=sys.stderr)
            # Try without system byte string
            houses_long = swe.houses(jd, lat, lon, 'W')

        lagna_tropical = houses_long[1][0]  # Ascendant in tropical degrees

        # Convert Lagna to sidereal
        lagna_sign, lagna_degree, lagna_sidereal = degree_to_sign_degree(lagna_tropical, ayanamsa)
    except Exception as e:
        # If house calculation fails, we can't proceed
        print(f"⚠️ pyswisseph house calculation failed: {e}", file=sys.stderr)
        raise ValueError(f"House calculation failed: {e}")

    # Calculate planet positions
    planet_positions = []
    planet_ids = {**PYSWISSEPH_PLANETS, 'Rahu': 11 if node_convention == 'true' else 10}
    for planet_name, planet_id in planet_ids.items():
        try:
            xx, ret = swe.calc_ut(jd, planet_id)
            tropical_degree = xx[0] % 360
            sign, degree_in_sign, sidereal_degree = degree_to_sign_degree(tropical_degree, ayanamsa)

            # Calculate which house this planet is in using WHOLE SIGN system
            house = get_house_from_sign(sign, lagna_sign)

            planet_positions.append({
                'name': planet_name,
                'tropical_degree': tropical_degree,
                'sidereal_degree': sidereal_degree,
                'sign': sign,
                'degree_in_sign': degree_in_sign,
                'house': house
            })
        except Exception as e:
            raise ValueError(f"Could not calculate {planet_name}") from e

    # ✅ Calculate Ketu manually (Always 180 degrees opposite Rahu)
    rahu_data = next((p for p in planet_positions if p['name'] == 'Rahu'), None)
    if rahu_data:
        ketu_tropical = (rahu_data['tropical_degree'] + 180) % 360
        k_sign, k_degree_in_sign, k_sidereal = degree_to_sign_degree(ketu_tropical, ayanamsa)
        k_house = get_house_from_sign(k_sign, lagna_sign)

        planet_positions.append({
            'name': 'Ketu',
            'tropical_degree': ketu_tropical,
            'sidereal_degree': k_sidereal,
            'sign': k_sign,
            'degree_in_sign': k_degree_in_sign,
            'house': k_house
        })

    # Extract Moon data
    moon_data = next((p for p in planet_positions if p['name'] == 'Moon'), None)
    if len(planet_positions) != 9 or moon_data is None:
        raise ValueError("Incomplete chart: all nine planets including Moon are required")
    moon_sign = moon_data['sign']
    moon_degree = moon_data['degree_in_sign']

    # Calculate Nakshatra and Pada
    moon_sidereal = moon_data['sidereal_degree']
    moon_nakshatra, nakshatra_start = get_nakshatra_from_degree(moon_sidereal)
    moon_pada = calculate_pada(moon_sidereal, nakshatra_start) if moon_nakshatra else None

    return {
        'planet_positions': planet_positions,  # Full list with house numbers
        'moon_sign': moon_sign,
        'moon_degree': moon_degree,
        'moon_nakshatra': moon_nakshatra,
        'moon_pada': moon_pada,
        'moon_sidereal_degree': moon_sidereal,
        'lagna': lagna_sign,  # Now properly calculated!
        'lagna_degree': lagna_degree,
        'ayanamsa_used': ayanamsa_name,
        'ayanamsa_degree': ayanamsa,
        'node_convention': node_convention,
        'ephemeris': 'pyswisseph (FREE Swiss Ephemeris)'
    }

def validate_coordinates(lat, lon):
    if (type(lat) not in (int, float) or type(lon) not in (int, float)
            or not math.isfinite(lat) or not math.isfinite(lon)
            or not -90 < lat < 90 or not -180 <= lon <= 180):
        raise ValueError('Valid latitude (-90, 90) and longitude [-180, 180] are required')


def get_coordinates(place):
    if not isinstance(place, str) or not place.strip() or len(place) > 200:
        raise ValueError('A specific birthplace is required')
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
        locations = geolocator.geocode(place, exactly_one=False, limit=3, timeout=5)
        if locations and len(locations) == 1:
            validate_coordinates(locations[0].latitude, locations[0].longitude)
            return locations[0].latitude, locations[0].longitude
    except:
        pass

    # ✅ FIX #3: FAIL LOUDLY instead of silent Delhi fallback
    # Using wrong coordinates completely changes Lagna and Moon positions
    raise ValueError('Birthplace not uniquely resolved; provide city, region and country or confirmed coordinates')


def get_timezone_offset(lat, lon, birth_dt=None):
    """
    Detect timezone offset from coordinates.
    ✅ FIX #1 (CRITICAL): Use actual birth date/time instead of fixed reference

    Timezone offsets depend on the actual date (DST, historical changes, etc.)
    Using a fixed reference (2000-06-15) causes incorrect Lagna and Moon calculations.
    """
    if _TZ_FINDER is None:
        raise ValueError('Timezone resolver unavailable; install timezonefinder at build time')
    if birth_dt is None:
        raise ValueError('Birth datetime is required to resolve the historical timezone offset')
    tz_name = _TZ_FINDER.timezone_at(lat=lat, lng=lon)
    if not tz_name:
        raise ValueError('Birth timezone could not be resolved; confirm the birthplace')
    tz = ZoneInfo(tz_name)
    candidates = set()
    for fold in (0, 1):
        local = birth_dt.replace(tzinfo=tz, fold=fold)
        utc = local.astimezone(timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) == birth_dt:
            candidates.add(local.utcoffset().total_seconds())
    if len(candidates) != 1:
        raise ValueError('Ambiguous or nonexistent local birth time; confirm the time and UTC offset')
    return candidates.pop() / 3600

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
    if tob_str in ["12", "12.00"]:
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

    # Venus should never be more than 47 degrees from Sun
    # Venus is an inferior planet (orbits between Earth and Sun)
    # It can never exceed ~47° elongation from the Sun
    if 'Sun' in planet_positions and 'Venus' in planet_positions:
        sun_idx = sign_to_index.get(planet_positions['Sun']['sign'], 0)
        venus_idx = sign_to_index.get(planet_positions['Venus']['sign'], 0)

        distance = abs(venus_idx - sun_idx) * 30
        if distance > 180:
            distance = 360 - distance

        if distance > 47:
            validation_errors.append(
                f"Venus is in {planet_positions['Venus']['sign']} ({distance:.0f}° from Sun in {planet_positions['Sun']['sign']}). "
                f"This exceeds maximum elongation of 47°. Ephemeris calculation may be incorrect."
            )

    return validation_errors


def calculate_kundli(dob_str, tob_str, place, include_supplemental=False, legacy_full=False, node_convention='true',
                     latitude=None, longitude=None, utc_offset=None):
    # ✅ FIX #3: get_coordinates now raises ValueError if place not found
    # No more silent Delhi fallback
    if (latitude is None) != (longitude is None):
        raise ValueError('Both latitude and longitude are required')
    lat, lon = get_coordinates(place) if latitude is None else (latitude, longitude)
    validate_coordinates(lat, lon)

    # Parse date and time into a single datetime object
    birth_time = parse_time(tob_str)
    birth_date = parse_date(dob_str)
    birth_dt = datetime.combine(birth_date, birth_time)

    # ✅ FIX #1: Pass birth_dt to get correct timezone offset
    # Timezone offsets depend on actual birth date (DST, historical changes)
    if utc_offset is not None and (type(utc_offset) not in (int, float)
            or not math.isfinite(utc_offset) or not -14 <= utc_offset <= 14):
        raise ValueError('Confirmed UTC offset must be between -14 and +14 hours')
    tz_offset = get_timezone_offset(lat, lon, birth_dt) if utc_offset is None else utc_offset

    # ✅ FIX #8: Convert local time to UTC for pyswisseph
    # Swiss Ephemeris requires UTC, but we have local time
    # For IST (UTC+5:30), we subtract 5.5 hours to get UTC
    from datetime import timedelta
    utc_dt = birth_dt - timedelta(hours=tz_offset)

    if legacy_full:
        if node_convention != 'true':
            raise ValueError('Explicit node selection is supported only by the primary chart engine')
        if jyotishganit is None:
            raise ValueError('jyotishganit is required for --legacy-full')
        return jyotishganit.calculate_birth_chart(
            birth_date=birth_dt, latitude=lat, longitude=lon,
            timezone_offset=tz_offset, name='User').to_dict()

    allow_legacy_fallback = os.getenv('KUNDLI_ALLOW_LEGACY_FALLBACK') == '1'
    if not _PYSWISSEPH_AVAILABLE and not allow_legacy_fallback:
        raise ValueError('Primary Swiss Ephemeris dependency unavailable; rebuild with pyswisseph installed')

    # ✅ NEW: Try pyswisseph first (100% FREE, 100% ACCURATE)
    # Fall back to jyotishganit if pyswisseph unavailable
    using_pyswisseph = False
    pyswisseph_data = None
    ephemeris_info = "jyotishganit (fallback)"

    if _PYSWISSEPH_AVAILABLE:
        try:
            # 🔥 FIX: Pass utc_dt instead of birth_dt to pyswisseph!
            # This ensures planetary positions are calculated for the correct UTC time
            from reading import verified_positions
            def validate_natal(value):
                verified_positions({'calculation_source': 'pyswisseph', **value})
                moon = next(p for p in value['planet_positions'] if p['name'] == 'Moon')
                if moon['sidereal_degree'] != value['moon_sidereal_degree']:
                    raise ValueError('Conflicting cached Moon longitude')
                for field in ('lagna_degree', 'moon_degree'):
                    degree = value[field]
                    if type(degree) not in (int, float) or not math.isfinite(degree) or not 0 <= degree < 30:
                        raise ValueError('Invalid cached sign degree')
                if not math.isclose(value['moon_degree'], moon['sidereal_degree'] % 30, abs_tol=1e-9):
                    raise ValueError('Conflicting cached Moon degree')
                if (value['node_convention'] != node_convention or value['ayanamsa_used'] != 'LAHIRI'
                        or type(value['ayanamsa_degree']) not in (int, float)
                        or not math.isfinite(value['ayanamsa_degree'])):
                    raise ValueError('Conflicting cached calculation settings')
                star, start = get_nakshatra_from_degree(moon['sidereal_degree'])
                if value['moon_nakshatra'] != star or value['moon_pada'] != calculate_pada(moon['sidereal_degree'], start):
                    raise ValueError('Conflicting cached Moon nakshatra')
            ephe_dir = Path(SCRIPT_DIR) / 'ephe'
            ephe_revision = [(p.name, p.stat().st_size, p.stat().st_mtime_ns)
                             for p in sorted(ephe_dir.glob('*.se1'))] if ephe_dir.exists() else []
            revision = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
            pyswisseph_data = cached_natal(
                {'utc': utc_dt.isoformat(), 'lat': lat, 'lon': lon, 'node': node_convention,
                 'ayanamsa': 'LAHIRI', 'houses': 'whole_sign', 'revision': revision,
                 'engine': str(getattr(swe, 'version', 'unknown')), 'ephemeris': ephe_revision},
                lambda: calculate_kundli_pyswisseph(utc_dt, lat, lon, node_convention=node_convention),
                validate_natal)
            using_pyswisseph = True
            ephemeris_info = "pyswisseph (FREE Swiss Ephemeris) - Primary"
        except Exception as e:
            if not allow_legacy_fallback:
                raise ValueError('Primary Swiss Ephemeris calculation failed; no chart was substituted') from e
            ephemeris_info = f"jyotishganit (fallback - pyswisseph error: {str(e)[:50]})"

    if using_pyswisseph:
        period = current_period(utc_dt, pyswisseph_data['moon_sidereal_degree'],
                                datetime.now(timezone.utc).replace(tzinfo=None))
        # Full and compact output must share one engine. Do not attach raw
        # jyotishganit placements or dashas to a Swiss Ephemeris summary.
        chart_data = {
            'planet_positions': pyswisseph_data['planet_positions'],
            'ayanamsa': {'name': 'LAHIRI', 'value': pyswisseph_data['ayanamsa_degree']},
            'dashas': {'year_days': period['year_days'], 'current': {'mahadashas': {
                period['mahadasha']: {
                    'start': period['start'], 'end': period['end'],
                    'antardashas': {period['antardasha']: {
                        'start': period['antardasha_start'], 'end': period['antardasha_end']}}
                }}}},
            'calculation_source': 'pyswisseph',
        }
    else:
        if node_convention != 'true':
            raise ValueError('Legacy fallback cannot honor the requested node convention')
        if jyotishganit is None:
            raise ValueError(f"No working chart engine: {ephemeris_info}; jyotishganit unavailable")
        chart = jyotishganit.calculate_birth_chart(
            birth_date=birth_dt, latitude=lat, longitude=lon,
            timezone_offset=tz_offset, name="User")
        chart_data = chart.to_dict()

    # ADD FLATTENED SUMMARY FOR AI (CRITICAL FOR ACCURACY)
    try:
        # ✅ NEW: Use pyswisseph Lagna if available (100% accurate)
        if using_pyswisseph and pyswisseph_data:
            lagna = pyswisseph_data.get('lagna')
            # Also use pyswisseph Moon data
            moon_sign = pyswisseph_data.get('moon_sign')
            moon_degree = pyswisseph_data.get('moon_degree', 0)
            moon_nakshatra = pyswisseph_data.get('moon_nakshatra')
            moon_pada = pyswisseph_data.get('moon_pada')
        else:
            # ✅ FIX 4: Prefer chart.ascendant if available (more reliable)
            if hasattr(chart, 'ascendant') and chart.ascendant:
                # Note: jyotishganit doesn't provide degree in ascendant object, only sign
                lagna = chart.ascendant.sign if hasattr(chart.ascendant, 'sign') else chart.ascendant.to_dict().get('sign')
            else:
                # Fallback: Find House 1 by number, NOT by index (houses may be unordered!)
                lagna_house = next((h for h in chart.d1_chart.houses if h.to_dict().get('number') == 1), None)
                lagna = lagna_house.to_dict().get('sign') if lagna_house else None

            # ✅ FIX 2: Case-insensitive moon extraction (some libraries use "MOON" or "moon")
            # Fallback to jyotishganit for Moon
            moon_planet = next(
                (p for p in chart.d1_chart.planets if p.celestial_body.lower() == 'moon'),
                None
            )
            if not moon_planet:
                raise ValueError("Moon planet not found in chart data")

            # ✅ FIX 5: Validate Moon degree (CRITICAL for boundary cases)
            moon_data = moon_planet.to_dict()

            # ✅ FIX: Check multiple possible degree keys before falling back
            # jyotishganit uses 'signDegrees', 'degree', 'normDegree', 'longitude_in_sign', etc.
            moon_degree = moon_data.get('signDegrees',
                          moon_data.get('degree',
                            moon_data.get('normDegree',
                              moon_data.get('longitude_in_sign',
                                moon_data.get('longitude', None)))))

            # ✅ CRITICAL: If degree is None or exactly 0.0, this is likely a missing value
            # Moon at exactly 0.00° is astronomically rare and usually indicates a data error
            if moon_degree is None:
                raise ValueError(f"Moon degree not found in planet data. Available keys: {list(moon_data.keys())}")

            if not (0 <= moon_degree < 30):
                raise ValueError(f"Invalid Moon degree: {moon_degree}. Must be between 0-30. Chart calculation may be incorrect.")

            moon_sign = moon_data.get('sign')
            # CRITICAL: Always use the Moon's own nakshatra, NOT panchanga or any other planet
            moon_nakshatra = moon_data.get('nakshatra')
            # Fall back to panchanga only if Moon nakshatra unavailable
            if not moon_nakshatra:
                moon_nakshatra = chart.panchanga.nakshatra
            moon_pada = moon_data.get('pada')

        # ✅ FIX 6 & 7: Initialize confidence and warnings BEFORE using them
        if lagna not in SIGNS or moon_sign not in SIGNS or not moon_nakshatra:
            raise ValueError('Incomplete chart summary: valid Lagna, Moon sign and nakshatra are required')
        confidence = "high"
        warnings = []
        was_corrected = False  # Initialize to avoid undefined variable

        # ✅ NEW: Add ephemeris info to warnings for transparency
        if using_pyswisseph:
            warnings.append(f"Using pyswisseph with date-specific Lahiri ayanamsa")
            confidence = "high"  # pyswisseph is always high confidence
        else:
            warnings.append(f"Using jyotishganit (fallback) - pyswisseph unavailable or failed")
            if not _PYSWISSEPH_AVAILABLE:
                warnings.append('Primary ephemeris unavailable; explicitly enabled legacy fallback uses independent conventions')

            # ✅ FIX 1: Validate and correct BOTH nakshatra AND pada based on degree (CRITICAL)
            # Only for jyotishganit (pyswisseph is already 100% accurate)
            moon_nakshatra, moon_pada, was_corrected = validate_or_correct_nakshatra(moon_sign, moon_degree, moon_nakshatra, moon_pada)
            if was_corrected:
                warnings.append(f"Library error detected. Corrected to '{moon_nakshatra} Pada {moon_pada}' based on Moon's actual position ({moon_degree:.2f}° in {moon_sign}).")
                if confidence == "high":
                    confidence = "medium"

        # Check if Moon is near sign boundary (within 1 degree)
        if moon_degree > 29.0 or moon_degree < 1.0:
            warnings.append(f"Moon is at {moon_degree:.2f}° in {moon_sign}, near a sign boundary. Verify uncertain birth inputs before relying on this placement.")
            confidence = "medium"

        # Derive boundary proximity from longitude, not a hand-written star list.
        moon_longitude = SIGNS.index(moon_sign) * 30 + moon_degree
        star_fraction = moon_longitude % (360 / 27)
        if min(star_fraction, 360 / 27 - star_fraction) < 0.05:
            warnings.append('Moon is near a nakshatra boundary; verify uncertain birth inputs.')
            confidence = 'medium'

        # ✅ FIX: Validate planet positions (Mercury, Mars, Sun)
        # Skip validation if using pyswisseph (already 100% accurate)
        if not using_pyswisseph:
            planet_validation_errors = validate_planet_positions(chart_data)
            if planet_validation_errors:
                warnings.extend(planet_validation_errors)
                confidence = "low"

        # Rashi mapping for AI prompts (HINDI_RASHI is defined at top level)
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
        # ✅ NEW: Use pyswisseph data if available for more accurate planet positions
        if using_pyswisseph and pyswisseph_data:
            # Use pyswisseph planet positions (100% accurate with house numbers)
            planet_positions = pyswisseph_data.get('planet_positions', [])
            planets_summary = []
            for planet_data in planet_positions:
                planet_name = planet_data.get('name')
                sign = planet_data.get('sign')
                house = planet_data.get('house')
                sign_hindi = HINDI_RASHI.get(sign, sign)
                # ⚠️ Remove degree symbol to avoid shell syntax errors when AI copies this to command line
                planets_summary.append(f"{planet_name} is in House {house} ({sign}/{sign_hindi})")
        else:
            # Read the complete library planet collection, not a possibly absent
            # serialized d1Chart.planets field (some versions nest occupants).
            planets_summary = []
            
            # Loop through planets directly instead of relying on jyotishganit's house arrays
            fallback_planets = [planet.to_dict() for planet in chart.d1_chart.planets]
            names = {p.get('celestialBody', '').lower() for p in fallback_planets}
            if len(fallback_planets) != 9 or names != {name.lower() for name in PYSWISSEPH_PLANETS} | {'ketu'}:
                raise ValueError('Incomplete fallback chart: all nine planets are required')
            for p in fallback_planets:
                p_name = p.get('celestialBody')
                p_sign = p.get('sign')
                if p_sign not in SIGNS:
                    raise ValueError(f'Invalid sign for {p_name}')

                # Force Whole Sign House calculation!
                h_num = get_house_from_sign(p_sign, lagna)
                p_sign_hindi = HINDI_RASHI.get(p_sign, p_sign)

                # ⚠️ Remove degree symbol to avoid shell syntax errors when AI copies this to command line
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
                "ephemeris": ephemeris_info,  # ✅ NEW: Indicate which ephemeris was used
            },
            "ai_summary": {
                "rashi_info": f"Rashi (Moon Sign): {moon_sign} (Hindi: {moon_hindi}). Lagna (Ascendant): {lagna} (Hindi: {lagna_hindi}). Nakshatra: {moon_nakshatra} Pada {moon_pada}.",
                "dasha_info": dasha_str,
                "planet_positions": planets_summary,
                "instructions_for_ai": 'Use calculated facts only. Dasha dates are period boundaries, not event forecasts. Image rendering requires all nine planet positions.'
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
        raise ValueError(f"Could not build chart summary: {e}") from e

    # Add metadata
    final_output["user_input"] = {
        "birth_utc": utc_dt.isoformat() + 'Z',
        "dob": dob_str,
        "tob": tob_str,
        "place": place,
        "coordinates": {"lat": lat, "lon": lon},
        "timezone_offset": tz_offset,
        "ephemeris_used": ephemeris_info,
        "pyswisseph_available": _PYSWISSEPH_AVAILABLE
    }
    if using_pyswisseph:
        final_output['calculation_settings'] = {
            'ayanamsa': 'LAHIRI', 'house_system': 'whole_sign',
            'node': node_convention, 'dasha_year_days': period['year_days'],
            'engine': 'pyswisseph',
        }

    # ✅ NEW: Add helpful note if pyswisseph is not available
    if not _PYSWISSEPH_AVAILABLE:
        final_output["user_input"]["note"] = 'Legacy fallback explicitly enabled; primary Swiss Ephemeris unavailable'

    # ✅ FIX #3: No silent fallback warning anymore - we fail loudly instead
    # If we reach here, coordinates are valid

    if using_pyswisseph and include_supplemental:
        # Preserve access to legacy extended calculations without presenting
        # their different conventions as part of the primary chart.
        final_output['supplemental_note'] = (
            'Supplemental jyotishganit data uses independent conventions. '
            'Do not combine its placements or dashas with the primary chart.')
        try:
            if jyotishganit is None:
                raise ValueError('jyotishganit unavailable')
            supplemental = jyotishganit.calculate_birth_chart(
                birth_date=birth_dt, latitude=lat, longitude=lon,
                timezone_offset=tz_offset, name='User')
            final_output['supplemental_jyotishganit'] = supplemental.to_dict()
            # Additive compatibility for established raw readers. Primary fields
            # always win; each legacy alias is explicitly attributed to its engine.
            legacy_fields = {}
            for key, value in final_output['supplemental_jyotishganit'].items():
                if key not in final_output:
                    final_output[key] = value
                    legacy_fields[key] = 'jyotishganit'
            final_output['field_sources'] = {
                'summary': 'pyswisseph', 'ai_summary': 'pyswisseph',
                'planet_positions': 'pyswisseph', 'dashas': 'pyswisseph',
                'ayanamsa': 'pyswisseph', **legacy_fields,
            }
        except Exception as e:
            final_output['supplemental_error'] = str(e)
    return final_output


# =============================================================================
# KUNDLI IMAGE STORAGE TO MONGODB GRIDFS
# =============================================================================

def store_kundli_image_to_mongodb(
    image_base64: str,
    user_id: str,
    birth_details: dict,
    kundli_data: dict,
    session_id: str = None,
    chart_type: str = "north_indian",
    format: str = "png"
) -> dict | None:
    """
    Upload Kundli chart image to MongoDB GridFS via mongo_logger service.

    This function is completely optional - if mongo_logger is unavailable,
    it logs a warning and returns None without failing.

    Args:
        image_base64: Base64-encoded image data (with or without data:image/... prefix)
        user_id: User's WhatsApp number (e.g., "+919760347653")
        birth_details: Dict with date, time, place, lat, lon
        kundli_data: Dict with lagna, moon_sign, nakshatra, etc.
        session_id: Optional session ID for linking to conversation
        chart_type: Type of chart ("north_indian", "south_indian", etc.)
        format: Image format ("png", "jpg", etc.)

    Returns:
        dict with fileId and filename if successful, None if failed
    """
    import requests

    # 🔧 Load .env manually if OpenClaw hasn't passed it into the subprocess
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    if k not in os.environ:
                        os.environ[k] = v.strip('"\'')

    # Get mongo logger URL from environment
    mongo_logger_url = os.getenv("MONGO_LOGGER_URL", "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com")
    upload_url = f"{mongo_logger_url}/kundli-image"

    # Prepare payload
    payload = {
        "userId": user_id,
        "sessionId": session_id or f"whatsapp:{user_id}",
        "birthDetails": birth_details,
        "kundliData": kundli_data,
        "imageBase64": image_base64,
        "chartType": chart_type,
        "format": format
    }

    try:
        response = requests.post(upload_url, json=payload, timeout=30)

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Kundli image stored to MongoDB: file_id={result.get('fileId')}", file=sys.stderr)
            return result
        else:
            print(f"⚠️  Failed to store Kundli image: HTTP {response.status_code}", file=sys.stderr)
            return None

    except requests.exceptions.ConnectionError:
        print(f"⚠️  MongoDB logger not available at {mongo_logger_url}", file=sys.stderr)
        print(f"   Kundli image not stored (continuing without storage)", file=sys.stderr)
        return None
    except Exception as e:
        print(f"⚠️  Error storing Kundli image to MongoDB: {e}", file=sys.stderr)
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Acharya Sharma Kundli Engine')
    parser.add_argument('--dob', required=True, help='Date of Birth (YYYY-MM-DD, DD Month YYYY, etc.)')
    parser.add_argument('--tob', required=True, help='Time of Birth (HH:MM or HH:MM AM/PM)')
    parser.add_argument('--place', required=True, help='Place of Birth')
    parser.add_argument('--full', action='store_true', help='Return full raw data (warning: 7000+ lines)')
    parser.add_argument('--legacy-full', action='store_true',
                        help='Return the complete original jyotishganit raw schema from one engine')
    parser.add_argument('--reading-topic', choices=['career', 'education', 'marriage', 'separation'],
                        help='Return a compact verified topic reading, not raw chart data')
    parser.add_argument('--render-reading', action='store_true',
                        help='Render the topic reading from reviewed rules without an LLM')
    parser.add_argument('--reading-language', choices=['english', 'hinglish'], default='english')
    parser.add_argument('--reading-intent', choices=['overview', 'timing'], default='overview')
    parser.add_argument('--node-convention', choices=['true', 'mean'], default='true',
                        help='Lunar node convention (existing default: true)')
    parser.add_argument('--latitude', type=float, help='Confirmed birthplace latitude')
    parser.add_argument('--longitude', type=float, help='Confirmed birthplace longitude')
    parser.add_argument('--utc-offset', type=float, help='Explicit confirmed birth UTC offset in hours; resolves DST ambiguity')
    
    args = parser.parse_args()
    
    try:
        if args.render_reading and not args.reading_topic:
            raise ValueError('--render-reading requires --reading-topic')
        if args.reading_topic and (args.full or args.legacy_full):
            raise ValueError('--reading-topic cannot be combined with full output modes')
        output = calculate_kundli(args.dob, args.tob, args.place,
                                 include_supplemental=args.full,
                                 legacy_full=args.legacy_full,
                                 node_convention=args.node_convention, latitude=args.latitude,
                                 longitude=args.longitude, utc_offset=args.utc_offset)

        # If not full mode, trim the output to essentials to prevent LLM confusion
        if args.reading_topic:
            if args.reading_topic == 'separation':
                from separation import render_separation
                output = render_separation(output, language=args.reading_language, intent=args.reading_intent)
                if not args.render_reading:
                    output = output['evidence']
            elif args.render_reading:
                from render_reading import render_reading
                output = render_reading(output, args.reading_topic,
                                        language=args.reading_language, intent=args.reading_intent)
            else:
                from reading import reading_packet
                output = reading_packet(output, args.reading_topic)
        elif not args.full and not args.legacy_full:
            trimmed = {
                "summary": output.get("summary"),
                "ai_summary": output.get("ai_summary"),
                "lagna": output.get("lagna"),
                "moon_sign": output.get("moon_sign"),
                "nakshatra": output.get("nakshatra"),
                "user_input": output.get("user_input"),
                "calculation_settings": output.get("calculation_settings"),
                "note": "Raw planet/dasha data hidden. Run with --full if you need specific degrees or full dasha tables."
            }
            output = trimmed
            
        print(json.dumps(output, **({'separators': (',', ':')} if args.reading_topic else {'indent': 2}),
                         default=lambda x: str(x)))
    except Exception as e:
        import traceback
        error_info = {
            "status": "error", 
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))
        sys.exit(1)
