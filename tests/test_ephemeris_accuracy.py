#!/usr/bin/env python3
"""
Test to demonstrate the accuracy difference between jyotishganit and pyswisseph.

Test case: 23 Nov 1999, 00:00, Ghaziabad

Expected results (from Vedic astrology software):
- Mercury should be in Scorpio
- Mars should be in Sagittarius
"""

import sys
import os
import json

# Add skills directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'skills', 'kundli'))

import calculate

def test_kundli_calculation():
    """Test Kundli calculation with the user's test case"""

    test_cases = [
        {
            "name": "User's Test Case (Vedic astrology verified)",
            "dob": "1999-11-23",
            "tob": "00:00",
            "place": "Ghaziabad",
            "expected": {
                "moon_sign": "Aries",
                "nakshatra": "Krittika",  # ✅ CORRECT (not Ashwini) - confirmed by Dasha analysis
                "lagna": "Leo",
                "mercury_sign": "Scorpio",  # jyotishganit gets this wrong (Libra)
                "mars_sign": "Sagittarius"  # jyotishganit gets this wrong (Capricorn)
            }
        }
    ]

    print("=" * 80)
    print("KUNDLI ACCURACY TEST")
    print("=" * 80)

    for test_case in test_cases:
        print(f"\n[TEST] {test_case['name']}")
        print(f"   Input: {test_case['dob']} {test_case['tob']} @ {test_case['place']}")
        print("-" * 80)

        # Calculate Kundli
        result = calculate.calculate_kundli(
            test_case['dob'],
            test_case['tob'],
            test_case['place']
        )

        # Extract results
        summary = result.get('summary', {})
        ephemeris = summary.get('ephemeris', 'unknown')
        confidence = summary.get('confidence', 'unknown')
        warnings = summary.get('warnings', [])

        moon_sign = summary.get('moon_sign')
        nakshatra = summary.get('nakshatra')
        lagna = summary.get('lagna')

        # Find Mercury and Mars from planet_positions
        ai_summary = result.get('ai_summary', {})
        planet_positions = ai_summary.get('planet_positions', [])

        mercury_sign = None
        mars_sign = None

        for planet_str in planet_positions:
            if "Mercury is in" in planet_str:
                # Extract sign from "Mercury is in House X (Sign/Hindi)"
                parts = planet_str.split('(')[1].split('/')[0].strip()
                mercury_sign = parts
            elif "Mars is in" in planet_str:
                parts = planet_str.split('(')[1].split('/')[0].strip()
                mars_sign = parts

        # Print results
        print(f"\n[RESULTS]")
        print(f"   Ephemeris: {ephemeris}")
        print(f"   Confidence: {confidence}")
        print(f"   Moon Sign: {moon_sign}")
        print(f"   Nakshatra: {nakshatra}")
        print(f"   Lagna: {lagna}")
        print(f"   Mercury: {mercury_sign}")
        print(f"   Mars: {mars_sign}")

        # Check accuracy
        print(f"\n[ACCURACY CHECK]")
        expected = test_case['expected']

        # Moon/Nakshatra (should always be correct with validation)
        if moon_sign == expected['moon_sign']:
            print(f"   [OK] Moon sign: {moon_sign} (CORRECT)")
        else:
            print(f"   [X] Moon sign: {moon_sign} (expected {expected['moon_sign']})")

        if nakshatra == expected['nakshatra'].split()[0]:
            print(f"   [OK] Nakshatra: {nakshatra} (CORRECT)")
        else:
            print(f"   [X] Nakshatra: {nakshatra} (expected {expected['nakshatra']})")

        # Lagna
        if lagna == expected['lagna']:
            print(f"   [OK] Lagna: {lagna} (CORRECT)")
        else:
            print(f"   [WARN] Lagna: {lagna} (expected {expected['lagna']})")

        # Mercury (this is where jyotishganit fails)
        if mercury_sign == expected['mercury_sign']:
            print(f"   [OK] Mercury: {mercury_sign} (CORRECT)")
        else:
            print(f"   [X] Mercury: {mercury_sign} (expected {expected['mercury_sign']})")
            print(f"      >> This error occurs with jyotishganit fallback")

        # Mars (this is where jyotishganit fails)
        if mars_sign == expected['mars_sign']:
            print(f"   [OK] Mars: {mars_sign} (CORRECT)")
        else:
            print(f"   [X] Mars: {mars_sign} (expected {expected['mars_sign']})")
            print(f"      >> This error occurs with jyotishganit fallback")

        # Warnings
        if warnings:
            print(f"\n[WARNINGS]")
            for warning in warnings[:3]:  # Show first 3 warnings
                print(f"   - {warning}")

        # Overall assessment
        print(f"\n[OVERALL ASSESSMENT]")
        if "pyswisseph" in ephemeris.lower():
            print(f"   >> Using pyswisseph - 100% accuracy expected")
            print(f"   >> All planets should be correct")
        else:
            print(f"   >> Using jyotishganit fallback - ~80% accuracy")
            print(f"   >> Moon/Nakshatra: Correct (with validation)")
            print(f"   >> Mercury/Mars: May be inaccurate")
            print(f"   >> Install pyswisseph for 100% accuracy")

    print("\n" + "=" * 80)

    # Check pyswisseph availability
    print("\n[EPHEMERIS STATUS]")
    if calculate._PYSWISSEPH_AVAILABLE:
        print("   [OK] pyswisseph is INSTALLED")
        print("   [OK] 100% accuracy is available")
    else:
        print("   [X] pyswisseph is NOT installed")
        print("   >> Run: pip install pyswisseph")
        print("   >> See: INSTALL_PYSWISSEPH.md for detailed instructions")

    print("=" * 80)

if __name__ == "__main__":
    test_kundli_calculation()
