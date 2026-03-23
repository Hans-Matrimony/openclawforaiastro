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


def parse_planet_positions(planets_list):
    house_planets = {}

    for item in planets_list:
        try:
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

        except:
            continue

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
    house_planets = parse_planet_positions(planet_positions or [])

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
    except:
        planets = []

    image_data = draw_kundli_chart(
        args.lagna,
        args.moon_sign,
        args.nakshatra,
        planets
    )

    b64 = base64.b64encode(image_data).decode()

    # Step 1: Upload to ImgBB (for WhatsApp delivery)
    api_key = os.getenv("IMGBB_API_KEY")
    imgbb_url = None

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

            req = urllib.request.Request(upload_url, data=payload, method='POST')
            req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                imgbb_url = result['data']['url']
                print(f"IMAGE_URL: {imgbb_url}")

        except Exception as e:
            print(f"ERROR: ImgBB upload failed: {e}", file=sys.stderr)
    else:
        print(f"IMAGE_BASE64: {b64}")

    # Step 2: Store to MongoDB GridFS (for permanent storage)
    # Only if user_id is provided (prevents unnecessary storage calls)
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

            # Prepare birth details (empty since we don't have them here)
            birth_details = {
                "note": "Birth details not available in draw_kundli_traditional.py"
            }

            # Store to MongoDB
            storage_result = store_kundli_image_to_mongodb(
                image_base64=f"data:image/png;base64,{b64}",
                user_id=args.user_id,
                birth_details=birth_details,
                kundli_data=kundli_data,
                session_id=args.session_id or f"unknown:{args.user_id}",
                chart_type="north_indian_traditional",
                format="png"
            )

            if storage_result and storage_result.get("success"):
                # Silent success - don't print to avoid confusing the agent
                pass
        except ImportError:
            # calculate.py not available - skip MongoDB storage
            pass
        except Exception as e:
            # MongoDB storage failed - continue without failing the script
            print(f"WARNING: MongoDB storage failed: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()