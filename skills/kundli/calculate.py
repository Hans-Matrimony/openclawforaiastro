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

def get_coordinates(place):
    # Try local fallback first (case-insensitive)
    try:
        with open(CITIES_FILE, 'r') as f:
            cities = json.load(f)
            # Case-insensitive lookup
            place_lower = place.strip().lower()
            for city_name, coords in cities.items():
                if city_name.lower() == place_lower:
                    return coords[0], coords[1], False
    except:
        pass

    # Try live geocoding
    try:
        geolocator = Nominatim(user_agent="acharya_sharma_astro")
        location = geolocator.geocode(place + ", India")
        if location:
            return location.latitude, location.longitude, False
    except:
        pass
    
    # Default to Delhi if all fails — but flag it
    return 28.6139, 77.2090, True


def get_timezone_offset(lat, lon):
    """Detect timezone offset from coordinates. Falls back to IST (5.5)."""
    if _TZ_FINDER is None:
        return 5.5  # Fallback to IST if timezonefinder not installed
    try:
        tz_name = _TZ_FINDER.timezone_at(lat=lat, lng=lon)
        if tz_name:
            from datetime import timezone as _tz
            tz = ZoneInfo(tz_name)
            # Use a reference datetime to get UTC offset
            ref_dt = datetime(2000, 6, 15, 12, 0, 0, tzinfo=tz)
            offset_seconds = ref_dt.utcoffset().total_seconds()
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

def calculate_kundli(dob_str, tob_str, place):
    lat, lon, used_fallback = get_coordinates(place)
    
    # Parse date and time into a single datetime object
    birth_time = parse_time(tob_str)
    birth_date = parse_date(dob_str)
    birth_dt = datetime.combine(birth_date, birth_time)
    
    # Detect timezone from coordinates (falls back to IST if unavailable)
    tz_offset = get_timezone_offset(lat, lon)
    
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
        # ✅ FIX 1: Find House 1 by number, NOT by index (houses may be unordered!)
        lagna_house = next((h for h in chart.d1_chart.houses if h.to_dict().get('number') == 1), None)
        lagna = lagna_house.to_dict().get('sign') if lagna_house else None

        # ✅ FIX 2: Case-insensitive moon extraction (some libraries use "MOON" or "moon")
        moon_planet = next(
            (p for p in chart.d1_chart.planets if p.celestial_body.lower() == 'moon'),
            None
        )
        if not moon_planet:
            raise ValueError("Moon planet not found in chart data")
        moon_sign = moon_planet.to_dict().get('sign')
        # CRITICAL: Always use the Moon's own nakshatra, NOT panchanga or any other planet
        moon_nakshatra = moon_planet.to_dict().get('nakshatra')
        # Fall back to panchanga only if Moon nakshatra unavailable
        if not moon_nakshatra:
            moon_nakshatra = chart.panchanga.nakshatra
        moon_pada = moon_planet.to_dict().get('pada')
            
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
                "current_dasha": dasha_str
            },
            "ai_summary": {
                "rashi_info": f"Rashi (Moon Sign): {moon_sign} ({moon_hindi}). Lagna (Ascendant): {lagna} ({lagna_hindi}). Nakshatra: {moon_nakshatra} Pada {moon_pada}.",
                "dasha_info": dasha_str,
                "planet_positions": planets_summary,
                "instructions_for_ai": f"SYSTEM INSTRUCTION: DO NOT GUESS ZODIAC SIGNS! You MUST reply saying their Rashi is exactly what is written in rashi_info above ({moon_sign}/{moon_hindi}). If you state any other Rashi, you are hallucinating Western astrology dates and will be penalized. Look at dasha_info for timing predictions."
            }
        }
        
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
    
    if used_fallback:
        final_output["warning"] = f"Could not find coordinates for '{place}'. Defaulted to Delhi (28.61, 77.21). Results may be inaccurate. Please verify the city name."
    
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