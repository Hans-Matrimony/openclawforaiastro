import sys
import os
import json
import argparse
from datetime import datetime, timedelta
from geopy.geocoders import Nominatim
import jyotishganit

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

def parse_time(tob_str):
    """Parse time string in various formats (12-hour with AM/PM or 24-hour)."""
    tob_str = tob_str.strip()
    
    # Try 12-hour format with AM/PM (e.g., "09:50 AM", "9:50 PM", "09:50AM")
    for fmt in ["%I:%M %p", "%I:%M%p", "%I:%M:%S %p", "%I:%M:%S%p"]:
        try:
            return datetime.strptime(tob_str, fmt).time()
        except ValueError:
            continue
    
    # Try 24-hour format (e.g., "09:50", "21:30", "9:50")
    for fmt in ["%H:%M", "%H:%M:%S"]:
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
    birth_date = datetime.strptime(dob_str, "%Y-%m-%d")
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
        # Saturn or other planets in House 1 may have a different nakshatra (e.g. Rohini)
        # which must NOT be confused with the Moon's birth star (Janma Nakshatra)
        moon_nakshatra = moon_planet.to_dict().get('nakshatra')
        # Fall back to panchanga only if Moon nakshatra unavailable
        if not moon_nakshatra:
            moon_nakshatra = chart.panchanga.nakshatra
        
        chart_data["summary"] = {
            "lagna": str(lagna),
            "moon_sign": str(moon_sign),
            "nakshatra": str(moon_nakshatra),  # MOON's Nakshatra (Janma Nakshatra)
            "nakshatra_note": "This is the Moon's Nakshatra (Janma Nakshatra/birth star). Not Saturn or any other planet.",
            "current_dasha": "Vimshottari Dasha is active. Check full 'dashas' field for timings."
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
    parser.add_argument('--dob', required=True, help='Date of Birth (YYYY-MM-DD)')
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