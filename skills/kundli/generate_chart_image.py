#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "openai>=1.0.0",
#     "pillow>=10.0.0",
#     "requests"
# ]
# ///
"""
Generate Kundli Chart Images using OpenAI DALL-E 3.

This script creates visual representations of Vedic astrology birth charts.
Only generates astrology-related images (kundli charts, birth charts, etc.).

Usage:
    python3 generate_chart_image.py --lagna "Leo" --moon-sign "Scorpio" --nakshatra "Anuradha" --filename "kundli_chart.png"
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime


def get_api_key(provided_key: str | None) -> str | None:
    """Get API key from argument first, then environment."""
    if provided_key:
        return provided_key
    return os.environ.get("OPENAI_API_KEY")


def create_chart_prompt(lagna: str, moon_sign: str, nakshatra: str, planets: list = None) -> str:
    """
    Create a detailed prompt for generating a kundli chart image.
    Only generates astrology-related content.
    """
    prompt = f"""Create a professional Vedic Astrology Birth Chart (Kundli) visualization with the following details:

**Lagna (Ascendant):** {lagna}
**Moon Sign (Rashi):** {moon_sign}
**Nakshatra (Birth Star):** {nakshatra}

The chart should include:
1. A traditional North Indian style chart grid (diamond format) with 12 houses
2. Clearly marked Ascendant (Lagna) in the first house
3. Moon sign position highlighted
4. Nakshatra symbol displayed prominently
5. Zodiac symbols for each house
6. Traditional Vedic astrology color scheme (deep blues, golds, reds)
7. Sanskrit numerals (1-12) for house numbers
8. Decorative border with traditional Indian motifs
9. Clean, professional astrological diagram style
10. Title "KUNDLI CHART" at the top

Style: Professional astrology chart, educational diagram, clean lines, traditional Vedic aesthetics."""

    return prompt


def generate_chart_image(lagna: str, moon_sign: str, nakshatra: str, filename: str, resolution: str = "2K", api_key: str = None):
    """Generate the kundli chart image using OpenAI DALL-E 3."""
    print("Initializing chart generation process and checking environment...", file=sys.stdout)
    sys.stdout.flush()

    # Get API key
    api_key = get_api_key(api_key)
    if not api_key:
        print("Error: No API key provided.", file=sys.stderr)
        print("Please either Set OPENAI_API_KEY environment variable or pass --api-key", file=sys.stderr)
        sys.exit(1)

    import requests
    from openai import OpenAI
    from PIL import Image as PILImage
    from io import BytesIO

    # Initialize client
    client = OpenAI(api_key=api_key)

    # Create prompt
    prompt = create_chart_prompt(lagna, moon_sign, nakshatra)

    # Save to current working directory.
    # With Runtime: direct, the script AND the Node.js server run in the SAME container.
    # CWD is ~/.openclaw/skills/kundli/ so the file at kundli.png is directly accessible
    # to loadWebMedia via tilde expansion.
    output_path = Path("kundli.png").resolve()
    tilde_path = "~/.openclaw/skills/kundli/kundli.png"

    print(f"Generating Kundli chart image using DALL-E 3...")
    print(f"Lagna: {lagna}, Moon Sign: {moon_sign}, Nakshatra: {nakshatra}")
    sys.stdout.flush()

    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )

        image_url = response.data[0].url
        if not image_url:
            print("Error: No image URL returned from DALL-E 3.", file=sys.stderr)
            sys.exit(1)
            
        print("Image generated successfully!", file=sys.stdout)
        print(f"MEDIA: {image_url}", file=sys.stdout)
        sys.stdout.flush()
        return image_url

    except Exception as e:
        print(f"Error generating chart image: {e}", file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate Kundli Chart Images (Vedic Astrology Birth Charts)"
    )
    parser.add_argument(
        "--lagna",
        required=True,
        help="Ascendant sign (e.g., Leo, Scorpio, Aries)"
    )
    parser.add_argument(
        "--moon-sign",
        required=True,
        help="Moon sign/Rashi (e.g., Scorpio, Pisces, Cancer)"
    )
    parser.add_argument(
        "--nakshatra",
        required=True,
        help="Birth star/Nakshatra (e.g., Anuradha, Rohini, Ashwini)"
    )
    parser.add_argument(
        "--filename", "-f",
        default=None,
        help="Output filename (default: kundli-chart-YYYY-MM-DD-HHMMSS.png)"
    )
    parser.add_argument(
        "--resolution", "-r",
        choices=["1K", "2K", "4K"],
        default="2K",
        help="Output resolution (default: 2K)"
    )
    parser.add_argument(
        "--api-key", "-k",
        help="Gemini API key (overrides GEMINI_API_KEY env var)"
    )

    args = parser.parse_args()

    # Generate filename if not provided
    if args.filename is None:
        timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
        args.filename = f"kundli-chart-{timestamp}.png"

    # Validate that this is an astrology-related request
    astrology_signs = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
        "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
        "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"
    ]

    lagna_valid = any(args.lagna.lower().strip() in sign.lower() for sign in astrology_signs)
    moon_valid = any(args.moon_sign.lower().strip() in sign.lower() for sign in astrology_signs)

    if not lagna_valid or not moon_valid:
        print("Error: This script only generates astrology-related images (Kundli charts).", file=sys.stderr)
        print(f"Lagna '{args.lagna}' or Moon Sign '{args.moon_sign}' is not recognized.", file=sys.stderr)
        sys.exit(1)

    # Generate the chart
    generate_chart_image(
        lagna=args.lagna,
        moon_sign=args.moon_sign,
        nakshatra=args.nakshatra,
        filename=args.filename,
        resolution=args.resolution,
        api_key=args.api_key
    )


if __name__ == "__main__":
    main()
