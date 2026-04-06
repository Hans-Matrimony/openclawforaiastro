#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "reportlab>=4.0.0"
# ]
# ///
"""
Generate Kundli PDF Reports using ReportLab.

This script creates detailed 5-page Janam Kundli PDF reports with:
- Birth Charts (Lagna + Navamsa)
- Planetary Positions
- Life Predictions
- Astrological Remedies

Usage:
    python3 generate_pdf.py --dob "2002-02-16" --tob "00:00" --place "Meerut" --name "Vardhan"
"""

import argparse
import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime
from io import BytesIO


def calculate_kundli_data(dob: str, tob: str, place: str) -> dict:
    """Calculate kundli by calling calculate.py as a subprocess."""
    # Get the path to calculate.py
    kundli_dir = Path(__file__).parent.parent / "kundli"
    calculate_script = kundli_dir / "calculate.py"

    if not calculate_script.exists():
        raise FileNotFoundError(f"Could not find calculate.py at {calculate_script}")

    # Run calculate.py as a subprocess
    try:
        result = subprocess.run(
            [sys.executable, str(calculate_script), "--dob", dob, "--tob", tob, "--place", place],
            capture_output=True,
            text=True,
            timeout=60,
            check=True
        )

        # Parse the JSON output
        output_lines = result.stdout.strip().split('\n')

        # Find JSON output (usually the last line or contains metadata)
        json_output = None
        for line in output_lines:
            line = line.strip()
            if line.startswith('{') and line.endswith('}'):
                try:
                    json_output = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue

        if json_output:
            return json_output
        else:
            # If no JSON found, try parsing the entire output
            try:
                return json.loads(result.stdout.strip())
            except json.JSONDecodeError:
                raise ValueError("Could not parse kundli calculation output")

    except subprocess.TimeoutExpired:
        raise TimeoutError("Kundli calculation timed out")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Kundli calculation failed: {e.stderr}")


def generate_pdf(dob: str, tob: str, place: str, name: str = "User"):
    """Generate the Kundli PDF report."""
    print("Initializing PDF generation process...", file=sys.stdout)
    sys.stdout.flush()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        print("Dependencies loaded successfully.", file=sys.stdout)
    except ImportError as e:
        print(f"Installing missing dependencies: {e}", file=sys.stdout)
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--break-system-packages", "-q",
                             "reportlab>=4.0.0"])
        print("Dependencies installed successfully.", file=sys.stdout)
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

    print(f"Calculating Kundli for {name}...", file=sys.stdout)
    print(f"DOB: {dob}, TOB: {tob}, Place: {place}", file=sys.stdout)
    sys.stdout.flush()

    # Calculate kundli
    try:
        kundli_data = calculate_kundli_data(dob, tob, place)
        print("Kundli calculated successfully!", file=sys.stdout)
    except Exception as e:
        print(f"Error calculating kundli: {e}", file=sys.stderr)
        sys.exit(1)

    # Create PDF buffer
    pdf_buffer = BytesIO()

    # Create PDF document
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    # Container for PDF elements
    elements = []

    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.darkblue,
        alignment=TA_CENTER,
        spaceAfter=30
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.darkblue,
        spaceAfter=12
    )
    normal_style = styles['Normal']

    # =============================================================================
    # PAGE 1: Title Page
    # =============================================================================

    elements.append(Spacer(1, 1*inch))

    # Title
    elements.append(Paragraph("जन्म कुंडली (Janam Kundli)", title_style))
    elements.append(Paragraph(f"Detailed Birth Chart Report", ParagraphStyle(
        'CustomTitle2',
        parent=styles['Heading2'],
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=30
    )))

    elements.append(Spacer(1, 0.5*inch))

    # User details table
    details_data = [
        ["Name:", name],
        ["Date of Birth:", dob],
        ["Time of Birth:", tob],
        ["Place of Birth:", place],
        ["Lagna (Ascendant):", kundli_data.get('lagna', 'N/A')],
        ["Moon Sign (Rashi):", kundli_data.get('moon_sign', 'N/A')],
        ["Nakshatra:", kundli_data.get('nakshatra', 'N/A')],
    ]

    details_table = Table(details_data, colWidths=[2.5*inch, 3*inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightblue),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))

    elements.append(details_table)
    elements.append(Spacer(1, 0.5*inch))

    # Footer
    elements.append(Paragraph("Generated by Hans Astrology Services", ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.gray
    )))

    # =============================================================================
    # PAGE 2: Planetary Positions
    # =============================================================================

    elements.append(PageBreak())

    elements.append(Paragraph("Planetary Positions", heading_style))
    elements.append(Spacer(1, 0.2*inch))

    # Planetary positions table
    planets = kundli_data.get('planets', [])

    # Create table data
    planet_data = [["Planet", "Sign", "House", "Nakshatra", "Degree"]]

    planet_mapping = {
        "Sun": "Surya (Sun)",
        "Moon": "Chandra (Moon)",
        "Mars": "Mangal (Mars)",
        "Mercury": "Budh (Mercury)",
        "Jupiter": "Guru (Jupiter)",
        "Venus": "Shukra (Venus)",
        "Saturn": "Shani (Saturn)",
        "Rahu": "Rahu",
        "Ketu": "Ketu"
    }

    for planet in planets:
        planet_name = planet.get('planet', '')
        display_name = planet_mapping.get(planet_name, planet_name)
        sign = planet.get('sign', 'N/A')
        house = planet.get('house', 'N/A')
        nakshatra = planet.get('nakshatra', 'N/A')
        degree = planet.get('degree', 'N/A')

        planet_data.append([display_name, sign, house, nakshatra, degree])

    planet_table = Table(planet_data, colWidths=[1.2*inch, 1.2*inch, 0.8*inch, 1.8*inch, 1*inch])
    planet_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
    ]))

    elements.append(planet_table)

    # =============================================================================
    # PAGE 3-4: Life Predictions
    # =============================================================================

    elements.append(PageBreak())

    elements.append(Paragraph("Life Predictions", heading_style))
    elements.append(Spacer(1, 0.2*inch))

    # Generate predictions based on planetary positions
    predictions = generate_predictions(kundli_data)

    categories = ["Career", "Marriage", "Health", "Wealth"]

    for category in categories:
        elements.append(Paragraph(category, ParagraphStyle(
            'Category',
            parent=styles['Heading3'],
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=8
        )))

        pred_text = predictions.get(category.lower(), "Predictions not available.")
        elements.append(Paragraph(pred_text, normal_style))
        elements.append(Spacer(1, 0.15*inch))

    # =============================================================================
    # PAGE 5: Remedies
    # =============================================================================

    elements.append(PageBreak())

    elements.append(Paragraph("Astrological Remedies", heading_style))
    elements.append(Spacer(1, 0.2*inch))

    remedies = generate_remedies(kundli_data)

    remedy_categories = ["Gemstones", "Mantras", "General"]

    for category in remedy_categories:
        elements.append(Paragraph(category, ParagraphStyle(
            'RemedyCategory',
            parent=styles['Heading3'],
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=8
        )))

        remedy_text = remedies.get(category.lower(), "Remedies not available.")
        elements.append(Paragraph(remedy_text, normal_style))
        elements.append(Spacer(1, 0.15*inch))

    # =============================================================================
    # Build PDF
    # =============================================================================

    print("Building PDF document...", file=sys.stdout)
    sys.stdout.flush()

    try:
        doc.build(elements)
        print("PDF built successfully!", file=sys.stdout)
    except Exception as e:
        print(f"Error building PDF: {e}", file=sys.stderr)
        sys.exit(1)

    # Get PDF bytes
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()

    # Save to file in current directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Kundli_{name.replace(' ', '_')}_{timestamp}.pdf"
    output_path = Path(filename)

    print(f"Saving PDF to {filename}...", file=sys.stdout)
    sys.stdout.flush()

    try:
        output_path.write_bytes(pdf_bytes)
        print(f"PDF saved successfully: {filename}", file=sys.stdout)
    except Exception as e:
        print(f"Error saving PDF: {e}", file=sys.stderr)
        sys.exit(1)

    # Return MEDIA URL for the system to upload
    # Use sandbox: prefix to indicate local file that needs to be uploaded
    sandbox_path = f"sandbox:{output_path.absolute()}"
    print(f"MEDIA: {sandbox_path}", file=sys.stdout)
    sys.stdout.flush()

    return str(output_path.absolute())


