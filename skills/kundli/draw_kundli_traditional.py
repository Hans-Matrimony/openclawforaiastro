#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart (Horizontal layout & Hindi text)
Outputs image as base64 for WhatsApp delivery
"""

import os
import sys
import json
import ast  # Safely evaluates single-quoted python dictionaries
import base64
import re
from io import BytesIO

# Installed and checked at image build time; rendering never installs packages.
from PIL import Image, ImageDraw, ImageFont

import argparse

# Colors
BG_COLOR = '#2A1A08'
LINE_COLOR = '#8C7861'
TEXT_COLOR = '#D1B054'

SIGN_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

SIGN_ABBR = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]

HINDI_MAP = {
    'Sun': 'सु', 'Moon': 'च', 'Mars': 'कु', 'Mercury': 'बु',
    'Jupiter': 'गु',   # Changed from 'ब्र' to avoid Pillow font breaking
    'Venus': 'शु', 'Saturn': 'श',
    'Rahu': 'रा', 'Ketu': 'के', 'Lagna': 'ल'
}

# Mapping to handle AI agents passing Hindi names instead of English
HINDI_TO_ENGLISH_SIGN = {
    "Mesh": "Aries", "Vrishabh": "Taurus", "Mithun": "Gemini", "Kark": "Cancer",
    "Singh": "Leo", "Kanya": "Virgo", "Tula": "Libra", "Vrishchik": "Scorpio",
    "Dhanu": "Sagittarius", "Makar": "Capricorn", "Kumbh": "Aquarius", "Meen": "Pisces"
}

def normalize_sign_name(sign_name):
    """Ensure the sign name is in standard English for internal logic"""
    if not sign_name:
        return sign_name
        
    # Handle potential casing issues
    sign_name = sign_name.strip().title()
    
    # Translate to English if it's a Hindi name, otherwise leave it alone
    return HINDI_TO_ENGLISH_SIGN.get(sign_name, sign_name)

def get_devanagari_font():
    local_font = os.path.join(os.path.dirname(os.path.abspath(__file__)), "NotoSansDevanagari-Regular.ttf")
    if os.path.exists(local_font):
        return local_font

    win_fonts = ["C:\\Windows\\Fonts\\nirmala.ttf", "C:\\Windows\\Fonts\\mangal.ttf"]
    for wf in win_fonts:
        if os.path.exists(wf):
            return wf

    linux_fonts = ["/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"]
    for lf in linux_fonts:
        if os.path.exists(lf):
            return lf

    # A missing font uses the existing Pillow fallback; no network/disk writes.
    return None

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
    
    house = ((p_idx - l_idx) % 12) + 1
    return house

def parse_planet_positions(planets_list, lagna=None):
    house_planets = {}

    if not planets_list:
        print(f"⚠️ WARNING: planets_list is empty or None", file=sys.stderr)
        return house_planets

    print(f"🔍 DEBUG: Processing {len(planets_list)} planet positions", file=sys.stderr)

    for item in planets_list:
        try:
            if isinstance(item, dict):
                name = item.get('planet') or item.get('name') or ''
                house = item.get('house', '')
                sign = item.get('sign', '')
                
                if not name and not sign:
                    known_planets = {'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Lagna'}
                    found_planets = False
                    for k, v in item.items():
                        if k in known_planets and isinstance(v, str):
                            found_planets = True
                            p_name = k
                            p_sign = v
                            p_house = get_house_from_sign(p_sign, lagna) if lagna else ''
                            p_str = f"{p_name} is in House {p_house} ({p_sign})"
                            print(f"  🔧 Converted flat dict: {p_name} → {p_str}", file=sys.stderr)
                            
                            abbrev = HINDI_MAP.get(p_name, p_name[:2])
                            if p_house:
                                house_planets.setdefault(p_house, []).append(abbrev)
                                print(f"  ✓ {p_name} → House {p_house} → {abbrev}", file=sys.stderr)
                    if found_planets:
                        continue
                
                if not str(house).strip() and sign and lagna:
                    house = get_house_from_sign(sign, lagna)
                
                position_str = item.get('position', '')
                if not str(house).strip() and position_str and name:
                    item = f"{name} {position_str}"
                    print(f"  🔧 Converted 'position' dict to string: {name} → {item}", file=sys.stderr)
                else:
                    if not name or not str(house).strip():
                        print(f"  ⚠️ Skipping incomplete dict: {item}", file=sys.stderr)
                        continue

                    if sign:
                        planet_str = f"{name} is in House {house} ({sign})"
                    else:
                        planet_str = f"{name} is in House {house}"
                    item = planet_str
                    print(f"  🔧 Converted dict to string: {name} → {planet_str}", file=sys.stderr)

            if not isinstance(item, str):
                print(f"⚠️ WARNING: Skipping non-string planet item: {type(item)} = {repr(item)}", file=sys.stderr)
                continue

            parts = item.split()
            name = parts[0]

            if "Lagna" in item:
                name = "Lagna"

            abbrev = HINDI_MAP.get(name, name[:2])

            if "[Retrograde]" in item:
                abbrev += "*"
            if "[Combust]" in item:
                abbrev += "^"

            house = None
            for p in parts:
                if p.isdigit():
                    house = int(p)
                    break

            if house:
                house_planets.setdefault(house, []).append(abbrev)
                print(f"  ✓ {name} → House {house} → {abbrev}", file=sys.stderr)
            else:
                print(f"  ⚠️ Could not find house number in: {item}", file=sys.stderr)

        except Exception as e:
            print(f"⚠️ ERROR processing planet item '{item}': {e}", file=sys.stderr)
            continue

    print(f"📊 RESULT: Planets in {len(house_planets)} houses: {list(house_planets.keys())}", file=sys.stderr)
    return house_planets

def verified_image_positions(lagna, moon_sign, planet_positions):
    """Validate all nine placements before drawing; retain supported input forms."""
    if lagna not in SIGN_NAMES or moon_sign not in SIGN_NAMES:
        raise ValueError('Valid Lagna and Moon signs are required')
    names = set(HINDI_MAP) - {'Lagna'}
    if not isinstance(planet_positions, list) or not planet_positions:
        raise ValueError('All nine planetary placements are required')
    expanded = []
    for item in planet_positions:
        if isinstance(item, dict) and not any(key in item for key in ('planet', 'name', 'position', 'house', 'sign')):
            if not item or any(key not in names | {'Lagna'} for key in item):
                raise ValueError('Invalid planetary placement')
            expanded.extend({'name': key, 'sign': value} for key, value in item.items())
        else:
            expanded.append(item)
    if not 9 <= len(expanded) <= 10:
        raise ValueError('All nine planetary placements are required')
    placements, normalized = {}, []
    for item in expanded:
        flags = ''
        if isinstance(item, dict):
            name = item.get('planet') or item.get('name')
            house, sign = item.get('house'), item.get('sign')
            if house in (None, '') and not sign and item.get('position') and isinstance(name, str):
                item = f"{name} {item['position']}"
        if isinstance(item, str):
            words = item.split()
            if not words:
                raise ValueError('Invalid planetary placement')
            name = words[0]
            match = re.search(r'\bHouse\s+(\d{1,2})\b', item, re.IGNORECASE)
            if not match:
                raise ValueError('A house number is required for every planet')
            house = int(match.group(1))
            annotation = re.search(r'\(([^()]*)\)', item)
            sign = annotation.group(1) if annotation else None
            flags = ''.join(f' [{flag}]' for flag in ('Retrograde', 'Combust') if f'[{flag}]' in item)
        elif not isinstance(item, dict):
            raise ValueError('Invalid planetary placement')
        if not isinstance(name, str) or name not in names | {'Lagna'} or name in placements:
            raise ValueError('Invalid or duplicate planet')
        signs = []
        if sign not in (None, ''):
            if not isinstance(sign, str):
                raise ValueError('Invalid planetary sign')
            signs = [normalize_sign_name(part) for part in sign.split('/')]
            if any(value not in SIGN_NAMES for value in signs) or len(set(signs)) != 1:
                raise ValueError('Invalid or contradictory planetary sign')
        if house in (None, '') and signs:
            house = get_house_from_sign(signs[0], lagna)
        if isinstance(house, str) and house.isdigit():
            house = int(house)
        if type(house) is not int or not 1 <= house <= 12:
            raise ValueError('Invalid planetary house')
        expected = SIGN_NAMES[(SIGN_NAMES.index(lagna) + house - 1) % 12]
        if signs and signs[0] != expected:
            raise ValueError('Planetary house conflicts with its sign')
        if name == 'Moon' and expected != moon_sign:
            raise ValueError('Moon placement conflicts with its summary')
        if name == 'Lagna' and house != 1:
            raise ValueError('Lagna must occupy house one')
        placements[name] = house
        if name != 'Lagna':
            normalized.append(f'{name} is in House {house} ({expected}){flags}')
    if set(placements) - {'Lagna'} != names:
        raise ValueError('All nine unique planets are required')
    if (placements['Ketu'] - placements['Rahu']) % 12 != 6:
        raise ValueError('Rahu and Ketu must occupy opposite signs')
    return normalized


def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
    planet_positions = verified_image_positions(lagna, moon_sign, planet_positions)
    img_size = 400
    PAD = 20

    img = Image.new('RGB', (img_size, img_size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Fonts
    font_path_hindi = get_devanagari_font()

    if font_path_hindi:
        try:
            font_p = ImageFont.truetype(font_path_hindi, 16)
        except:
            font_p = ImageFont.load_default()
    else:
        font_p = ImageFont.load_default()

    try:
        font_s = ImageFont.truetype("arial.ttf", 11)
    except:
        font_s = ImageFont.load_default()

    # Grid
    L, T, R, B = PAD, PAD, img_size - PAD, img_size - PAD
    MX, MY = img_size // 2, img_size // 2

    draw.rectangle([L, T, R, B], outline=LINE_COLOR)
    draw.line([L, T, R, B], fill=LINE_COLOR)
    draw.line([R, T, L, B], fill=LINE_COLOR)
    draw.line([MX, T, R, MY], fill=LINE_COLOR)
    draw.line([R, MY, MX, B], fill=LINE_COLOR)
    draw.line([MX, B, L, MY], fill=LINE_COLOR)
    draw.line([L, MY, MX, T], fill=LINE_COLOR)

    lagna_idx = SIGN_NAMES.index(lagna)
    house_planets = parse_planet_positions(planet_positions or [], lagna=lagna)

    # Ensure Lagna
    house_planets.setdefault(1, [])
    if 'ल' not in house_planets[1]:
        house_planets[1].insert(0, 'ल')

    HOUSE_POS = {
        1: (200, 110), 2: (110, 65),  3: (65, 110),  4: (110, 200),
        5: (65, 290),  6: (110, 335), 7: (200, 290), 8: (290, 335),
        9: (335, 290), 10: (290, 200), 11: (335, 110), 12: (290, 65),
    }

    for i in range(12):
        h = i + 1
        s_idx = (lagna_idx + i) % 12
        s_text = f"{s_idx + 1} {SIGN_ABBR[s_idx]}"

        cx, cy = HOUSE_POS[h]

        draw.text(
            (cx, cy - 18),
            s_text,
            fill=LINE_COLOR,
            font=font_s,
            anchor='mm'
        )

        planets = house_planets.get(h, [])
        if planets:
            planet_text = " ".join(planets)
            offset = 14 if len(planets) <= 2 else 18

            draw.text(
                (cx, cy + offset),
                planet_text,
                fill=TEXT_COLOR,
                font=font_p,
                anchor='mm'
            )

    draw.text(
        (MX, img_size - 10),
        f"{nakshatra} | Moon: {moon_sign}",
        fill=TEXT_COLOR,
        font=font_s,
        anchor='mm'
    )

    img_io = BytesIO()
    img.save(img_io, 'PNG')
    return img_io.getvalue()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--lagna', required=True)
    parser.add_argument('--moon-sign', required=True)
    parser.add_argument('--nakshatra', required=True)
    parser.add_argument('--planets', required=True, help='JSON array of planet positions (REQUIRED)')
    parser.add_argument('--user-id', help='User ID for MongoDB storage')
    parser.add_argument('--session-id', help='Session ID for MongoDB storage')

    args = parser.parse_args()

    # Keep JSON and legacy single-quoted arrays; never print raw chart input.
    try:
        try:
            planets = json.loads(args.planets)
        except json.JSONDecodeError:
            planets = ast.literal_eval(args.planets)
    except (ValueError, SyntaxError):
        print('ERROR: Invalid planet JSON; no image generated.', file=sys.stderr)
        return 1

    # Normalize inputs in case the AI agent passes Hindi names instead of English
    safe_lagna = normalize_sign_name(args.lagna)
    safe_moon = normalize_sign_name(args.moon_sign)

    try:
        image_data = draw_kundli_chart(safe_lagna, safe_moon, args.nakshatra, planets)
    except ValueError:
        print('ERROR: Incomplete or conflicting chart placements; no image generated.', file=sys.stderr)
        return 1

    b64 = base64.b64encode(image_data).decode()

    stored_url = None
    if args.user_id:
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from calculate import store_kundli_image_to_mongodb

            # Use the safe, normalized english names for the database
            kundli_data = {
                "lagna": safe_lagna,
                "moon_sign": safe_moon,
                "nakshatra": args.nakshatra,
                "chart_type": "north_indian_traditional"
            }

            birth_details = {
                "note": "Birth details not available in draw_kundli_traditional.py"
            }

            storage_result = store_kundli_image_to_mongodb(
                image_base64=f"data:image/png;base64,{b64}",
                user_id=args.user_id,
                birth_details=birth_details,
                kundli_data=kundli_data,
                session_id=args.session_id or f"whatsapp:{args.user_id}",
                chart_type="north_indian_traditional",
                format="png"
            )

            if storage_result and storage_result.get("success") and not os.getenv("MONGO_LOGGER_API_TOKEN"):
                file_id = storage_result.get("fileId")
                mongo_logger_url = os.getenv("MONGO_LOGGER_URL", "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com")
                stored_url = f"{mongo_logger_url}/kundli-image/{file_id}"
                print(f"IMAGE_URL: {stored_url}")
                
        except ImportError:
            pass
        except Exception as e:
            print(f"WARNING: MongoDB storage failed: {e}", file=sys.stderr)

    if not stored_url:
        print(f"IMAGE_BASE64: {b64}")

if __name__ == "__main__":
    sys.exit(main())
