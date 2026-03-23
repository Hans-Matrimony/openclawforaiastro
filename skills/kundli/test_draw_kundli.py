#!/usr/bin/env python3
"""
Test script to verify draw_kundli_traditional.py works correctly
This demonstrates the correct --planets format
"""

import subprocess
import sys
import json

def test_with_example_planets():
    """Test the Kundli chart generator with example planet positions"""

    # Example planet positions in the CORRECT JSON format
    example_planets = json.dumps([
        "Saturn is in House 1 (Taurus/Vrishabh)",
        "Jupiter is in House 2 (Gemini/Mithun)",
        "Rahu is in House 2 (Gemini/Mithun)",
        "Ketu is in House 8 (Sagittarius/Dhanu)",
        "Mercury is in House 9 (Capricorn/Makar)",
        "Sun is in House 10 (Aquarius/Kumbh)",
        "Venus is in House 10 (Aquarius/Kumbh)",
        "Moon is in House 11 (Pisces/Meen)",
        "Mars is in House 11 (Pisces/Meen)"
    ])

    cmd = [
        sys.executable,
        "draw_kundli_traditional.py",
        "--lagna", "Taurus",
        "--moon-sign", "Pisces",
        "--nakshatra", "Revati",
        "--planets", example_planets
    ]

    print("=" * 60)
    print("Testing Kundli Chart Generation")
    print("=" * 60)
    print(f"\nCommand: {' '.join(cmd)}\n")
    print("Expected Output:")
    print("  - IMAGE_URL: https://i.ibb.co/... (if IMGBB_API_KEY set)")
    print("  - IMAGE_BASE64: <base64_data> (if no API key)")
    print("\nDebug Output (stderr):")
    print("-" * 60)

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Print stdout (should contain IMAGE_URL or IMAGE_BASE64)
    if result.stdout:
        print(result.stdout)

    # Print stderr (should contain debug logs)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    print("-" * 60)

    if result.returncode == 0:
        print("\n✅ SUCCESS! Chart generated without errors")
        print("\nVerify:")
        print("  1. Check if IMAGE_URL was printed")
        print("  2. Check stderr for planet parsing debug logs")
        print("  3. Chart should show Hindi keywords (ल, गु, च, etc.)")
    else:
        print(f"\n❌ FAILED with exit code {result.returncode}")
        return False

    return True


def test_with_empty_planets():
    """Test with empty planets array (should show only Lagna)"""

    cmd = [
        sys.executable,
        "draw_kundli_traditional.py",
        "--lagna", "Taurus",
        "--moon-sign", "Pisces",
        "--nakshatra", "Revati",
        "--planets", "[]"
    ]

    print("\n" + "=" * 60)
    print("Testing with EMPTY planets array")
    print("=" * 60)
    print(f"\nCommand: {' '.join(cmd)}\n")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if "WARNING: No planet positions provided" in result.stderr:
        print("\n✅ Correctly detected empty planets array")
        return True
    else:
        print("\n❌ Did not detect empty planets array")
        return False


def test_with_malformed_json():
    """Test with malformed JSON (should show error)"""

    cmd = [
        sys.executable,
        "draw_kundli_traditional.py",
        "--lagna", "Taurus",
        "--moon-sign", "Pisces",
        "--nakshatra", "Revati",
        "--planets", "this is not valid JSON"
    ]

    print("\n" + "=" * 60)
    print("Testing with MALFORMED JSON (should show error)")
    print("=" * 60)
    print(f"\nCommand: {' '.join(cmd)}\n")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if "ERROR PARSING PLANETS" in result.stderr:
        print("\n✅ Correctly detected malformed JSON")
        return True
    else:
        print("\n❌ Did not detect malformed JSON")
        return False


if __name__ == "__main__":
    print("\n🧪 Kundli Chart Generator Test Suite")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Example Planets", test_with_example_planets()))
    results.append(("Empty Planets", test_with_empty_planets()))
    results.append(("Malformed JSON", test_with_malformed_json()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")

    all_passed = all(passed for _, passed in results)

    print("=" * 60)

    if all_passed:
        print("\n🎉 All tests passed!")
        print("\nThe draw_kundli_traditional.py script is working correctly.")
        print("Issue is in how the OPENCLAW AGENT is calling it.")
        print("\nNext step: Check KUNDLI_RESPONSE.md to ensure it passes")
        print("the --planets argument in the correct JSON format.")
    else:
        print("\n⚠️ Some tests failed!")
        print("Please check the errors above.")

    sys.exit(0 if all_passed else 1)
