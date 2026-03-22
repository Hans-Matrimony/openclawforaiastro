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
    'Jupiter': 'गु', 'Venus': 'शु', 'Saturn': 'श', 'Rahu': 'रा', 'Ketu': 'के', 'Lagna': 'ल',
    'Kuja': 'कु', 'Brahaspati': 'ब्र', 'Sury': 'सू', 'Chandr': 'च', 'Budh': 'बु', 'Guru': 'गु', 'Shukr': 'शु', 'Shani': 'श'
}

def parse_planet_positions(planets_list):
    """Parse planet positions: 'Planet is in House X [Retrograde]'"""
    house_planets = {}
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
            if "House" in parts:
                idx = parts.index("House")
                house_num = int(parts[idx+1].rstrip(',. '))
            
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
            if os.path.exists(fp) or "ttf" in fp:
                font_p = ImageFont.truetype(fp, 18) # Planet
                font_s = ImageFont.truetype(fp, 12) # Sign
                break
        except: continue
    if not font_p: font_p = font_s = ImageFont.load_default()

    # 2. Grid (400x400)
    L, T, R, B = PAD, PAD, img_size-PAD, img_size-PAD
    MX, MY = img_size//2, img_size//2
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
    if 'ल' not in [p[0] for p in house_planets[1]]: house_planets[1].insert(0, 'ल')

    # House mapping logic (Centers)
    # Intersections of diag and diamond are at PAD + 1/4 of inner square
    INNER = img_size - 2*PAD
    IST = PAD + INNER // 4  # ~115
    END = PAD + 3 * (INNER // 4) # ~285

    H_CENTERS = {
        1:  (MX, (T+IST)//2 + 10), # Top Diamond center
        2:  ((MX+IST)//2, (T+B)//8 + 15),
        3:  ((L+MX)//4 + 20, (T+IST)//2 + 50),
        4:  ((L+IST)//2 + 10, MY), # Left Diamond
        5:  ((L+MX)//4 + 20, (B+END)//2 - 50),
        6:  ((MX+IST)//2, (B+MY)//2 + 40),
        7:  (MX, (B+END)//2 + 20), # Bottom Diamond
        8:  ((MX+END)//2, (B+MY)//2 + 40),
        9:  ((R+MX)//2 + 40, (B+END)//2 - 50),
        10: ((R+END)//2 + 10, MY), # Right Diamond
        11: ((R+MX)//2 + 40, (T+IST)//2 + 50),
        12: ((MX+END)//2, (T+B)//8 + 15),
    }
    
    # House apex for signs (Top/Edge of house)
    H_SIGNS = {
        1: (MX, T+15), 2: (MX-40, T+30), 3: (L+15, MY-40),
        4: (IST+10, MY), 5: (L+15, MY+40), 6: (MX-40, B-30),
        7: (MX, END+20), 8: (MX+40, B-30), 9: (R-15, MY+40),
        10: (END+20, MY), 11: (R-15, MY-40), 12: (MX+40, T+30),
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
            cx, cy = H_CENTERS[h]
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

    planets = json.loads(args.planets or '[]')
    try:
        data = draw_kundli_chart(args.lagna, args.moon_sign, args.nakshatra, planets)
        b64 = base64.b64encode(data).decode()

        # Upload to ImgBB
        imgbb_api_key = os.getenv("IMGBB_API_KEY", "your_imgbb_key_here")

        try:
            boundary = '----WebKitFormBoundary' + os.urandom(16).hex()
            payload = (
                f'--{boundary}\r\n'
                f'Content-Disposition: form-data; name="image"\r\n\r\n'
                f'{b64}\r\n'
                f'--{boundary}--\r\n'
            ).encode('utf-8')

            upload_url = f'https://api.imgbb.com/1/upload?key={imgbb_api_key}'

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
                    print(f"ERROR: Upload failed", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: Upload to ImgBB failed: {e}", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
