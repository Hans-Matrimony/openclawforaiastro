#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart with exact scheme from reference image
Outputs image as base64 for WhatsApp delivery
"""
import os
import sys
import argparse
import base64
import json
import subprocess
from io import BytesIO

# Import PIL (must be pre-installed in container)
from PIL import Image, ImageDraw, ImageFont

# Colors from the scheme
BG_COLOR = '#3D2605'    # Dark Chocolate Brown
LINE_COLOR = '#FFFFFF'  # White
TEXT_COLOR = '#FFD700'  # Golden/Yellow

# Sign Sequence (1-12 represented by names here, converted to numbers in chart)
SIGN_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

# Planet Hindi Abbreviations
PLANET_HINDI = {
    'Sun': 'सू',
    'Moon': 'च',
    'Mars': 'मं',
    'Mercury': 'बु',
    'Jupiter': 'गु',
    'Venus': 'शु',
    'Saturn': 'श',
    'Rahu': 'रा',
    'Ketu': 'के',
    'Lagna': 'ल'
}

def parse_planet_positions(planets_list):
    """Parse planet positions from calculate.py output"""
    house_planets = {}

    for planet_str in planets_list:
        try:
            parts = planet_str.split()
            planet_full = parts[0]
            
            if "Lagna" in planet_str:
                planet_full = "Lagna"

            abbrev = PLANET_HINDI.get(planet_full, planet_full[:2])

            if "is in House" in planet_str:
                house_idx = parts.index("is") + 3
                house_num = int(parts[house_idx])

                if house_num not in house_planets:
                    house_planets[house_num] = []
                house_planets[house_num].append(abbrev)
        except Exception:
            continue

    return house_planets

def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
    """Draw proper North Indian Kundli chart: Fixed Houses, Moving Signs"""
    img_size = 400  # Reduced from 800 for faster generation & smaller base64
    img = Image.new('RGB', (img_size, img_size), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    house_planets = {}
    if planet_positions:
        house_planets = parse_planet_positions(planet_positions)

    # Fonts - Try multiple paths for cross-platform compatibility
    font_sign = font_hindi = font_info = None

    # List of font paths to try (Linux first, then Windows)
    font_paths = [
        # Linux Devanagari fonts
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        # Windows fonts (for local testing)
        "C:\\Windows\\Fonts\\Nirmala.ttc",
        "C:\\Windows\\Fonts\\arial.ttf",
        # Fallback
        "arial.ttf",
    ]

    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                font_sign = ImageFont.truetype(font_path, 22)   # Sign numbers
                font_hindi = ImageFont.truetype(font_path, 36)  # Planet abbreviations
                font_info = ImageFont.truetype(font_path, 20)   # Nakshatra etc.
                break
        except:
            continue

    # If no font loaded, use default
    if font_sign is None:
        font_sign = font_hindi = font_info = ImageFont.load_default()

    # Grid Constants
    PAD = 40
    TOP, LEFT = PAD, PAD
    BOTTOM, RIGHT = img_size - PAD, img_size - PAD
    MID_X, MID_Y = img_size // 2, img_size // 2

    # Draw Outer Square
    draw.rectangle([(LEFT, TOP), (RIGHT, BOTTOM)], outline=LINE_COLOR, width=3)

    # Draw Diagonals (X)
    draw.line([(LEFT, TOP), (RIGHT, BOTTOM)], fill=LINE_COLOR, width=2)
    draw.line([(RIGHT, TOP), (LEFT, BOTTOM)], fill=LINE_COLOR, width=2)

    # Draw Inner Diamond (Midpoints)
    draw.line([(MID_X, TOP), (RIGHT, MID_Y)], fill=LINE_COLOR, width=2)
    draw.line([(RIGHT, MID_Y), (MID_X, BOTTOM)], fill=LINE_COLOR, width=2)
    draw.line([(MID_X, BOTTOM), (LEFT, MID_Y)], fill=LINE_COLOR, width=2)
    draw.line([(LEFT, MID_Y), (MID_X, TOP)], fill=LINE_COLOR, width=2)

    # --- HOUSE LOGIC (North Indian - 12 FIXED AREAS) ---
    # House Indices (Fixed):
    # 1:  Top Center Diamond
    # 2:  Top Left Side Triangle
    # 3:  Left Top Side Triangle
    # 4:  Left Center Diamond
    # 5:  Left Bottom Side Triangle
    # 6:  Bottom Left Side Triangle
    # 7:  Bottom Center Diamond
    # 8:  Bottom Right Side Triangle
    # 9:  Right Bottom Side Triangle
    # 10: Right Center Diamond
    # 11: Right Top Side Triangle
    # 12: Top Right Side Triangle

    # Sign number in each house: (LagnaSign + house - 1) % 12
    try:
        lagna_sign_num = SIGN_NAMES.index(lagna) + 1
    except:
        lagna_sign_num = 1
    
    house_to_sign = {}
    for h in range(1, 13):
        sign_num = ((lagna_sign_num + h - 2) % 12) + 1
        house_to_sign[h] = sign_num

    # High-precision coordinates for 800x800 square (PAD=40)
    # Centers of the 12 triangles/diamonds
    H_DATA = {
        1:  {'sign': (400, 310), 'planets': (400, 200)}, # Top Diamond
        2:  {'sign': (310, 150), 'planets': (220, 110)}, # TL Side
        3:  {'sign': (150, 310), 'planets': (110, 220)}, # LT Side
        4:  {'sign': (290, 400), 'planets': (200, 400)}, # Left Diamond
        5:  {'sign': (150, 490), 'planets': (110, 580)}, # LB Side
        6:  {'sign': (310, 650), 'planets': (220, 690)}, # BL Side
        7:  {'sign': (400, 490), 'planets': (400, 600)}, # Bottom Diamond
        8:  {'sign': (490, 650), 'planets': (580, 690)}, # BR Side
        9:  {'sign': (650, 490), 'planets': (690, 580)}, # RB Side
        10: {'sign': (510, 400), 'planets': (600, 400)}, # Right Diamond
        11: {'sign': (650, 310), 'planets': (690, 220)}, # RT Side
        12: {'sign': (490, 150), 'planets': (580, 110)}, # TR Side
    }

    # Rendering
    for h_num in range(1, 13):
        # 1. Draw Sign Number
        sign_val = house_to_sign[h_num]
        s_x, s_y = H_DATA[h_num]['sign']
        draw.text((s_x, s_y), str(sign_val), fill=TEXT_COLOR, font=font_sign, anchor='mm')

        # 2. Draw Planets
        planets = house_planets.get(h_num, [])
        if h_num == 1 and 'ल' not in planets:
            planets.insert(0, 'ल')
        
        if planets:
            p_x, p_y = H_DATA[h_num]['planets']
            # Join multiple planets with space, possibly multiple lines if needed
            # For now, horizontal space is enough
            planet_text = " ".join(planets)
            draw.text((p_x, p_y), planet_text, fill=TEXT_COLOR, font=font_hindi, anchor='mm')

    # Convert to bytes
    img_bytes = BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)

    return img_bytes.read()

def main():
    parser = argparse.ArgumentParser(description='Generate traditional Kundli chart')
    parser.add_argument('--lagna', required=True, help='Lagna (Ascendant) sign')
    parser.add_argument('--moon-sign', required=True, help='Moon sign')
    parser.add_argument('--nakshatra', required=True, help='Nakshatra')
    parser.add_argument('--planets', help='Planet positions as JSON array')

    args = parser.parse_args()

    planet_positions = []
    if args.planets:
        try:
            planet_positions = json.loads(args.planets)
        except json.JSONDecodeError:
            planet_positions = []

    try:
        image_bytes = draw_kundli_chart(
            args.lagna,
            args.moon_sign,
            args.nakshatra,
            planet_positions
        )

        # Output as base64 for WhatsApp
        base64_string = base64.b64encode(image_bytes).decode('utf-8')
        print(f"MEDIA_BASE64: image/png {base64_string}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
