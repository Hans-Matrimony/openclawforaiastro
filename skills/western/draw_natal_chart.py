#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate a Western natal chart wheel image.

Outputs either:
  IMAGE_URL: <stored image url>
or, if storage is unavailable:
  MEDIA_BASE64: image/png <base64>
"""

import argparse
import ast
import base64
import json
import math
import os
import struct
import sys
import urllib.request
import zlib
from io import BytesIO

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None
    ImageDraw = None
    ImageFont = None


SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

SIGN_ABBR = {
    "Aries": "Ari", "Taurus": "Tau", "Gemini": "Gem", "Cancer": "Can",
    "Leo": "Leo", "Virgo": "Vir", "Libra": "Lib", "Scorpio": "Sco",
    "Sagittarius": "Sag", "Capricorn": "Cap", "Aquarius": "Aqu", "Pisces": "Pis",
}

PLANET_ABBR = {
    "Sun": "Sun", "Moon": "Moon", "Mercury": "Mer", "Venus": "Ven",
    "Mars": "Mars", "Jupiter": "Jup", "Saturn": "Sat", "Uranus": "Ura",
    "Neptune": "Nep", "Pluto": "Plu",
}

FONT_5X7 = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def load_font(size, bold=False):
    candidates = []
    if sys.platform == "win32":
        candidates.extend([
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        ])
    candidates.extend([
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ])
    for path in candidates:
        if path and os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def text_center(draw, xy, text, font, fill):
    try:
        draw.text(xy, text, font=font, fill=fill, anchor="mm")
    except TypeError:
        box = draw.textbbox((0, 0), text, font=font)
        w = box[2] - box[0]
        h = box[3] - box[1]
        draw.text((xy[0] - w / 2, xy[1] - h / 2), text, font=font, fill=fill)


def rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def png_from_pixels(width, height, pixels):
    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride:(y + 1) * stride])
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def fallback_set_pixel(pixels, width, height, x, y, color):
    if 0 <= x < width and 0 <= y < height:
        index = (y * width + x) * 3
        pixels[index:index + 3] = bytes(color)


def fallback_line(pixels, width, height, x0, y0, x1, y1, color):
    x0, y0, x1, y1 = map(int, (x0, y0, x1, y1))
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        for ox in (0, 1):
            for oy in (0, 1):
                fallback_set_pixel(pixels, width, height, x0 + ox, y0 + oy, color)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def fallback_circle(pixels, width, height, cx, cy, radius, color):
    steps = max(180, int(radius * 3))
    previous = None
    for step in range(steps + 1):
        angle = (2 * math.pi * step) / steps
        point = (cx + radius * math.cos(angle), cy + radius * math.sin(angle))
        if previous:
            fallback_line(pixels, width, height, previous[0], previous[1], point[0], point[1], color)
        previous = point


def fallback_text(pixels, width, height, x, y, text, color, scale=2, center=True):
    text = str(text).upper()
    char_width = 6 * scale
    total_width = len(text) * char_width
    start_x = int(x - total_width / 2) if center else int(x)
    start_y = int(y - 7 * scale / 2) if center else int(y)
    for char_index, char in enumerate(text):
        glyph = FONT_5X7.get(char, FONT_5X7[" "])
        for row_index, row in enumerate(glyph):
            for col_index, value in enumerate(row):
                if value != "1":
                    continue
                px = start_x + char_index * char_width + col_index * scale
                py = start_y + row_index * scale
                for sx in range(scale):
                    for sy in range(scale):
                        fallback_set_pixel(pixels, width, height, px + sx, py + sy, color)


def draw_chart_fallback(chart):
    size = 720
    center = size // 2
    outer = 310
    middle = 240
    inner = 118
    bg = rgb("#0f172a")
    line = rgb("#94a3b8")
    muted = rgb("#cbd5e1")
    text = rgb("#f8fafc")
    accent = rgb("#f59e0b")
    planet_color = rgb("#38bdf8")

    pixels = bytearray(bg * (size * size))
    fallback_circle(pixels, size, size, center, center, outer, line)
    fallback_circle(pixels, size, size, center, center, middle, rgb("#475569"))
    fallback_circle(pixels, size, size, center, center, inner, accent)

    for index, sign in enumerate(SIGNS):
        start_angle = -90 + index * 30
        mid_angle = start_angle + 15
        rad = math.radians(start_angle)
        fallback_line(
            pixels, size, size,
            center, center,
            center + outer * math.cos(rad),
            center + outer * math.sin(rad),
            rgb("#334155"),
        )
        label_rad = math.radians(mid_angle)
        fallback_text(
            pixels, size, size,
            center + 278 * math.cos(label_rad),
            center + 278 * math.sin(label_rad),
            SIGN_ABBR[sign],
            text,
            scale=3,
        )

    grouped = {sign: [] for sign in SIGNS}
    for item in chart.get("planets", []):
        planet = item.get("planet") or item.get("name")
        sign = normalize_sign(item.get("sign"))
        if planet and sign:
            grouped.setdefault(sign, []).append(PLANET_ABBR.get(planet, planet[:4]))

    for index, sign in enumerate(SIGNS):
        planets = grouped.get(sign) or []
        if not planets:
            continue
        label_rad = math.radians(-90 + index * 30 + 15)
        px = center + 190 * math.cos(label_rad)
        py = center + 190 * math.sin(label_rad)
        visible = planets[:3]
        for offset, name in enumerate(visible):
            fallback_text(pixels, size, size, px, py + offset * 17 - (len(visible) - 1) * 8, name, planet_color, scale=2)

    fallback_text(pixels, size, size, center, center - 52, "WESTERN", text, scale=4)
    fallback_text(pixels, size, size, center, center - 15, "NATAL CHART", text, scale=3)
    fallback_text(pixels, size, size, center, center + 32, f"SUN: {chart.get('sun_sign') or 'UNKNOWN'}", muted, scale=2)
    fallback_text(pixels, size, size, center, center + 55, f"MOON: {chart.get('moon_sign') or 'UNKNOWN'}", muted, scale=2)
    fallback_text(pixels, size, size, center, center + 78, f"RISING: {chart.get('ascendant') or 'UNKNOWN'}", muted, scale=2)

    return png_from_pixels(size, size, pixels)


def parse_json_value(value):
    if not value:
        return None
    if os.path.exists(value):
        with open(value, "r", encoding="utf-8") as handle:
            return json.load(handle)
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        cleaned = value.replace('\\"', '"')
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            try:
                return ast.literal_eval(cleaned)
            except Exception as exc:
                print(f"WARNING: could not parse JSON value: {exc}", file=sys.stderr)
                return None


def normalize_sign(sign):
    if not sign:
        return None
    sign = str(sign).strip().title()
    return sign if sign in SIGNS else None


def chart_from_args(args):
    chart = {}
    if args.chart_json:
        chart = parse_json_value(args.chart_json) or {}

    planets = []
    raw_planets = chart.get("planets") or {}
    if isinstance(raw_planets, dict):
        for planet, data in raw_planets.items():
            if isinstance(data, dict) and data.get("sign"):
                planets.append({
                    "planet": planet,
                    "sign": data.get("sign"),
                    "position_in_sign": data.get("position_in_sign"),
                })

    if args.planets:
        parsed = parse_json_value(args.planets)
        if isinstance(parsed, list):
            planets.extend(parsed)
        elif isinstance(parsed, dict):
            for planet, sign in parsed.items():
                if isinstance(sign, dict):
                    planets.append({"planet": planet, "sign": sign.get("sign")})
                else:
                    planets.append({"planet": planet, "sign": sign})

    if args.sun:
        planets.append({"planet": "Sun", "sign": args.sun})
    if args.moon:
        planets.append({"planet": "Moon", "sign": args.moon})

    sun = normalize_sign(args.sun or chart.get("sun_sign"))
    moon = normalize_sign(args.moon or chart.get("moon_sign"))
    ascendant = normalize_sign(args.ascendant or chart.get("ascendant"))

    if not sun:
        for item in planets:
            if item.get("planet") == "Sun":
                sun = normalize_sign(item.get("sign"))
                break
    if not moon:
        for item in planets:
            if item.get("planet") == "Moon":
                moon = normalize_sign(item.get("sign"))
                break

    return {
        "name": args.name or chart.get("name") or "User",
        "sun_sign": sun,
        "moon_sign": moon,
        "ascendant": ascendant,
        "planets": planets,
        "birth_data": chart.get("birth_data") or {},
    }


def draw_chart(chart):
    if Image is None:
        return draw_chart_fallback(chart)

    size = 900
    center = size // 2
    outer = 390
    middle = 305
    inner = 145

    bg = "#0f172a"
    panel = "#111827"
    line = "#94a3b8"
    muted = "#cbd5e1"
    text = "#f8fafc"
    accent = "#f59e0b"
    planet_color = "#38bdf8"

    img = Image.new("RGB", (size, size), bg)
    draw = ImageDraw.Draw(img)

    font_title = load_font(34, bold=True)
    font_label = load_font(22, bold=True)
    font_small = load_font(18)
    font_tiny = load_font(15)
    font_planet = load_font(17, bold=True)

    draw.ellipse([center - outer, center - outer, center + outer, center + outer], outline=line, width=3)
    draw.ellipse([center - middle, center - middle, center + middle, center + middle], outline="#475569", width=2)
    draw.ellipse([center - inner, center - inner, center + inner, center + inner], fill=panel, outline=accent, width=3)

    for index, sign in enumerate(SIGNS):
        start_angle = -90 + index * 30
        mid_angle = start_angle + 15
        rad = math.radians(start_angle)
        x = center + outer * math.cos(rad)
        y = center + outer * math.sin(rad)
        draw.line([center, center, x, y], fill="#334155", width=1)

        label_rad = math.radians(mid_angle)
        lx = center + 350 * math.cos(label_rad)
        ly = center + 350 * math.sin(label_rad)
        text_center(draw, (lx, ly), SIGN_ABBR[sign], font_label, text)

    grouped = {sign: [] for sign in SIGNS}
    for item in chart.get("planets", []):
        planet = item.get("planet") or item.get("name")
        sign = normalize_sign(item.get("sign"))
        if not planet or not sign:
            continue
        grouped.setdefault(sign, []).append(PLANET_ABBR.get(planet, planet[:4]))

    for index, sign in enumerate(SIGNS):
        planets = grouped.get(sign) or []
        if not planets:
            continue
        mid_angle = -90 + index * 30 + 15
        label_rad = math.radians(mid_angle)
        px = center + 245 * math.cos(label_rad)
        py = center + 245 * math.sin(label_rad)
        visible = planets[:4]
        for offset, name in enumerate(visible):
            text_center(draw, (px, py + offset * 20 - (len(visible) - 1) * 10), name, font_planet, planet_color)

    text_center(draw, (center, center - 58), "Western", font_title, text)
    text_center(draw, (center, center - 20), "Natal Chart", font_title, text)

    summary_lines = [
        f"Sun: {chart.get('sun_sign') or 'Unknown'}",
        f"Moon: {chart.get('moon_sign') or 'Unknown'}",
        f"Rising: {chart.get('ascendant') or 'Unknown'}",
    ]
    for i, line_text in enumerate(summary_lines):
        text_center(draw, (center, center + 30 + i * 26), line_text, font_small, muted)

    birth_data = chart.get("birth_data") or {}
    footer_bits = []
    if birth_data.get("date"):
        footer_bits.append(str(birth_data["date"]))
    if birth_data.get("time"):
        footer_bits.append(str(birth_data["time"]))
    if birth_data.get("place"):
        footer_bits.append(str(birth_data["place"]))
    if footer_bits:
        text_center(draw, (center, size - 32), " | ".join(footer_bits), font_tiny, muted)

    output = BytesIO()
    img.save(output, "PNG")
    return output.getvalue()


def store_image(image_b64, user_id, session_id, chart):
    mongo_logger_url = os.getenv("MONGO_LOGGER_URL", "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com").rstrip("/")
    payload = {
        "userId": user_id,
        "sessionId": session_id or f"whatsapp:{user_id}",
        "imageBase64": f"data:image/png;base64,{image_b64}",
        "birthDetails": chart.get("birth_data") or {},
        "kundliData": {
            "chart_type": "western_natal_chart",
            "sun_sign": chart.get("sun_sign"),
            "moon_sign": chart.get("moon_sign"),
            "ascendant": chart.get("ascendant"),
        },
        "chartType": "western_natal_chart",
        "format": "png",
    }
    request = urllib.request.Request(
        f"{mongo_logger_url}/kundli-image",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("success") and result.get("fileId"):
        return f"{mongo_logger_url}/kundli-image/{result['fileId']}"
    return None


def main():
    parser = argparse.ArgumentParser(description="Generate Western natal chart wheel image")
    parser.add_argument("--chart-json", help="Chart JSON string or path from natal_chart.py --json")
    parser.add_argument("--planets", help="Planet placements JSON list or object")
    parser.add_argument("--sun", help="Sun sign")
    parser.add_argument("--moon", help="Moon sign")
    parser.add_argument("--ascendant", help="Ascendant/rising sign")
    parser.add_argument("--name", help="User name")
    parser.add_argument("--user-id", help="User ID for image storage")
    parser.add_argument("--session-id", help="Session ID for image storage")
    parser.add_argument("--output", help="Optional path to write PNG file")
    args = parser.parse_args()

    chart = chart_from_args(args)
    image_bytes = draw_chart(chart)

    if args.output:
        with open(args.output, "wb") as handle:
            handle.write(image_bytes)

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    stored_url = None
    if args.user_id:
        try:
            stored_url = store_image(image_b64, args.user_id, args.session_id, chart)
        except Exception as exc:
            print(f"WARNING: image storage failed: {exc}", file=sys.stderr)

    if stored_url:
        print(f"IMAGE_URL: {stored_url}")
    else:
        print(f"MEDIA_BASE64: image/png {image_b64}")


if __name__ == "__main__":
    main()
