#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Western Natal Chart Calculator
Calculates Western astrology natal chart positions

Uses Swiss Ephemeris for accurate planetary positions
Focus: Tropical zodiac (not Sidereal), Placidus houses
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from math import floor

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None

try:
    from timezonefinder import TimezoneFinder
    _TIMEZONE_FINDER = TimezoneFinder()
except ImportError:
    _TIMEZONE_FINDER = None

try:
    from geopy.geocoders import Nominatim
except ImportError:
    Nominatim = None

# Script directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Try to import Swiss Ephemeris
_PYSWISSEPH_AVAILABLE = False
try:
    import swisseph as swe
    _PYSWISSEPH_AVAILABLE = True
except ImportError:
    try:
        import subprocess
        subprocess.check_call([
            sys.executable, "-m", "pip", "install",
            "--break-system-packages", "-q",
            "pyswisseph"
        ], stderr=subprocess.DEVNULL)
        import swisseph as swe
        _PYSWISSEPH_AVAILABLE = True
    except:
        pass

# ============================================================================
# WESTERN ASTROLOGY DATA
# ============================================================================

# Zodiac signs (Tropical - Western)
ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

ZODIAC_DATES = [
    (3, 21, 4, 19),   # Aries
    (4, 20, 5, 20),   # Taurus
    (5, 21, 6, 20),   # Gemini
    (6, 21, 7, 22),   # Cancer
    (7, 23, 8, 22),   # Leo
    (8, 23, 9, 22),   # Virgo
    (9, 23, 10, 22),  # Libra
    (10, 23, 11, 21), # Scorpio
    (11, 22, 12, 21), # Sagittarius
    (12, 22, 1, 19),  # Capricorn
    (1, 20, 2, 18),   # Aquarius
    (2, 19, 3, 20),   # Pisces
]

PLANETS = {
    'Sun': 0,
    'Moon': 1,
    'Mercury': 2,
    'Venus': 3,
    'Mars': 4,
    'Jupiter': 5,
    'Saturn': 6,
    'Uranus': 7,
    'Neptune': 8,
    'Pluto': 9
}

