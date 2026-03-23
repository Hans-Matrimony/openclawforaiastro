#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart (Horizontal layout & Hindi text)
Outputs image as base64 for WhatsApp delivery
"""

import os
import sys
import json
import base64
import urllib.request
from io import BytesIO

# Auto-install Pillow
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import subprocess
    subprocess.check_call([
        sys.executable, "-m", "pip", "install",
        "--break-system-packages",
        "pillow"
    ])
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
    'Jupiter': 'गु',   # Changed from 'ब्र' to avoid Pillow font breaking (ब्र requires complex ligature rendering)
    'Venus': 'शु', 'Saturn': 'श',
    'Rahu': 'रा', 'Ketu': 'के', 'Lagna': 'ल'
}

def get_devanagari_font():
    local_font = "NotoSansDevanagari-Regular.ttf"
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

    try:
        url = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
        urllib.request.urlretrieve(url, local_font)
        return local_font
    except:
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
                # Robust extraction of name and house
                name = item.get('planet') or item.get('name') or ''
                house = item.get('house', '')
                sign = item.get('sign', '')
                
                # Check for flat {'Planet': 'Sign'} format if standard format is missing
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
                
                # If house is missing but we have sign and lagna, calculate it
                if not str(house).strip() and sign and lagna:
                    house = get_house_from_sign(sign, lagna)
                
                # Check if it provided 'position' string directly instead of discrete keys
                position_str = item.get('position', '')
                if not str(house).strip() and position_str and name:
                    item = f"{name} {position_str}"
                    print(f"  🔧 Converted 'position' dict to string: {name} → {item}", file=sys.stderr)
                    # Automatically falls through to the string parsing block below!
                else:
                    # If name or house are effectively missing, skip
                    if not name or not str(house).strip():
                        print(f"  ⚠️ Skipping incomplete dict: {item}", file=sys.stderr)
                        continue

                    # Format: "Saturn is in House 1 (Taurus/Vrishabh)"
                    # Include sign if available to match calculate.py output format
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


def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
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

    # 🔥 STANDARD VEDIC NORTH INDIAN GEOMETRY
    # These coordinates perfectly center the text inside the traditional diamonds and triangles
    HOUSE_POS = {
        1: (200, 110),  # Top Center Diamond (Lagna ALWAYS goes here)
        2: (110, 65),   # Top Left Triangle (Outer)
        3: (65, 110),   # Middle Left Triangle (Upper)
        4: (110, 200),  # Left Center Diamond
        5: (65, 290),   # Middle Left Triangle (Lower)
        6: (110, 335),  # Bottom Left Triangle (Outer)
        7: (200, 290),  # Bottom Center Diamond
        8: (290, 335),  # Bottom Right Triangle (Outer)
        9: (335, 290),  # Middle Right Triangle (Lower)
        10: (290, 200), # Right Center Diamond
        11: (335, 110), # Middle Right Triangle (Upper)
        12: (290, 65),  # Top Right Triangle (Outer)
    }

    for i in range(12):
        h = i + 1
        s_idx = (lagna_idx + i) % 12
        s_text = f"{s_idx + 1} {SIGN_ABBR[s_idx]}"

        cx, cy = HOUSE_POS[h]

        # Draw sign
        draw.text(
            (cx, cy - 18),
            s_text,
            fill=LINE_COLOR,
            font=font_s,
            anchor='mm'
        )

        # Draw planets
        planets = house_planets.get(h, [])
        if planets:
            planet_text = " ".join(planets)
            # Push the Hindi text down slightly so it never overlaps the English zodiac number
            offset = 14 if len(planets) <= 2 else 18

            draw.text(
                (cx, cy + offset),
                planet_text,
                fill=TEXT_COLOR,
                font=font_p,
                anchor='mm'
            )

    # Footer
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
    parser.add_argument('--planets')
    parser.add_argument('--user-id', help='User ID for MongoDB storage')
    parser.add_argument('--session-id', help='Session ID for MongoDB storage')

    args = parser.parse_args()

    try:
        planets = json.loads(args.planets) if args.planets else []
    except Exception as e:
        print(f"⚠️ ERROR PARSING PLANETS: {e} | Raw input: {repr(args.planets)}", file=sys.stderr)
        print(f"⚠️ TIP: --planets must be valid JSON array, e.g., '[\"Moon is in House 1\"]'", file=sys.stderr)
        planets = []

    # Debug: Log how many planets were parsed
    if planets:
        print(f"🪐 Parsed {len(planets)} planet positions from --planets argument", file=sys.stderr)
    else:
        print(f"⚠️ WARNING: No planet positions provided. Chart will show only Lagna.", file=sys.stderr)

    image_data = draw_kundli_chart(
        args.lagna,
        args.moon_sign,
        args.nakshatra,
        planets
    )

    b64 = base64.b64encode(image_data).decode()

    # Store to MongoDB GridFS (for permanent storage and webhook delivery)
    # We require user_id to store correctly. If missing, we just output base64.
    stored_url = None
    if args.user_id:
        try:
            # Import the storage function from calculate.py
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from calculate import store_kundli_image_to_mongodb

            # Prepare Kundli data for metadata
            kundli_data = {
                "lagna": args.lagna,
                "moon_sign": args.moon_sign,
                "nakshatra": args.nakshatra,
                "chart_type": "north_indian_traditional"
            }

            birth_details = {
                "note": "Birth details not available in draw_kundli_traditional.py"
            }

            # Store to MongoDB
            storage_result = store_kundli_image_to_mongodb(
                image_base64=f"data:image/png;base64,{b64}",
                user_id=args.user_id,
                birth_details=birth_details,
                kundli_data=kundli_data,
                session_id=args.session_id or f"whatsapp:{args.user_id}",
                chart_type="north_indian_traditional",
                format="png"
            )

            if storage_result and storage_result.get("success"):
                file_id = storage_result.get("fileId")
                mongo_logger_url = os.getenv("MONGO_LOGGER_URL", "http://localhost:5000")
                stored_url = f"{mongo_logger_url}/kundli-image/{file_id}"
                # Output the IMAGE_URL matching the mongo logger endpoint so Whatsapp Webhook can download it
                print(f"IMAGE_URL: {stored_url}")
                
        except ImportError:
            # calculate.py not available
            pass
        except Exception as e:
            print(f"WARNING: MongoDB storage failed: {e}", file=sys.stderr)

    if not stored_url:
        # Fallback to pure base64 if MongoDB storage fails or no user_id
        print(f"IMAGE_BASE64: {b64}")


if __name__ == "__main__":
    main()