#!/usr/bin/env python3
"""
Generate traditional North Indian Kundli chart with exact format
Outputs image as base64 for WhatsApp delivery
"""
import os
import sys
import argparse
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

# House positions in the North Indian diamond layout
# In North Indian format, houses are FIXED (signs move based on Lagna)
# House 1 is always at the top corner, numbering goes counter-clockwise
HOUSE_POSITIONS = {
    1: (400, 130),   # Top corner triangle
    12: (480, 180),  # Upper right side
    11: (320, 180),  # Upper left side
    10: (240, 240),  # Left corner
    2: (350, 230),   # Inner upper left
    3: (350, 280),   # Inner lower left
    9: (440, 230),   # Inner upper right
    8: (440, 280),   # Inner lower right
    4: (250, 360),   # Lower left side
    5: (300, 430),   # Bottom corner
    6: (500, 430),   # Bottom right side
    7: (550, 360),   # Right corner
}

# Devanagari numerals
DEVANAGARI_NUMERALS = {
    1: '१', 2: '२', 3: '३', 4: '४', 5: '५',
    6: '६', 7: '७', 8: '८', 9: '९', 10: '१०',
    11: '११', 12: '१२'
}

# Planet abbreviations with colors
PLANET_COLORS = {
    'Su': '#FF6B6B',  # Sun - Red
    'Mo': '#C0C0C0',  # Moon - Silver
    'Ma': '#FF4444',  # Mars - Dark Red
    'Me': '#4ECDC4',  # Mercury - Green
    'Ju': '#FFE66D',  # Jupiter - Yellow
    'Ve': '#FFB6C1',  # Venus - Pink
    'Sa': '#8B4513',  # Saturn - Brown
    'Ra': '#4B0082',  # Rahu - Purple
    'Ke': '#808080',  # Ketu - Gray
}

# Zodiac signs (English to Hindi mapping)
ZODIAC_HINDI = {
    'Aries': 'Mesha', 'Taurus': 'Vrishabh', 'Gemini': 'Mithun',
    'Cancer': 'Karka', 'Leo': 'Simha', 'Virgo': 'Kanya',
    'Libra': 'Tula', 'Scorpio': 'Vrishchika', 'Sagittarius': 'Dhanu',
    'Capricorn': 'Makar', 'Aquarius': 'Kumbh', 'Pisces': 'Meen'
}


def parse_planet_positions(planets_list):
    """Parse planet positions from calculate.py output"""
    house_planets = {}

    for planet_str in planets_list:
        try:
            parts = planet_str.split()
            planet_name = parts[0]

            planet_map = {
                'Saturn': 'Sa', 'Jupiter': 'Ju', 'Rahu': 'Ra',
                'Ketu': 'Ke', 'Mercury': 'Me', 'Sun': 'Su',
                'Venus': 'Ve', 'Moon': 'Mo', 'Mars': 'Ma'
            }

            abbrev = planet_map.get(planet_name, planet_name[:2])

            if "is in House" in planet_str:
                house_idx = parts.index("is") + 3
                house_num = int(parts[house_idx])

                if house_num not in house_planets:
                    house_planets[house_num] = []
                house_planets[house_num].append(abbrev)
        except Exception:
            continue

    return house_planets


def get_zodiac_sequence(lagna):
    """Get zodiac signs in order starting from Lagna"""
    zodiac_order = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ]

    try:
        start_idx = zodiac_order.index(lagna)
    except ValueError:
        start_idx = 0

    # Rotate to start from Lagna
    rotated = zodiac_order[start_idx:] + zodiac_order[:start_idx]
    return rotated


def draw_planets(draw, house_planets):
    """Draw planets in their houses"""
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf", 28)
    except:
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
        except:
            font_large = ImageFont.load_default()

    for house_num, planets in house_planets.items():
        if house_num in HOUSE_POSITIONS:
            x, y = HOUSE_POSITIONS[house_num]
            for i, planet in enumerate(planets):
                color = PLANET_COLORS.get(planet, '#000000')
                offset_y = i * 30
                draw.text((x, y + offset_y), planet, fill=color, font=font_large)


def draw_kundli_chart(lagna, moon_sign, nakshatra, planet_positions=None):
    """Draw traditional North Indian Kundli chart"""
    img_width, img_height = 800, 600
    img = Image.new('RGB', (img_width, img_height), color='white')
    draw = ImageDraw.Draw(img)

    house_planets = {}
    if planet_positions:
        house_planets = parse_planet_positions(planet_positions)

    # Get fonts
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf", 24)
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf", 28)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoSansDevanagari.ttf", 16)
    except:
        try:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            font_title = font_large = font_small = ImageFont.load_default()

    # Draw title
    lagna_hindi = ZODIAC_HINDI.get(lagna, lagna)
    moon_hindi = ZODIAC_HINDI.get(moon_sign, moon_sign)
    title = f"Kundli - Lagna: {lagna_hindi}, Moon: {moon_hindi}"
    draw.text((400, 30), title, fill='black', font=font_title, anchor='mt')

    # Draw nakshatra
    draw.text((400, 60), f"Nakshatra: {nakshatra}", fill='blue', font=font_small, anchor='mt')

    # Draw proper North Indian Kundli grid
    center_x, center_y = 400, 300

    # Outer diamond boundary
    outer_points = [(center_x, 100), (600, 300), (center_x, 500), (200, 300)]
    draw.polygon(outer_points, outline='black', width=3)

    # Calculate midpoints for proper segmentation
    top_mid = (center_x, 200)      # Midpoint between (400,100) and (400,300)
    right_mid = (500, 300)         # Midpoint between (600,300) and (400,300)
    bottom_mid = (center_x, 400)   # Midpoint between (400,500) and (400,300)
    left_mid = (300, 300)          # Midpoint between (200,300) and (400,300)

    # Draw lines from corners to center (proper diamond segmentation)
    # Top corner to center
    draw.line([(center_x, 100), (center_x, center_y)], fill='black', width=2)
    # Bottom corner to center
    draw.line([(center_x, 500), (center_x, center_y)], fill='black', width=2)
    # Left corner to center
    draw.line([(200, 300), (center_x, center_y)], fill='black', width=2)
    # Right corner to center
    draw.line([(600, 300), (center_x, center_y)], fill='black', width=2)

    # Draw the inner diamond (connecting midpoints) to create central houses
    inner_points = [top_mid, right_mid, bottom_mid, left_mid]
    draw.polygon(inner_points, outline='black', width=2)

    # Draw lines dividing the inner diamond into 4 sections (for houses 11, 12, and their adjacent houses)
    draw.line([(center_x, top_mid[1]), (center_x, bottom_mid[1])], fill='black', width=2)  # Vertical
    draw.line([(left_mid[0], center_y), (right_mid[0], center_y)], fill='black', width=2)  # Horizontal

    # Draw house numbers (Devanagari)
    for house_num, (x, y) in HOUSE_POSITIONS.items():
        devanagari_num = DEVANAGARI_NUMERALS.get(house_num, str(house_num))
        draw.text((x, y), devanagari_num, fill='blue', font=font_large, anchor='mm')

    # Draw planets
    draw_planets(draw, house_planets)

    # Draw border
    draw.rectangle([(10, 10), (img_width - 10, img_height - 10)], outline='black', width=3)

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
        import json
        try:
            planet_positions = json.loads(args.planets)
        except json.JSONDecodeError:
            planet_positions = []

    print(f"Generating traditional Kundli: Lagna={args.lagna}, Moon={args.moon_sign}", file=sys.stderr)

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
        print(f"✓ Generated {len(image_bytes)} bytes", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