PLANET_SYMBOLS = {
    'Sun': '☉',
    'Moon': '☽',
    'Mercury': '☿',
    'Venus': '♀',
    'Mars': '♂',
    'Jupiter': '♃',
    'Saturn': '♄',
    'Uranus': '♅',
    'Neptune': '♆',
    'Pluto': '♇'
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def degree_to_sign(degree: float) -> tuple:
    """
    Convert ecliptic longitude to zodiac sign

    Args:
        degree: Ecliptic longitude in degrees (0-360)

    Returns:
        (sign_name, position_in_sign)
    """
    sign_index = int(degree / 30) % 12
    position = degree % 30
    return ZODIAC_SIGNS[sign_index], position


def get_sun_sign_simple(month: int, day: int) -> str:
    """
    Get Sun sign from month and day (simple method)

    Args:
        month: Month (1-12)
        day: Day (1-31)

    Returns:
        Sun sign name
    """
    # Convert to 0-indexed month for easier comparison
    for i, (start_month, start_day, end_month, end_day) in enumerate(ZODIAC_DATES):
        if start_month == end_month:
            # Sign within single month (e.g., Jan 20 - Feb 18 for Aquarius)
            if month == start_month:
                if start_day <= day <= end_day:
                    return ZODIAC_SIGNS[i]
        else:
            # Sign spans two months
            if (month == start_month and day >= start_day) or \
               (month == end_month and day <= end_day):
                return ZODIAC_SIGNS[i]
    return "Unknown"


# ============================================================================
# CHART CALCULATION (Swiss Ephemeris)
# ============================================================================

def calculate_planet_positions(julian_day: float, lat: float, lon: float) -> dict:
    """
    Calculate planet positions using Swiss Ephemeris

    Args:
        julian_day: Julian day number
        lat: Latitude in degrees
        lon: Longitude in degrees

    Returns:
        dict with planet positions
    """
    positions = {}

    if not _PYSWISSEPH_AVAILABLE:
        # Fallback to simple calculation for Sun sign only
        return {"fallback": True, "note": "Swiss Ephemeris not available"}

    for planet_name, swe_id in PLANETS.items():
        try:
            # Calculate position
            xx, ret = swe.calc_ut(julian_day, swe_id)
            longitude = xx[0] % 360  # Normalize to 0-360

            sign, position = degree_to_sign(longitude)

            positions[planet_name] = {
                "longitude": round(longitude, 2),
                "sign": sign,
                "position_in_sign": round(position, 2),
                "symbol": PLANET_SYMBOLS.get(planet_name, "")
            }
        except Exception as e:
            positions[planet_name] = {"error": str(e)}

    return positions


def calculate_houses(julian_day: float, lat: float, lon: float) -> dict:
    """
    calculate house cusps using Placidus system

    Args:
        julian_day: Julian day number
        lat: Latitude in degrees
        lon: Longitude in degrees

    Returns:
        dict with house cusps
    """
    if not _PYSWISSEPH_AVAILABLE:
        return {"fallback": True, "note": "Swiss Ephemeris not available"}

    try:
        # Calculate houses (Placidus)
        cusps, asmc = swe.houses(julian_day, lat, lon, b'P')

        houses = {}
        for i in range(12):
            cusp_long = cusps[i] % 360
            sign, position = degree_to_sign(cusp_long)
            houses[i + 1] = {
                "cusp": round(cusp_long, 2),
                "sign": sign,
                "position_in_sign": round(position, 2)
            }

        # Ascendant and Midheaven
        ascendant = degree_to_sign(asmc[0] % 360)
        midheaven = degree_to_sign(asmc[1] % 360)

        return {
            "houses": houses,
            "ascendant": {
                "longitude": round(asmc[0] % 360, 2),
                "sign": ascendant[0],
                "position_in_sign": round(ascendant[1], 2)
            },
            "midheaven": {
                "longitude": round(asmc[1] % 360, 2),
                "sign": midheaven[0],
                "position_in_sign": round(midheaven[1], 2)
            }
        }
    except Exception as e:
        try:
            # Placidus can fail at extreme latitudes; Whole Sign is a stable fallback.
            cusps, asmc = swe.houses(julian_day, lat, lon, b'W')
            houses = {}
            for i in range(12):
                cusp_long = cusps[i] % 360
                sign, position = degree_to_sign(cusp_long)
                houses[i + 1] = {
                    "cusp": round(cusp_long, 2),
                    "sign": sign,
                    "position_in_sign": round(position, 2)
                }
            ascendant = degree_to_sign(asmc[0] % 360)
            midheaven = degree_to_sign(asmc[1] % 360)
            return {
                "houses": houses,
                "house_system": "Whole Sign fallback",
                "fallback_reason": str(e),
                "ascendant": {
                    "longitude": round(asmc[0] % 360, 2),
                    "sign": ascendant[0],
                    "position_in_sign": round(ascendant[1], 2)
                },
                "midheaven": {
                    "longitude": round(asmc[1] % 360, 2),
                    "sign": midheaven[0],
                    "position_in_sign": round(midheaven[1], 2)
                }
            }
        except Exception as fallback_error:
            return {"error": str(fallback_error), "fallback_reason": str(e)}


def calculate_aspects(positions: dict) -> list:
    """
    Calculate major aspects between planets

    Args:
        positions: dict of planet positions

    Returns:
        list of aspects
    """
    if not _PYSWISSEPH_AVAILABLE or "fallback" in positions:
        return []

    aspects = []
    aspect_types = {
        "conjunction": 0,
        "opposition": 180,
        "trine": 120,
        "square": 90,
        "sextile": 60
    }

    planet_names = [p for p in PLANETS.keys() if p in positions]

    for i, p1 in enumerate(planet_names):
        for p2 in planet_names[i + 1:]:
            if "error" in positions[p1] or "error" in positions[p2]:
                continue

            diff = abs(positions[p1]["longitude"] - positions[p2]["longitude"])
            if diff > 180:
                diff = 360 - diff

            for aspect_name, orb_limit in aspect_types.items():
                orb = 8  # 8 degree orb for major aspects
                if abs(diff - orb_limit) <= orb:
                    aspects.append({
                        "planet1": p1,
                        "planet2": p2,
                        "aspect": aspect_name,
                        "orb": round(abs(diff - orb_limit), 2)
                    })

    return aspects[:10]  # Return top 10 aspects


# ============================================================================
# GEOCODING
# ============================================================================

CITY_DATA = {
    "new york": (40.7128, -74.0060, "America/New_York"),
    "london": (51.5074, -0.1278, "Europe/London"),
    "los angeles": (34.0522, -118.2437, "America/Los_Angeles"),
    "chicago": (41.8781, -87.6298, "America/Chicago"),
    "houston": (29.7604, -95.3698, "America/Chicago"),
    "phoenix": (33.4484, -112.0740, "America/Phoenix"),
    "miami": (25.7617, -80.1918, "America/New_York"),
    "atlanta": (33.7490, -84.3880, "America/New_York"),
    "dallas": (32.7767, -96.7970, "America/Chicago"),
    "denver": (39.7392, -104.9903, "America/Denver"),
    "seattle": (47.6062, -122.3321, "America/Los_Angeles"),
    "san francisco": (37.7749, -122.4194, "America/Los_Angeles"),
    "boston": (42.3601, -71.0589, "America/New_York"),
    "washington dc": (38.9072, -77.0369, "America/New_York"),
    "toronto": (43.6532, -79.3832, "America/Toronto"),
    "vancouver": (49.2827, -123.1207, "America/Vancouver"),
    "sydney": (-33.8688, 151.2093, "Australia/Sydney"),
    "melbourne": (-37.8136, 144.9631, "Australia/Melbourne"),
    "dubai": (25.2048, 55.2708, "Asia/Dubai"),
    "abu dhabi": (24.4539, 54.3773, "Asia/Dubai"),
    "doha": (25.2854, 51.5310, "Asia/Qatar"),
    "riyadh": (24.7136, 46.6753, "Asia/Riyadh"),
    "jeddah": (21.5433, 39.1728, "Asia/Riyadh"),
    "paris": (48.8566, 2.3522, "Europe/Paris"),
    "berlin": (52.5200, 13.4050, "Europe/Berlin"),
    "rome": (41.9028, 12.4964, "Europe/Rome"),
    "madrid": (40.4168, -3.7038, "Europe/Madrid"),
    "amsterdam": (52.3676, 4.9041, "Europe/Amsterdam"),
    "brussels": (50.8503, 4.3517, "Europe/Brussels"),
    "zurich": (47.3769, 8.5417, "Europe/Zurich"),
    "vienna": (48.2082, 16.3738, "Europe/Vienna"),
    "stockholm": (59.3293, 18.0686, "Europe/Stockholm"),
    "oslo": (59.9139, 10.7522, "Europe/Oslo"),
    "copenhagen": (55.6761, 12.5683, "Europe/Copenhagen"),
    "helsinki": (60.1695, 24.9354, "Europe/Helsinki"),
    "munich": (48.1351, 11.5820, "Europe/Berlin"),
    "frankfurt": (50.1109, 8.6821, "Europe/Berlin"),
    "barcelona": (41.3851, 2.1734, "Europe/Madrid"),
    "lisbon": (38.7223, -9.1393, "Europe/Lisbon"),
}


def geocode_place_details(place_name: str) -> tuple:
    """
    Return latitude, longitude, timezone name, and source for a place.

    The local city map keeps common Western markets deterministic. If geopy is
    installed, it is used as a fallback for less common cities.
    """
    place_lower = place_name.lower().strip()
    if place_lower in CITY_DATA:
        lat, lon, tz_name = CITY_DATA[place_lower]
        return lat, lon, tz_name, "local"

    if Nominatim is not None:
        try:
            geolocator = Nominatim(user_agent="openclaw-western-astrology")
            location = geolocator.geocode(place_name, timeout=5)
            if location:
                tz_name = None
                if _TIMEZONE_FINDER is not None:
                    tz_name = _TIMEZONE_FINDER.timezone_at(
                        lat=location.latitude,
                        lng=location.longitude,
                    )
                return location.latitude, location.longitude, tz_name, "geopy"
        except Exception:
            pass

    return None, None, None, "missing"


def geocode_place(place_name: str) -> tuple:
    """Backwards-compatible lat/lon lookup."""
    lat, lon, _tz_name, _source = geocode_place_details(place_name)
    return lat, lon


def get_timezone_name(lat: float, lon: float, fallback_tz_name: str = None) -> str:
    if fallback_tz_name:
        return fallback_tz_name
    if _TIMEZONE_FINDER is None:
        return None
    try:
        return _TIMEZONE_FINDER.timezone_at(lat=lat, lng=lon)
    except Exception:
        return None


def nth_weekday(year: int, month: int, weekday: int, n: int) -> datetime:
    day = datetime(year, month, 1)
    offset = (weekday - day.weekday()) % 7
    return day + timedelta(days=offset + (n - 1) * 7)


def last_weekday(year: int, month: int, weekday: int) -> datetime:
    if month == 12:
        day = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        day = datetime(year, month + 1, 1) - timedelta(days=1)
    return day - timedelta(days=(day.weekday() - weekday) % 7)


def is_us_dst(local_dt: datetime) -> bool:
    start = nth_weekday(local_dt.year, 3, 6, 2).replace(hour=2)
    end = nth_weekday(local_dt.year, 11, 6, 1).replace(hour=2)
    return start <= local_dt < end


def is_eu_dst(local_dt: datetime) -> bool:
    start = last_weekday(local_dt.year, 3, 6).replace(hour=1)
    end = last_weekday(local_dt.year, 10, 6).replace(hour=1)
    return start <= local_dt < end


def is_aus_dst(local_dt: datetime) -> bool:
    start = nth_weekday(local_dt.year, 10, 6, 1).replace(hour=2)
    end = nth_weekday(local_dt.year, 4, 6, 1).replace(hour=3)
    return local_dt >= start or local_dt < end


def fallback_timezone_offset_hours(local_dt: datetime, tz_name: str) -> float:
    fixed_offsets = {
        "America/Phoenix": -7,
        "Asia/Dubai": 4,
        "Asia/Qatar": 3,
        "Asia/Riyadh": 3,
    }
    if tz_name in fixed_offsets:
        return float(fixed_offsets[tz_name])

    us_offsets = {
        "America/New_York": -5,
        "America/Toronto": -5,
        "America/Chicago": -6,
        "America/Denver": -7,
        "America/Los_Angeles": -8,
        "America/Vancouver": -8,
    }
    if tz_name in us_offsets:
        return float(us_offsets[tz_name] + (1 if is_us_dst(local_dt) else 0))

    eu_offsets = {
        "Europe/London": 0,
        "Europe/Paris": 1,
        "Europe/Berlin": 1,
        "Europe/Rome": 1,
        "Europe/Madrid": 1,
        "Europe/Amsterdam": 1,
        "Europe/Brussels": 1,
        "Europe/Zurich": 1,
        "Europe/Vienna": 1,
        "Europe/Stockholm": 1,
        "Europe/Oslo": 1,
        "Europe/Copenhagen": 1,
        "Europe/Helsinki": 2,
        "Europe/Lisbon": 0,
    }
    if tz_name in eu_offsets:
        return float(eu_offsets[tz_name] + (1 if is_eu_dst(local_dt) else 0))

    aus_offsets = {
        "Australia/Sydney": 10,
        "Australia/Melbourne": 10,
    }
    if tz_name in aus_offsets:
        return float(aus_offsets[tz_name] + (1 if is_aus_dst(local_dt) else 0))

    return 0.0


def get_timezone_offset_hours(local_dt: datetime, tz_name: str) -> float:
    if not tz_name or ZoneInfo is None:
        return fallback_timezone_offset_hours(local_dt, tz_name)
    try:
        aware_dt = local_dt.replace(tzinfo=ZoneInfo(tz_name))
        offset = aware_dt.utcoffset()
        if offset is None:
            return fallback_timezone_offset_hours(local_dt, tz_name)
        return offset.total_seconds() / 3600.0
    except Exception:
        return fallback_timezone_offset_hours(local_dt, tz_name)


# ============================================================================
# MAIN CHART FUNCTION
# ============================================================================

def calculate_natal_chart(dob: str, tob: str, place: str) -> dict:
    """
    Calculate complete Western natal chart

    Args:
        dob: Date of birth (YYYY-MM-DD)
        tob: Time of birth (HH:MM)
        place: Birth place

    Returns:
        Complete natal chart dict
    """
    try:
        # Parse date and time
        dt = datetime.strptime(f"{dob} {tob}", "%Y-%m-%d %H:%M")
    except ValueError:
        return {"error": "Invalid date/time format. Use YYYY-MM-DD and HH:MM"}

    warnings = []

    # Get coordinates and timezone
    lat, lon, tz_name, geocode_source = geocode_place_details(place)
    if lat is None:
        return {"error": f"Place '{place}' not found. Try a major city."}

    tz_name = get_timezone_name(lat, lon, tz_name)
    timezone_offset = get_timezone_offset_hours(dt, tz_name)
    if not tz_name:
        warnings.append("Timezone not detected; chart used UTC fallback for planetary calculations.")
    utc_dt = dt - timedelta(hours=timezone_offset)

    # Convert local birth time to UTC before Julian day, matching Vedic calculator behavior.
    try:
        if _PYSWISSEPH_AVAILABLE:
            julian_day = swe.julday(
                utc_dt.year,
                utc_dt.month,
                utc_dt.day,
                utc_dt.hour + utc_dt.minute / 60.0
            )
        else:
            julian_day = None
    except Exception as e:
        return {"error": f"Julian day calculation failed: {e}"}

    # Calculate chart components
    result = {
        "birth_data": {
            "date": dob,
            "time": tob,
            "place": place,
            "coordinates": {"lat": lat, "lon": lon},
            "timezone": tz_name,
            "timezone_offset_hours": timezone_offset,
            "utc_datetime": utc_dt.isoformat(timespec="minutes"),
            "geocode_source": geocode_source
        },
        "warnings": warnings
    }

    # Simple Sun sign (always available)
    try:
        sun_sign = get_sun_sign_simple(dt.month, dt.day)
        result["sun_sign"] = sun_sign
    except:
        result["sun_sign"] = "Unknown"

    # Full chart calculations
    if julian_day and _PYSWISSEPH_AVAILABLE:
        # Planet positions
        positions = calculate_planet_positions(julian_day, lat, lon)
        result["planets"] = positions

        # Houses
        houses_data = calculate_houses(julian_day, lat, lon)
        result["houses"] = houses_data
        if "fallback_reason" in houses_data:
            warnings.append("Placidus houses failed; Whole Sign fallback was used.")
        if "error" in houses_data:
            warnings.append(f"House calculation failed: {houses_data['error']}")

        # Aspects
        aspects = calculate_aspects(positions)
        result["aspects"] = aspects

        # Extract key info
        if "Sun" in positions:
            result["sun_sign"] = positions["Sun"]["sign"]
        if "Moon" in positions:
            result["moon_sign"] = positions["Moon"]["sign"]
        if "ascendant" in houses_data:
            result["ascendant"] = houses_data["ascendant"]["sign"]
    else:
        result["note"] = "Limited chart - Swiss Ephemeris not available"
        result["confidence"] = "low"
        warnings.append("Swiss Ephemeris not available; only simple Sun sign is reliable.")

    if "confidence" not in result:
        result["confidence"] = "high" if not warnings else "medium"

    return result


# ============================================================================
# FORMATTING OUTPUT
# ============================================================================

def format_chart_output(chart: dict) -> str:
    """Format chart data for human reading"""
    lines = []

    lines.append("=" * 50)
    lines.append("WESTERN NATAL CHART".center(50))
    lines.append("=" * 50)

    # Birth info
    bd = chart.get("birth_data", {})
    lines.append(f"\nBorn: {bd.get('date', 'Unknown')} at {bd.get('time', 'Unknown')}")
    lines.append(f"Place: {bd.get('place', 'Unknown')}")

    # Key signs
    lines.append("\n" + "-" * 50)
    lines.append("KEY PLACEMENTS")
    lines.append("-" * 50)
    lines.append(f"Sun Sign:    {chart.get('sun_sign', 'Unknown')}")
    lines.append(f"Moon Sign:   {chart.get('moon_sign', 'Unknown')}")
    lines.append(f"Ascendant:   {chart.get('ascendant', 'Unknown')}")

    # Planets
    if "planets" in chart and chart["planets"]:
        lines.append("\n" + "-" * 50)
        lines.append("PLANETARY POSITIONS")
        lines.append("-" * 50)

        for planet in ["Sun", "Moon", "Mercury", "Venus", "Mars",
                      "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]:
            if planet in chart["planets"]:
                p = chart["planets"][planet]
                if "error" not in p:
                    lines.append(f"{planet:10} {p['sign']:12} {p['position_in_sign']:>5.2f}°")

    # Houses
    if "houses" in chart and isinstance(chart["houses"], dict):
        if "houses" in chart["houses"]:
            lines.append("\n" + "-" * 50)
            lines.append("HOUSE CUSPS")
            lines.append("-" * 50)

            for i in range(1, 13):
                if i in chart["houses"]["houses"]:
                    h = chart["houses"]["houses"][i]
                    lines.append(f"House {i:2}:   {h['sign']:12}")

    # Aspects
    if "aspects" in chart and chart["aspects"]:
        lines.append("\n" + "-" * 50)
        lines.append("MAJOR ASPECTS")
        lines.append("-" * 50)

        for aspect in chart["aspects"][:10]:
            lines.append(f"{aspect['planet1']} {aspect['aspect']} {aspect['planet2']} "
                        f"(orb {aspect['orb']}°)")

    lines.append("\n" + "=" * 50)

    return "\n".join(lines)


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Calculate Western Natal Chart'
    )

    parser.add_argument('--dob', required=True, help='Date of birth (YYYY-MM-DD)')
    parser.add_argument('--tob', required=True, help='Time of birth (HH:MM)')
    parser.add_argument('--place', required=True, help='Birth place (city name)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--test', action='store_true', help='Run test calculation')

    args = parser.parse_args()

    if args.test:
        # Test with known data
        print("Test calculation...", file=sys.stderr)
        chart = calculate_natal_chart("1990-08-15", "14:30", "New York")
        print(json.dumps(chart, indent=2))
        return

    chart = calculate_natal_chart(args.dob, args.tob, args.place)

    if "error" in chart:
        print(f"Error: {chart['error']}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(chart, indent=2))
    else:
        print(format_chart_output(chart))


if __name__ == "__main__":
    # Fix Windows encoding
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    main()
