#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart with exact scheme from reference image
Outputs image as base64 for WhatsApp delivery
"""
import os
import sys
import subprocess
import json
import base64
import urllib.request
import urllib.parse
from io import BytesIO

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

# Sign Abbreviations (matching professional charts)
SIGN_ABBR = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]

# Planet Hindi Abbreviations
PLANET_HINDI = {
    'Sun': 'सू', 'Moon': 'च', 'Mars': 'मं', 'Mercury': 'बु',
    'Jupiter': 'गु', 'Venus': 'शु', 'Saturn': 'श', 'Rahu': 'रा', 'Ketu': 'के', 'Lagna': 'Lg',
    'Kuja': 'कु', 'Brahaspati': 'ब्र', 'Sury': 'सू', 'Chandr': 'च', 'Budh': 'बु', 'Guru': 'गु', 'Shukr': 'शु', 'Shani': 'श'
}

def parse_planet_positions(planets_list):
    """Parse planet positions: 'Planet is in House X [Retrograde]'"""
    house_planets = {}
    if not planets_list: return house_planets
    
    for planet_str in planets_list:
        try:
            parts = planet_str.split()
            planet_name = parts[0]
            if "Lagna" in planet_str: planet_name = "Lagna"
            
            p_abbrev = PLANET_HINDI.get(planet_name, planet_name[:2])
            if "[Retrograde]" in planet_str:
                p_abbrev += "*"
            
            # Find house number
            house_num = None
            for p in parts:
                if p.isdigit(): house_num = int(p); break
            
            if house_num:
                if house_num not in house_planets: house_planets[house_num] = []
                house_planets[house_num].append(p_abbrev)
        except: continue
    return house_planets

def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
    img_size = 400
    PAD = 20
    img = Image.new('RGB', (img_size, img_size), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 1. Fonts
    font_paths = ["C:\\Windows\\Fonts\\Nirmala.ttc", "arial.ttf", "/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf"]
    font_p = font_s = None
    for fp in font_paths:
        try:
            if os.path.exists(fp) or "ttf" in fp or "ttc" in fp:
                font_p = ImageFont.truetype(fp, 18) # Planet
                font_s = ImageFont.truetype(fp, 12) # Sign
                break
        except: continue
    if not font_p: font_p = font_s = ImageFont.load_default()

    # 2. Grid (400x400)
    L, T, R, B = PAD, PAD, img_size-PAD, img_size-PAD
    MX, MY = img_size//2, img_size//2
    # Boundaries
    draw.rectangle([L, T, R, B], outline=LINE_COLOR, width=1)
    draw.line([L, T, R, B], fill=LINE_COLOR, width=1) # Diagonals
    draw.line([R, T, L, B], fill=LINE_COLOR, width=1)
    # Diamond
    draw.line([MX, T, R, MY], fill=LINE_COLOR, width=1)
    draw.line([R, MY, MX, B], fill=LINE_COLOR, width=1)
    draw.line([MX, B, L, MY], fill=LINE_COLOR, width=1)
    draw.line([L, MY, MX, T], fill=LINE_COLOR, width=1)

    # 3. Data
    try: lagna_idx = SIGN_NAMES.index(lagna)
    except: lagna_idx = 0
    
    house_planets = parse_planet_positions(planet_positions or [])
    if 1 not in house_planets: house_planets[1] = []
    if 'Lg' not in house_planets[1]: house_planets[1].insert(0, 'Lg')

    # Precise House Geometry (Centers and Sign Labels)
    # Centers for planets
    H_PLANETS = {
        1: (200, 110), 2: (155, 65),  3: (65, 155),  4: (110, 200),
        5: (65, 245),  6: (155, 335), 7: (200, 290), 8: (245, 335),
        9: (335, 245), 10: (290, 200), 11: (335, 155), 12: (245, 65)
    }
    # Sign labels (pushed away from lines)
    H_SIGNS = {
        1: (200, 160), 2: (125, 75),  3: (75, 125),  4: (150, 200),
        5: (75, 275),  6: (125, 325), 7: (200, 240), 8: (275, 325),
        9: (325, 275), 10: (250, 200), 11: (325, 125), 12: (275, 75)
    }

    # Rendering
    for h in range(1, 13):
        # A. Sign (e.g. "10 Cap")
        s_idx = (lagna_idx + h - 1) % 12
        s_text = f"{s_idx+1} {SIGN_ABBR[s_idx]}"
        draw.text(H_SIGNS[h], s_text, fill=TEXT_COLOR, font=font_s, anchor='mm')

        # B. Planets (Vertical Stack)
        planets = house_planets.get(h, [])
        if planets:
            cx, cy = H_PLANETS[h]
            for i, p in enumerate(planets):
                oy = (i - (len(planets)-1)/2) * 20
                draw.text((cx, cy + oy), p, fill=TEXT_COLOR, font=font_p, anchor='mm')

    # Footer
    draw.text((MX, img_size - 10), f"{nakshatra} | Moon: {moon_sign}", fill=TEXT_COLOR, font=font_s, anchor='mm')

    img_io = BytesIO()
    img.save(img_io, 'PNG')
    return img_io.getvalue()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--lagna', required=True)
    parser.add_argument('--moon-sign', required=True)
    parser.add_argument('--nakshatra', required=True)
    parser.add_argument('--planets')
    args = parser.parse_args()

    try:
        planets = json.loads(args.planets) if args.planets else []
    except:
        planets = []

    try:
        data = draw_kundli_chart(args.lagna, args.moon_sign, args.nakshatra, planets)
        b64 = base64.b64encode(data).decode()
        print(f"IMAGE_BASE64: {b64}")

        # Optional ImgBB upload
        api_key = os.getenv("IMGBB_API_KEY")
        if api_key and api_key != "your_imgbb_key_here":
            try:
                boundary = '----WebKitFormBoundary' + os.urandom(16).hex()
                payload = f'--{boundary}\r\nContent-Disposition: form-data; name="image"\r\n\r\n{b64}\r\n--{boundary}--\r\n'.encode('utf-8')
                req = urllib.request.Request(f'https://api.imgbb.com/1/upload?key={api_key}', data=payload, method='POST')
                req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        url = json.loads(resp.read().decode())['data']['url']
                        print(f"IMAGE_URL: {url}")
            except: pass
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
