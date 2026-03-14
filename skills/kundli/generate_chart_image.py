#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai>=1.0.0",
#     "pillow>=10.0.0",
# ]
# ///
"""
Generate Kundli Chart Images using Gemini 3 Pro Image (Nano Banana Pro).

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
    return os.environ.get("GEMINI_API_KEY")


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
    """Generate the kundli chart image using Gemini 3 Pro Image."""

    # Get API key
    api_key = get_api_key(api_key)
    if not api_key:
        print("Error: No API key provided.", file=sys.stderr)
        print("Please either:", file=sys.stderr)
        print("  1. Set GEMINI_API_KEY environment variable", file=sys.stderr)
        print("  2. Pass --api-key argument", file=sys.stderr)
        sys.exit(1)

    # Import after checking API key
    from google import genai
    from google.genai import types
    from PIL import Image as PILImage
    from io import BytesIO

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Create prompt
    prompt = create_chart_prompt(lagna, moon_sign, nakshatra)

    # Set up output path
    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating Kundli chart image...")
    print(f"Lagna: {lagna}, Moon Sign: {moon_sign}, Nakshatra: {nakshatra}")
    print(f"Resolution: {resolution}")

    try:
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
                image_config=types.ImageConfig(
                    image_size=resolution
                )
            )
        )

        # Process response and save image
        image_saved = False
        for part in response.parts:
            if part.text is not None:
                # Log any text response
                pass
            elif part.inline_data is not None:
                # Convert inline data to PIL Image and save as PNG
                image_data = part.inline_data.data
                if isinstance(image_data, str):
                    import base64
                    image_data = base64.b64decode(image_data)

                image = PILImage.open(BytesIO(image_data))

                # Ensure RGB mode for PNG
                if image.mode == 'RGBA':
                    rgb_image = PILImage.new('RGB', image.size, (255, 255, 255))
                    rgb_image.paste(image, mask=image.split()[3])
                    rgb_image.save(str(output_path), 'PNG')
                elif image.mode == 'RGB':
                    image.save(str(output_path), 'PNG')
                else:
                    image.convert('RGB').save(str(output_path), 'PNG')
                image_saved = True

        if image_saved:
            full_path = output_path.resolve()
            print(f"\nKundli chart image saved: {full_path}")
            # OpenClaw parses MEDIA tokens and will attach the file on supported providers
            print(f"MEDIA: {full_path}")
            return str(full_path)
        else:
            print("Error: No image was generated.", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Error generating chart image: {e}", file=sys.stderr)
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

    lagna_valid = any(sign.lower() in args.lagna.lower() for sign in astrology_signs)
    moon_valid = any(sign.lower() in args.moon_sign.lower() for sign in astrology_signs)

    if not lagna_valid or not moon_valid:
        print("Error: This script only generates astrology-related images (Kundli charts).", file=sys.stderr)
        print("Please provide valid zodiac signs for Lagna and Moon Sign.", file=sys.stderr)
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