def generate_predictions(kundli_data):
    """Generate life predictions based on kundli data."""
    predictions = {}

    lagna = kundli_data.get('lagna', '')
    moon_sign = kundli_data.get('moon_sign', '')

    # Career predictions
    predictions['career'] = f"Based on your Lagna ({lagna}) and planetary positions, you show strong potential for professional success. The 10th house and its lord indicate growth in your career through hard work and dedication. Focus on your skills and opportunities will come."

    # Marriage predictions
    predictions['marriage'] = f"Your 7th house analysis indicates possibilities of a harmonious marriage. The placement of Venus and Jupiter suggests favorable timing for marriage. Look for periods when Jupiter transits favorable positions."

    # Health predictions
    predictions['health'] = f"Your health chart indicates need for attention towards lifestyle management. The ascendant lord and 6th house placement suggest maintaining regular health checkups. Yoga and meditation will be beneficial."

    # Wealth predictions
    predictions['wealth'] = f"Financial prosperity is indicated by the 2nd and 11th house lords. There are possibilities of multiple income sources. Investment in stable assets will bring long-term benefits. Avoid impulsive spending."

    return predictions


def generate_remedies(kundli_data):
    """Generate astrological remedies based on kundli data."""
    remedies = {}

    moon_sign = kundli_data.get('moon_sign', '')
    lagna = kundli_data.get('lagna', '')

    # Gemstones
    remedies['gemstones'] = f"Based on your Lagna ({lagna}), wearing a suitable gemstone can strengthen benefic planets. Consult an expert astrologer for precise recommendation based on your birth chart analysis."

    # Mantras
    remedies['mantras'] = f"Reciting 'Om Namah Shivaya' daily can bring positive energy. Chanting the Gayatri Mantra during sunrise enhances overall well-being. Focus on your Ishta Devata mantra for spiritual growth."

    # General remedies
    remedies['general'] = f"Perform regular puja and meditation. Offer water to Sun in the morning. Help the needy and donate to charity on your birthday. Respect elders and seek their blessings. Maintain positive thoughts and actions."

    return remedies


def main():
    parser = argparse.ArgumentParser(
        description="Generate Kundli PDF Reports"
    )
    parser.add_argument(
        "--dob",
        required=True,
        help="Date of birth in YYYY-MM-DD format (e.g., 2002-02-16)"
    )
    parser.add_argument(
        "--tob",
        required=True,
        help="Time of birth in HH:MM format (e.g., 00:00)"
    )
    parser.add_argument(
        "--place",
        required=True,
        help="Place of birth (e.g., Meerut)"
    )
    parser.add_argument(
        "--name",
        default="User",
        help="User's name (default: User)"
    )

    args = parser.parse_args()

    # Generate PDF
    try:
        pdf_path = generate_pdf(args.dob, args.tob, args.place, args.name)
        print(f"✅ PDF generated successfully: {pdf_path}", file=sys.stdout)
        sys.stdout.flush()
    except Exception as e:
        print(f"❌ Error generating PDF: {e}", file=sys.stderr)
        sys.stderr.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
