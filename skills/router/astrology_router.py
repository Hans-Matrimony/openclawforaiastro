#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Astrology Router - Phone Number Based Routing System

Routes users to Vedic or Western Astrologer based on phone number prefix.

South Asian numbers (+91, +92, +93, +880, +94, +977, +960, etc.) → Vedic Astrologer
All other numbers                                            → Western Astrologer
"""

import os
import sys
import json
import argparse
import re

# Fix Windows encoding issue
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Get the script directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COUNTRY_CODES_FILE = os.path.join(SCRIPT_DIR, "country_codes.json")

VEDIC_PREFIXES = [
    "+91",   # India
    "+92",   # Pakistan
    "+93",   # Afghanistan
    "+880",  # Bangladesh
    "+94",   # Sri Lanka
    "+977",  # Nepal
    "+960",  # Maldives
    "+975",  # Bhutan
    "+95",   # Myanmar
    "+230",  # Mauritius
    "+679",  # Fiji
    "+592",  # Guyana
    "+597",  # Suriname
    "+1868", # Trinidad and Tobago
]

COUNTRY_BY_PREFIX = {
    "+91": "India",
    "+92": "Pakistan",
    "+93": "Afghanistan",
    "+880": "Bangladesh",
    "+94": "Sri Lanka",
    "+977": "Nepal",
    "+960": "Maldives",
    "+975": "Bhutan",
    "+95": "Myanmar",
    "+230": "Mauritius",
    "+679": "Fiji",
    "+592": "Guyana",
    "+597": "Suriname",
    "+1868": "Trinidad and Tobago",
}


def normalize_phone_number(phone_number: str) -> str:
    """Normalize WhatsApp-style phone ids to a +digits string."""
    cleaned = re.sub(r"^[a-z]+:", "", str(phone_number).strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\d+]", "", cleaned)
    if not cleaned:
        return ""
    return cleaned if cleaned.startswith("+") else f"+{cleaned}"


def get_vedic_prefixes(country_codes: dict = None) -> list:
    """Return normalized Vedic routing prefixes."""
    if not country_codes:
        return VEDIC_PREFIXES

    countries = (
        country_codes.get("vedic_astrology_countries", {}).get("countries")
        or country_codes.get("vedic_astrolology_countries", {}).get("countries")
        or []
    )
    prefixes = []
    for item in countries:
        code = normalize_phone_number(item.get("code", ""))
        if code:
            prefixes.append(code)
    return prefixes or VEDIC_PREFIXES


def is_vedic_phone(phone_number: str, country_codes: dict = None) -> bool:
    normalized = normalize_phone_number(phone_number)
    return any(normalized.startswith(prefix) for prefix in get_vedic_prefixes(country_codes))


def load_country_codes():
    """Load country codes from JSON file"""
    try:
        with open(COUNTRY_CODES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # Return default configuration if file not found
        return {
            "vedic_prefixes": ["+91", "+92", "+93", "+880", "+94", "+977", "+960", "+975", "+95"]
        }


def get_astrology_type(phone_number: str, country_codes: dict = None) -> dict:
    """
    Determine astrology type based on phone number prefix

    Args:
        phone_number: User's phone number (can include + or not)
        country_codes: Optional country codes dict (uses default if None)

    Returns:
        dict with:
            - type: "vedic" or "western"
            - reason: explanation of routing decision
            - country: country name if detected
    """
    if country_codes is None:
        country_codes = load_country_codes()

    normalized = normalize_phone_number(phone_number)
    vedic_prefixes = get_vedic_prefixes(country_codes)

    # Check for Vedic routing
    for prefix in vedic_prefixes:
        if normalized.startswith(prefix):
            return {
                "type": "vedic",
                "system": "vedic_astrology",
                "agent": "Meera/Aarav",
                "collection": "astrology_knowledge",
                "workspace": "workspace-astrologer",
                "prompt": "astrologer.md",
                "country": COUNTRY_BY_PREFIX.get(prefix, "South Asia"),
                "reason": f"Phone number starts with {prefix} (South Asian region)",
                "features": ["Kundli", "Nakshatras", "Dasha", "Vedic remedies", "Mantras"]
            }

    # Default to Western for all other numbers
    return {
        "type": "western",
        "system": "western_astrology",
        "agent": "Sophia/Atlas",
        "collection": "western_astrology",
        "workspace": "workspace-western-astrologer",
        "prompt": "western_astrologer.md",
        "country": "International",
        "reason": "Phone number is from outside South Asian region",
        "features": ["Sun signs", "Tropical zodiac", "Houses", "Aspects", "Retrogrades", "Crystals"]
    }


def get_agent_config(phone_number: str, gender: str = None) -> dict:
    """
    Get complete agent configuration for routing

    Args:
        phone_number: User's phone number

    Returns:
        dict with agent configuration including workspace, prompt, tools, etc.
    """
    routing = get_astrology_type(phone_number)

    if routing["type"] == "vedic":
        return {
            "system": "vedic",
            "agent_name": "Meera" if (gender or "").lower() == "male" else "Aarav",
            "workspace": "workspace-astrologer",
            "prompt_file": ".pi/prompts/astrologer.md",
            "qdrant_collection": "astrology_knowledge",
            "qdrant_client": "skills/qdrant/qdrant_client.py",
            "kundli_tool": "skills/kundli/calculate.py",
            "chart_tool": "skills/kundli/draw_kundli_traditional.py",
            "remedies_type": "mantra_gem",
            "zodiac_type": "sidereal",
            "house_system": "whole_sign"
        }
    else:
        return {
            "system": "western",
            "agent_name": "Sophia" if (gender or "").lower() == "male" else "Atlas",
            "workspace": "workspace-western-astrologer",
            "prompt_file": ".pi/prompts/western_astrologer.md",
            "qdrant_collection": "western_astrology",
            "qdrant_client": "skills/qdrant/western_astrology_client.py",
            "kundli_tool": "skills/western/natal_chart.py",
            "chart_tool": "skills/western/draw_natal_chart.py",
            "pdf_tool": "skills/western/western_chart_pdf.py",
            "remedies_type": "crystals_colors",
            "zodiac_type": "tropical",
            "house_system": "placidus"
        }


def print_routing_table():
    """Print a formatted routing reference table"""
    print("\n" + "="*70)
    print("ASTROLOGY ROUTING TABLE".center(70))
    print("="*70)

    print("\nVEDIC ASTROLOGY (South Asia)".center(70))
    print("-" * 70)
    print(f"{'Prefix':<10} {'Country':<20} {'Agent':<20} {'Collection'}")
    print("-" * 70)

    vedic_routes = [
        ("+91", "India", "Meera/Aarav", "astrology_knowledge"),
        ("+92", "Pakistan", "Meera/Aarav", "astrology_knowledge"),
        ("+93", "Afghanistan", "Meera/Aarav", "astrology_knowledge"),
        ("+880", "Bangladesh", "Meera/Aarav", "astrology_knowledge"),
        ("+94", "Sri Lanka", "Meera/Aarav", "astrology_knowledge"),
        ("+977", "Nepal", "Meera/Aarav", "astrology_knowledge"),
        ("+960", "Maldives", "Meera/Aarav", "astrology_knowledge"),
    ]

    for prefix, country, agent, collection in vedic_routes:
        print(f"{prefix:<10} {country:<20} {agent:<20} {collection}")

    print("\nWESTERN ASTROLOGY (International)".center(70))
    print("-" * 70)
    print(f"{'Prefix':<10} {'Region':<20} {'Agent':<20} {'Collection'}")
    print("-" * 70)
    print(f"{'All other':<10} {'International':<20} {'Sophia/Atlas':<20} {'western_astrology'}")

    print("\n" + "="*70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Route users to Vedic or Western Astrologer based on phone number'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # route command
    route_parser = subparsers.add_parser('route', help='Determine astrology type for a phone number')
    route_parser.add_argument('phone', help='Phone number (with or without + prefix)')
    route_parser.add_argument('--json', action='store_true', help='Output as JSON')

    # config command
    config_parser = subparsers.add_parser('config', help='Get full agent configuration')
    config_parser.add_argument('phone', help='Phone number')
    config_parser.add_argument('--gender', help='User gender for agent personality selection')

    # table command
    table_parser = subparsers.add_parser('table', help='Print routing reference table')

    args = parser.parse_args()

    if args.command == 'route':
        result = get_astrology_type(args.phone)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"\n📱 Phone: {args.phone}")
            print(f"🔮 System: {result['system'].upper()}")
            print(f"👤 Agent: {result['agent']}")
            print(f"📚 Collection: {result['collection']}")
            print(f"🌍 Region: {result['country']}")
            print(f"💡 Reason: {result['reason']}")
            print(f"✨ Features: {', '.join(result['features'])}\n")

    elif args.command == 'config':
        result = get_agent_config(args.phone, args.gender)
        print(json.dumps(result, indent=2))

    elif args.command == 'table':
        print_routing_table()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
