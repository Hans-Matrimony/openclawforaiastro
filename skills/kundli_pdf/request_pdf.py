#!/usr/bin/env python3
"""
Kundli PDF Request Script
This script formats and outputs the PDF_REQUEST message that the backend will detect.
"""

import sys
import json

def main():
    """
    Output PDF_REQUEST message in the format that backend detects.
    This message will be included in the AI's response and detected by tasks.py
    """
    # Parse command line arguments
    if len(sys.argv) < 4:
        print("Usage: python3 request_pdf.py <dob> <tob> <place> [<name>]")
        print("Example: python3 request_pdf.py 2002-02-16 00:00 Meerut Vardhan")
        sys.exit(1)

    dob = sys.argv[1]
    tob = sys.argv[2]
    place = sys.argv[3]
    name = sys.argv[4] if len(sys.argv) > 4 else "User"

    # Output the message in the exact format the backend detects
    message = f"PDF_REQUEST: dob={dob}, tob={tob}, place={place}, name={name}"

    # Print to stdout - this will be included in AI's response
    print(message)
    print()
    print("✓ PDF generation request sent successfully!")
    print("✓ The PDF will be generated and sent to your WhatsApp in 2-3 minutes.")
    print()
    print("What happens next:")
    print("• Backend will detect this PDF_REQUEST message")
    print("• Your Kundli will be calculated with detailed planetary positions")
    print("• A 5-page PDF will be generated with:")
    print("  - Birth Charts (Lagna + Navamsa)")
    print("  - Planetary Positions table")
    print("  - Life Predictions (Career, Marriage, Health, Wealth)")
    print("  - Astrological Remedies (Gemstones, Mantras)")
    print("• The PDF will be uploaded and sent to your WhatsApp")

if __name__ == "__main__":
    main()
