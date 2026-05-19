#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate a lightweight Western natal chart PDF report.

Outputs:
  MEDIA_BASE64: application/pdf <base64>
"""

import argparse
import base64
import json
import os
import sys
import textwrap

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)


def pdf_escape(value):
    text = str(value)
    text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return text.encode("latin-1", errors="replace").decode("latin-1")


def wrap_lines(lines, width=92):
    wrapped = []
    for line in lines:
        if not line:
            wrapped.append("")
        else:
            wrapped.extend(textwrap.wrap(str(line), width=width) or [""])
    return wrapped


def build_pdf(lines, title="Western Natal Chart Report"):
    lines = wrap_lines(lines)
    per_page = 44
    pages = [lines[i:i + per_page] for i in range(0, len(lines), per_page)] or [[]]
    objects = []

    def add_object(body):
        objects.append(body)
        return len(objects)

    add_object("<< /Type /Catalog /Pages 2 0 R >>")
    pages_id = add_object("")
    font_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    bold_font_id = add_object("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    page_ids = []
    for page_index, page_lines in enumerate(pages, start=1):
        stream_lines = [
            "BT",
            "/F2 18 Tf",
            "50 790 Td",
            f"({pdf_escape(title)}) Tj",
            "/F1 10 Tf",
            "0 -26 Td",
        ]
        for item in page_lines:
            stream_lines.append(f"({pdf_escape(item)}) Tj")
            stream_lines.append("0 -15 Td")
        stream_lines.extend([
            "/F1 8 Tf",
            "0 -12 Td",
            f"(Page {page_index} of {len(pages)}) Tj",
            "ET",
        ])
        stream = "\n".join(stream_lines)
        content = f"<< /Length {len(stream.encode('latin-1', errors='replace'))} >>\nstream\n{stream}\nendstream"
        content_id = add_object(content)
        page_id = add_object(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_id} 0 R /F2 {bold_font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )
        page_ids.append(page_id)

    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{pid} 0 R' for pid in page_ids)}] /Count {len(page_ids)} >>"

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(body.encode("latin-1", errors="replace"))
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )
    return bytes(pdf)


def parse_json_value(value):
    if not value:
        return None
    if os.path.exists(value):
        with open(value, "r", encoding="utf-8") as handle:
            return json.load(handle)
    return json.loads(value)


def load_chart(args):
    if args.chart_json:
        chart = parse_json_value(args.chart_json) or {}
    elif args.dob and args.tob and args.place:
        from natal_chart import calculate_natal_chart
        chart = calculate_natal_chart(args.dob, args.tob, args.place)
        if chart.get("error"):
            raise SystemExit(f"Error: {chart['error']}")
    else:
        chart = {}

    if args.name:
        chart["name"] = args.name
    if args.sun:
        chart["sun_sign"] = args.sun.title()
    if args.moon:
        chart["moon_sign"] = args.moon.title()
    if args.ascendant:
        chart["ascendant"] = args.ascendant.title()
    return chart


def chart_lines(chart):
    lines = []
    name = chart.get("name") or "User"
    birth = chart.get("birth_data") or {}

    lines.extend([
        f"Name: {name}",
        f"Date: {birth.get('date', 'Not provided')}",
        f"Time: {birth.get('time', 'Not provided')}",
        f"Place: {birth.get('place', 'Not provided')}",
        "",
        "Core placements",
        f"Sun sign: {chart.get('sun_sign', 'Unknown')}",
        f"Moon sign: {chart.get('moon_sign', 'Unknown')}",
        f"Ascendant/Rising: {chart.get('ascendant', 'Unknown')}",
        "",
        "Interpretation",
    ])

    try:
        from western_interpretations import generate_chart_summary
        summary = generate_chart_summary(chart)
        if summary:
            lines.append(summary)
    except Exception:
        lines.append("Your Western natal chart highlights identity, emotional needs, and life direction.")

    planets = chart.get("planets") or {}
    if isinstance(planets, dict) and planets:
        lines.extend(["", "Planetary positions"])
        for planet in ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]:
            data = planets.get(planet)
            if isinstance(data, dict) and data.get("sign"):
                position = data.get("position_in_sign")
                suffix = f" at {position} degrees" if position is not None else ""
                lines.append(f"{planet}: {data.get('sign')}{suffix}")

    aspects = chart.get("aspects") or []
    if aspects:
        lines.extend(["", "Major aspects"])
        for aspect in aspects[:12]:
            lines.append(
                f"{aspect.get('planet1')} {aspect.get('aspect')} {aspect.get('planet2')}"
                f" (orb {aspect.get('orb')})"
            )

    sun = chart.get("sun_sign")
    if sun:
        try:
            from western_remedies import get_affirmations, get_color_therapy, get_crystal_recommendation
            lines.extend(["", "Supportive remedies"])
            colors = get_color_therapy(sun)
            if colors:
                lines.append(f"Color support: {colors.get('wear') or colors.get('primary')}")
            crystals = get_crystal_recommendation(sun)
            if crystals:
                names = [item.get("name", "") for item in crystals[:3] if item.get("name")]
                if names:
                    lines.append("Crystals: " + ", ".join(names))
            affirmations = get_affirmations(sun, 2)
            if affirmations:
                lines.append("Affirmations:")
                lines.extend([f"- {item}" for item in affirmations])
        except Exception:
            pass

    lines.extend([
        "",
        "Note",
        "Western astrology uses the tropical zodiac. This report is for reflection and self-understanding.",
    ])
    return lines


def main():
    parser = argparse.ArgumentParser(description="Generate Western natal chart PDF")
    parser.add_argument("--chart-json", help="Chart JSON string or path from natal_chart.py --json")
    parser.add_argument("--dob", help="Date of birth YYYY-MM-DD")
    parser.add_argument("--tob", help="Time of birth HH:MM")
    parser.add_argument("--place", help="Birth place")
    parser.add_argument("--name", help="User name")
    parser.add_argument("--sun", help="Sun sign fallback")
    parser.add_argument("--moon", help="Moon sign fallback")
    parser.add_argument("--ascendant", help="Ascendant fallback")
    parser.add_argument("--output", help="Optional path to write PDF file")
    args = parser.parse_args()

    chart = load_chart(args)
    pdf_bytes = build_pdf(chart_lines(chart))

    if args.output:
        with open(args.output, "wb") as handle:
            handle.write(pdf_bytes)

    encoded = base64.b64encode(pdf_bytes).decode("ascii")
    print(f"MEDIA_BASE64: application/pdf {encoded}")


if __name__ == "__main__":
    main()
