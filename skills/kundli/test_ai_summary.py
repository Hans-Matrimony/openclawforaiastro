import jyotishganit
import json
from datetime import datetime

# Rashi and Lagna Hindi mapping
HINDI_RASHI = {
    "Aries": "Mesh", "Taurus": "Vrishabh", "Gemini": "Mithun", "Cancer": "Kark",
    "Leo": "Singh", "Virgo": "Kanya", "Libra": "Tula", "Scorpio": "Vrishchik",
    "Sagittarius": "Dhanu", "Capricorn": "Makar", "Aquarius": "Kumbh", "Pisces": "Meen"
}

def generate_ai_summary(chart):
    try:
        chart_dict = chart.to_dict()
        d1 = chart_dict.get('d1Chart', {})
        houses = d1.get('houses', [])
        
        # 1. Basic info
        lagna_sign = None
        if houses:
            lagna_sign = houses[0].get('sign')
            
        moon_planet = next((p for p in chart.d1_chart.planets if p.celestial_body == 'Moon'), None)
        moon_sign = moon_planet.to_dict().get('sign') if moon_planet else None
        
        moon_nakshatra = moon_planet.to_dict().get('nakshatra') if moon_planet else getattr(chart.panchanga, 'nakshatra', None)
        moon_pada = moon_planet.to_dict().get('pada') if moon_planet else None
        
        # 2. Extract current dasha
        dashas = chart_dict.get('dashas', {}).get('current', {}).get('mahadashas', {})
        current_md = None
        current_ad = None
        md_end = None
        ad_end = None
        
        if dashas:
            md_planet = list(dashas.keys())[0]
            md_data = dashas[md_planet]
            current_md = md_planet
            md_end = md_data.get('end')
            
            ads = md_data.get('antardashas', {})
            if ads:
                ad_planet = list(ads.keys())[0]
                current_ad = ad_planet
                ad_end = ads[ad_planet].get('end')
        
        # 3. Format Planets in houses
        planets_summary = []
        for house in houses:
            h_num = house.get('number')
            for occ in house.get('occupants', []):
                p_name = occ.get('celestialBody')
                p_sign = occ.get('sign')
                p_sign_hindi = HINDI_RASHI.get(p_sign, p_sign)
                motion = occ.get('motion_type', '')
                retro = ' [Retrograde]' if motion == 'retrograde' else ''
                planets_summary.append(f"{p_name} is in House {h_num} ({p_sign}/{p_sign_hindi}){retro}")
                
        # 4. Construct AI friendly string
        lagna_hindi = HINDI_RASHI.get(lagna_sign, lagna_sign) if lagna_sign else lagna_sign
        moon_hindi = HINDI_RASHI.get(moon_sign, moon_sign) if moon_sign else moon_sign
        
        summary = {
            "rashi_info": f"Rashi (Moon Sign): {moon_sign} ({moon_hindi}). Lagna (Ascendant): {lagna_sign} ({lagna_hindi}). Nakshatra: {moon_nakshatra} Pada {moon_pada}.",
            "dasha_info": f"Current Mahadasha: {current_md} (Ends {md_end}). Current Antardasha: {current_ad} (Ends {ad_end}).",
            "planet_positions": "\n".join(planets_summary),
            "instructions_for_ai": "Use THIS summary to answer user queries. DO NOT hallucinate rashis. Keep responses to 2-3 lines max. For specific planet queries, refer to the 'planet_positions' list."
        }
        return summary
    except Exception as e:
        return {"error": f"Failed to generate summary: {str(e)}"}

chart = jyotishganit.calculate_birth_chart(birth_date=datetime(2002, 2, 16, 12, 0), latitude=28.9845, longitude=77.7064, timezone_offset=5.5, name='Test')
print(json.dumps(generate_ai_summary(chart), indent=2))
