#!/usr/bin/env python3
"""
Kundli PDF Trigger - Placeholder script for skill detection
This script is a placeholder to make the kundli_pdf skill recognizable by OpenClaw.
The actual PDF generation happens via PDF_REQUEST message detection in the backend.
"""

def main():
    """
    This is a placeholder script.
    The AI should NOT need to execute this - it should just output the PDF_REQUEST message.
    """
    print("Kundli PDF Generation Skill")
    print("=" * 50)
    print()
    print("This is a message-based skill.")
    print("No script execution needed.")
    print()
    print("To trigger PDF generation, include this in your response:")
    print("PDF_REQUEST: dob=YYYY-MM-DD, tob=HH:MM, place=CITY, name=NAME")
    print()
    print("Example:")
    print("PDF_REQUEST: dob=2002-02-16, tob=00:00, place=Meerut, name=Vardhan")
    print()
    print("The backend will detect this message and generate the PDF.")

if __name__ == "__main__":
    main()
