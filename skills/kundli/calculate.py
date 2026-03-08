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

def calculate_kundli(dob_str, tob_str, place):
    lat, lon = get_coordinates(place)
    
    # Parse date and time into a single datetime object
    birth_dt = datetime.strptime(f"{dob_str} {tob_str}", "%Y-%m-%d %H:%M")
    
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
    parser.add_argument('--tob', required=True, help='Time of Birth (HH:MM)')
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
