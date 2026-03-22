#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart with exact scheme from reference image
Outputs image as base64 for WhatsApp delivery
"""
import os
import sys
import subprocess

# Auto-install PIL if not available
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow library...", file=sys.stderr)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "-q", "pillow"])
    from PIL import Image, ImageDraw, ImageFont

import argparse
import base64
import json
import urllib.parse
from io import BytesIO

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
            
            # Add Retrograde status (*)
            if "[Retrograde]" in planet_str:
                abbrev += "*"

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
    img_size = 400  # Matched to logic
    img = Image.new('RGB', (img_size, img_size), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    house_planets = {}
    if planet_positions:
        house_planets = parse_planet_positions(planet_positions)

    # Fonts - try cross-platform paths
    font_paths = [
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:\\Windows\\Fonts\\Nirmala.ttc",
        "arial.ttf"
    ]
    
    font_sign = font_hindi = font_info = None
    for p in font_paths:
        try:
            if os.path.exists(p):
                font_sign = ImageFont.truetype(p, 12)   # Smaller sign numbers
                font_hindi = ImageFont.truetype(p, 18)  # Scaled planets
                font_info = ImageFont.truetype(p, 10)
                break
        except: continue
    
    if not font_sign:
        font_sign = font_hindi = font_info = ImageFont.load_default()

    # Grid Constants (400x400)
    PAD = 15
    TOP, LEFT = PAD, PAD
    BOTTOM, RIGHT = img_size - PAD, img_size - PAD
    MID_X, MID_Y = img_size // 2, img_size // 2

    # Draw Outer Square
    draw.rectangle([(LEFT, TOP), (RIGHT, BOTTOM)], outline=LINE_COLOR, width=1)

    # Draw Diagonals (X)
    draw.line([(LEFT, TOP), (RIGHT, BOTTOM)], fill=LINE_COLOR, width=1)
    draw.line([(RIGHT, TOP), (LEFT, BOTTOM)], fill=LINE_COLOR, width=1)

    # Draw Inner Diamond (Midpoints)
    draw.line([(MID_X, TOP), (RIGHT, MID_Y)], fill=LINE_COLOR, width=1)
    draw.line([(RIGHT, MID_Y), (MID_X, BOTTOM)], fill=LINE_COLOR, width=1)
    draw.line([(MID_X, BOTTOM), (LEFT, MID_Y)], fill=LINE_COLOR, width=1)
    draw.line([(LEFT, MID_Y), (MID_X, TOP)], fill=LINE_COLOR, width=1)

    # --- HOUSE LOGIC ---
    try:
        lagna_sign_num = SIGN_NAMES.index(lagna) + 1
    except:
        lagna_sign_num = 1
    
    house_to_sign = {}
    for h in range(1, 13):
        sign_num = ((lagna_sign_num + h - 2) % 12) + 1
        house_to_sign[h] = sign_num

    # High-precision coordinates for 400x400 (PAD=15)
    # Signs are small and near boundaries, Planets stacked in the middle
    H_DATA = {
        1:  {'sign': (200, 160), 'planets': (200, 100)}, # Top Diamond
        2:  {'sign': (155, 75),  'planets': (120, 60)},  # TL Side
        3:  {'sign': (75, 155),  'planets': (60, 120)},  # LT Side
        4:  {'sign': (140, 200), 'planets': (100, 200)}, # Left Diamond
        5:  {'sign': (75, 245),  'planets': (60, 280)},  # LB Side
        6:  {'sign': (155, 325), 'planets': (120, 340)}, # BL Side
        7:  {'sign': (200, 240), 'planets': (200, 300)}, # Bottom Diamond
        8:  {'sign': (245, 325), 'planets': (280, 340)}, # BR Side
        9:  {'sign': (325, 245), 'planets': (340, 280)}, # RB Side
        10: {'sign': (260, 200), 'planets': (300, 200)}, # Right Diamond
        11: {'sign': (325, 155), 'planets': (340, 120)}, # RT Side
        12: {'sign': (245, 75),  'planets': (280, 60)},  # TR Side
    }

    # Rendering
    for h_num in range(1, 13):
        # 1. Sign Number
        sign_val = house_to_sign[h_num]
        s_x, s_y = H_DATA[h_num]['sign']
        draw.text((s_x, s_y), str(sign_val), fill=TEXT_COLOR, font=font_sign, anchor='mm')

        # 2. Planets (Vertical Stacking)
        planets = house_planets.get(h_num, [])
        if h_num == 1 and 'ल' not in [p[0] for p in planets]:
            planets.insert(0, 'ल')
        
        if planets:
            p_x, p_y = H_DATA[h_num]['planets']
            for i, p_abbrev in enumerate(planets):
                offset_y = (i - (len(planets)-1)/2) * 18
                draw.text((p_x, p_y + offset_y), p_abbrev, fill=TEXT_COLOR, font=font_hindi, anchor='mm')

    # Subtle Info
    info_text = f"{nakshatra} | Moon: {moon_sign}"
    draw.text((MID_X, img_size - 8), info_text, fill=TEXT_COLOR, font=font_info, anchor='mm')

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

        # Upload to ImgBB (free image hosting) - similar to DALL-E URL approach
        import urllib.request

        imgbb_api_key = os.getenv("IMGBB_API_KEY", "your_imgbb_key_here")
        base64_string = base64.b64encode(image_bytes).decode('utf-8')

        try:
            # ImgBB expects: key in URL query parameter, image as raw base64 in multipart/form-data
            # Note: NOT data URL format, just raw base64 string

            # Use multipart/form-data encoding (not urlencoded)
            boundary = '----WebKitFormBoundary' + os.urandom(16).hex()
            payload = (
                f'--{boundary}\r\n'
                f'Content-Disposition: form-data; name="image"\r\n\r\n'
                f'{base64_string}\r\n'
                f'--{boundary}--\r\n'
            ).encode('utf-8')

            # API key goes in URL query parameter
            upload_url = f'https://api.imgbb.com/1/upload?key={imgbb_api_key}'

            print(f"Uploading to ImgBB (image size: {len(image_bytes)} bytes, base64 size: {len(base64_string)} chars)...", file=sys.stderr)

            req = urllib.request.Request(
                upload_url,
                data=payload,
                method='POST'
            )
            req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    result = json.loads(response.read().decode('utf-8'))
                    image_url = result['data']['url']
                    print(f"IMAGE_URL: {image_url}")
                else:
                    error_data = response.read().decode('utf-8')
                    print(f"Upload failed: status {response.status}", file=sys.stderr)
                    print(f"ImgBB error response: {error_data}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"ERROR: Upload to ImgBB failed: {e.code} {e.reason}", file=sys.stderr)
            print(f"ImgBB error response: {error_body}", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: Upload to ImgBB failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
