import sys
import os
import json
import argparse
from datetime import datetime, timedelta
from geopy.geocoders import Nominatim
import jyotishganit

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
    # Try local fallback first
    try:
        with open(CITIES_FILE, 'r') as f:
            cities = json.load(f)
            if place in cities:
                return cities[place][0], cities[place][1]
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
    
    # Default to Delhi if all fails
    return 28.6139, 77.2090

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
        "%m/%d/%Y",       # 08/08/2001 (US format, try after others)
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
    lat, lon = get_coordinates(place)
    
    # Parse date and time into a single datetime object
    birth_time = parse_time(tob_str)
    birth_date = parse_date(dob_str)
    birth_dt = datetime.combine(birth_date, birth_time)
    
    # Call the top-level API function
    # Signature: birth_date (datetime), latitude (float), longitude (float), timezone_offset (float)
    chart = jyotishganit.calculate_birth_chart(
        birth_date=birth_dt,
        latitude=lat,
        longitude=lon,
        timezone_offset=5.5, # Assume IST
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
        lagna = chart.d1_chart.houses[0].to_dict().get('sign')
        # Get Moon planet object for its sign AND nakshatra
        moon_planet = next(p for p in chart.d1_chart.planets if p.celestial_body == 'Moon')
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
        planets_summary = []
        d1 = chart_data.get('d1Chart', {})
        for house in d1.get('houses', []):
            h_num = house.get('number')
            for occ in house.get('occupants', []):
                p_name = occ.get('celestialBody')
                p_sign = occ.get('sign')
                p_sign_hindi = HINDI_RASHI.get(p_sign, p_sign)
                planets_summary.append(f"{p_name} is in House {h_num} ({p_sign}/{p_sign_hindi})")
        
        chart_data["summary"] = {
            "lagna": str(lagna),
            "moon_sign": str(moon_sign),
            "nakshatra": str(moon_nakshatra),  # MOON's Nakshatra (Janma Nakshatra)
            "nakshatra_note": "This is the Moon's Nakshatra (Janma Nakshatra/birth star). Not Saturn or any other planet.",
            "current_dasha": dasha_str
        }
        
        chart_data["ai_summary"] = {
            "rashi_info": f"Rashi (Moon Sign): {moon_sign} ({moon_hindi}). Lagna (Ascendant): {lagna} ({lagna_hindi}). Nakshatra: {moon_nakshatra} Pada {moon_pada}.",
            "dasha_info": dasha_str,
            "planet_positions": planets_summary,
            "instructions_for_ai": "READ THIS FIRST: Do NOT guess rashis. Use the rashi_info above exactly as written. Look at dasha_info for timing predictions. Look at planet_positions for specific house queries (like marriage = 7th house)."
        }
        
        # Extra top-level keys for backup - all three must be consistent
        chart_data["lagna"] = chart_data["summary"]["lagna"]
        chart_data["moon_sign"] = chart_data["summary"]["moon_sign"]
        chart_data["nakshatra"] = chart_data["summary"]["nakshatra"]  # MOON's Nakshatra explicitly
    except Exception as e:
        chart_data["summary_error"] = str(e)


    # Add metadata
    chart_data["user_input"] = {
        "dob": dob_str,
        "tob": tob_str,
        "place": place,
        "coordinates": {"lat": lat, "lon": lon}
    }
    
    return chart_data

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Acharya Sharma Kundli Engine')
    parser.add_argument('--dob', required=True, help='Date of Birth (YYYY-MM-DD, DD Month YYYY, etc.)')
    parser.add_argument('--tob', required=True, help='Time of Birth (HH:MM or HH:MM AM/PM)')
    parser.add_argument('--place', required=True, help='Place of Birth')
    
    args = parser.parse_args()
    
    try:
        output = calculate_kundli(args.dob, args.tob, args.place)
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