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
    try:
        import subprocess
        subprocess.check_call([
            sys.executable, "-m", "pip", "install",
            "--break-system-packages",
            "pillow"
        ])
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:
        print("Error installing Pillow:", e, file=sys.stderr)
        sys.exit(1)

import argparse

# Colors mapped exactly to your reference image
BG_COLOR = '#2A1A08'    # Dark brown
LINE_COLOR = '#8C7861'  # Muted tan/grey
TEXT_COLOR = '#D1B054'  # Gold/yellow

# Signs
SIGN_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

SIGN_ABBR = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]

# Swapped BACK to exact Hindi matching your image
HINDI_MAP = {
    'Sun': 'सु', 'Moon': 'च', 'Mars': 'कु', 'Mercury': 'बु',
    'Jupiter': 'ब्र', 'Venus': 'शु', 'Saturn': 'श',
    'Rahu': 'रा', 'Ketu': 'के', 'Lagna': 'ल'
}

def get_devanagari_font():
    """Finds a local Hindi font or downloads one automatically."""
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
            
    print("Hindi font not found. Downloading NotoSansDevanagari...", file=sys.stderr)
    try:
        url = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
        urllib.request.urlretrieve(url, local_font)
        return local_font
    except Exception as e:
        print(f"Failed to download font: {e}", file=sys.stderr)
        return None

def parse_planet_positions(planets_list):
    house_planets = {}
    if not planets_list:
        return house_planets

    for item in planets_list:
        try:
            parts = item.split()
            name = parts[0]

            if "Lagna" in item:
                name = "Lagna"

            abbrev = HINDI_MAP.get(name, name[:2])

            # Modifiers matching your image (* for Retrograde, ^ for Combust)
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

        except:
            continue

    return house_planets

def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
    img_size = 400
    PAD = 20

    img = Image.new('RGB', (img_size, img_size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # --- FONT FIX: Load Hindi for planets, English for signs ---
    font_path_hindi = get_devanagari_font()
    
    # 1. Load Planet Font (Hindi)
    if font_path_hindi:
        try:
            font_p = ImageFont.truetype(font_path_hindi, 16)
        except:
            font_p = ImageFont.load_default()
    else:
        font_p = ImageFont.load_default()

    # 2. Load Sign Font (English System Font)
    font_paths_english = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc"
    ]
    for path in font_paths_english:
        try:
            font_s = ImageFont.truetype(path, 11)
            break
        except:
            continue
    else:
        font_s = ImageFont.load_default()
    # -----------------------------------------------------------

    # Grid Points
    L, T, R, B = PAD, PAD, img_size - PAD, img_size - PAD
    MX, MY = img_size // 2, img_size // 2

    # Draw Outer Box and Lines
    draw.rectangle([L, T, R, B], outline=LINE_COLOR)
    draw.line([L, T, R, B], fill=LINE_COLOR)
    draw.line([R, T, L, B], fill=LINE_COLOR)
    draw.line([MX, T, R, MY], fill=LINE_COLOR)
    draw.line([R, MY, MX, B], fill=LINE_COLOR)
    draw.line([MX, B, L, MY], fill=LINE_COLOR)
    draw.line([L, MY, MX, T], fill=LINE_COLOR)

    lagna_idx = SIGN_NAMES.index(lagna) if lagna in SIGN_NAMES else 0
    house_planets = parse_planet_positions(planet_positions or [])

    # Ensure Lagna is in House 1 (Using Hindi 'ल')
    house_planets.setdefault(1, [])
    if 'ल' not in house_planets[1]:
        house_planets[1].insert(0, 'ल')

    # Centers of the 12 spaces for HORIZONTAL planet placements
    H_PLANETS = {
        1: (200, 55),
        2: (110, 60), 3: (60, 110), 4: (110, 200),
        5: (60, 290), 6: (110, 340), 7: (200, 290), 8: (290, 340),
        9: (340, 290), 10: (290, 200), 11: (340, 110), 12: (290, 60)
    }

    # Tucked corner coordinates for the Signs
    H_SIGNS = {
        1: (200, 105),
        2: (110, 35), 3: (35, 110), 4: (130, 150),
        5: (35, 290), 6: (110, 365), 7: (200, 240), 8: (290, 365),
        9: (365, 290), 10: (270, 150), 11: (365, 110), 12: (290, 35)
    }

    HOUSE_ORDER = [1,2,3,4,5,6,7,8,9,10,11,12]

    for i, h in enumerate(HOUSE_ORDER):
        s_idx = (lagna_idx + i) % 12
        s_text = f"{s_idx + 1} {SIGN_ABBR[s_idx]}"
        
        # Draw signs tucked into corners (Using the ENGLISH font)
        draw.text(H_SIGNS[h], s_text, fill=LINE_COLOR, font=font_s, anchor='mm')

        planets = house_planets.get(h, [])
        if planets:
            cx, cy = H_PLANETS[h]
            # Horizontal space-separated combination (e.g. "ल कु के*")
            planet_text = " ".join(planets)
            # Draw planets (Using the HINDI font)
            draw.text((cx, cy), planet_text, fill=TEXT_COLOR, font=font_p, anchor='mm')

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
        image_data = draw_kundli_chart(
            args.lagna, args.moon_sign, args.nakshatra, planets
        )

        b64 = base64.b64encode(image_data).decode()
        
        # We output standard base64 directly so your backend can use it, 
        # or ImgBB upload runs if the key is provided
        api_key = os.getenv("IMGBB_API_KEY")
        if api_key and api_key != "your_imgbb_key_here":
            try:
                boundary = '----WebKitFormBoundary' + os.urandom(16).hex()
                payload = (
                    f'--{boundary}\r\n'
                    f'Content-Disposition: form-data; name="image"\r\n\r\n'
                    f'{b64}\r\n'
                    f'--{boundary}--\r\n'
                ).encode('utf-8')

                upload_url = f'https://api.imgbb.com/1/upload?key={api_key}'

                req = urllib.request.Request(
                    upload_url,
                    data=payload,
                    method='POST'
                )
                req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        result = json.loads(response.read().decode('utf-8'))
                        print(f"IMAGE_URL: {result['data']['url']}")
                    else:
                        print(f"ERROR: ImgBB upload failed", file=sys.stderr)
            except Exception as e:
                print(f"ERROR: ImgBB upload failed: {e}", file=sys.stderr)
        else:
            # If no ImgBB key, just print the base64 string
            print(f"IMAGE_BASE64: {b64}")

    except Exception as e:
        print("Error:", e, file=sys.stderr)

if __name__ == "__main__":
    main()