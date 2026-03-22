#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart
Outputs image as base64 for WhatsApp delivery
"""

import os
import sys
import json
import base64
import urllib.request
import urllib.parse
from io import BytesIO

# Auto-install Pillow (kept same as your working version)
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

# Colors
BG_COLOR = '#3D2605'
LINE_COLOR = '#FFFFFF'
TEXT_COLOR = '#FFD700'

# Signs
SIGN_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
]

SIGN_ABBR = ["Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"]

# Planet abbreviations
PLANET_MAP = {
    'Sun': 'Su', 'Moon': 'Mo', 'Mars': 'Ma', 'Mercury': 'Me',
    'Jupiter': 'Ju', 'Venus': 'Ve', 'Saturn': 'Sa',
    'Rahu': 'Ra', 'Ketu': 'Ke', 'Lagna': 'Lg'
}


# ---------------- PARSE PLANETS ---------------- #
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

            abbrev = PLANET_MAP.get(name, name[:2])

            if "[Retrograde]" in item:
                abbrev += "*"

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


# ---------------- DRAW KUNDLI ---------------- #
def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):

    img_size = 400
    PAD = 20

    img = Image.new('RGB', (img_size, img_size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Fonts
    font_paths = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ]

    font_p = font_s = None

    for path in font_paths:
        try:
            font_p = ImageFont.truetype(path, 18)
            font_s = ImageFont.truetype(path, 12)
            break
        except:
            continue

    if not font_p:
        font_p = font_s = ImageFont.load_default()

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

    # Lagna index
    try:
        lagna_idx = SIGN_NAMES.index(lagna)
    except:
        lagna_idx = 0

    # Parse planets
    house_planets = parse_planet_positions(planet_positions or [])

    # Lagna always in House 1
    house_planets.setdefault(1, [])
    if 'Lg' not in house_planets[1]:
        house_planets[1].insert(0, 'Lg')

    # ✅ CORRECT HOUSE MAPPING (FIXED)
    H_PLANETS = {
        1: (200, 75),    # Top
        2: (120, 90),
        3: (75, 150),
        4: (120, 250),
        5: (200, 320),
        6: (280, 250),
        7: (325, 150),
        8: (280, 90),
        9: (140, 140),
        10: (140, 260),
        11: (260, 260),
        12: (260, 140)
    }

    H_SIGNS = {
        1: (200, 140),
        2: (120, 120),
        3: (100, 180),
        4: (120, 280),
        5: (200, 280),
        6: (280, 280),
        7: (300, 180),
        8: (280, 120),
        9: (150, 160),
        10: (150, 240),
        11: (250, 240),
        12: (250, 160)
    }

    # Draw houses
    for h in range(1, 13):

        s_idx = (lagna_idx + h - 1) % 12
        s_text = f"{s_idx + 1} {SIGN_ABBR[s_idx]}"

        draw.text(H_SIGNS[h], s_text, fill=TEXT_COLOR, font=font_s, anchor='mm')

        planets = house_planets.get(h, [])

        if planets:
            cx, cy = H_PLANETS[h]

            for i, p in enumerate(planets):
                offset = (i - (len(planets) - 1) / 2) * 18
                draw.text((cx, cy + offset), p, fill=TEXT_COLOR, font=font_p, anchor='mm')

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


# ---------------- MAIN ---------------- #
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
            args.lagna,
            args.moon_sign,
            args.nakshatra,
            planets
        )

        b64 = base64.b64encode(image_data).decode()
        print(f"IMAGE_BASE64: {b64}")

        # ImgBB upload (UNCHANGED)
        api_key = os.getenv("IMGBB_API_KEY")

        if api_key and api_key != "your_imgbb_key_here":
            try:
                payload = urllib.parse.urlencode({
                    "key": api_key,
                    "image": b64
                }).encode()

                req = urllib.request.Request(
                    "https://api.imgbb.com/1/upload",
                    data=payload
                )

                with urllib.request.urlopen(req, timeout=10) as res:
                    data = json.loads(res.read().decode())
                    print(f"IMAGE_URL: {data['data']['url']}")

            except:
                pass

    except Exception as e:
        print("Error:", e, file=sys.stderr)


if __name__ == "__main__":
    main()