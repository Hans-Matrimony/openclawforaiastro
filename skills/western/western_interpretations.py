#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Western Astrology Interpretations Helper
Provides interpretations for natal chart positions

This module helps generate natural language interpretations
for Western astrology chart positions.
"""

import json
import os

# ============================================================================
# INTERPRETATION DATABASE
# ============================================================================

SIGN_INTERPRETATIONS = {
    "Aries": {
        "keywords": ["bold", "pioneering", "courageous", "independent", "energetic"],
        "personality": "You're a natural pioneer with courage to blaze new trails.",
        "strengths": ["leadership", "courage", "initiative", "enthusiasm"],
        "challenges": ["impatience", "impulsiveness", "anger"],
        "life_theme": "Initiating new beginnings and asserting your identity"
    },
    "Taurus": {
        "keywords": ["reliable", "patient", "practical", "sensual", "determined"],
        "personality": "You value stability and build lasting foundations.",
        "strengths": ["patience", "reliability", "practicality", "loyalty"],
        "challenges": ["stubbornness", "possessiveness", "resistance to change"],
        "life_theme": "Building security and appreciating life's pleasures"
    },
    "Gemini": {
        "keywords": ["curious", "adaptable", "communicative", "witty", "social"],
        "personality": "Your mind is always active, seeking knowledge and connection.",
        "strengths": ["versatility", "communication", "curiosity", "adaptability"],
        "challenges": ["restlessness", "indecision", "superficiality"],
        "life_theme": "Gathering and sharing information through connection"
    },
    "Cancer": {
        "keywords": ["nurturing", "intuitive", "protective", "emotional", "loyal"],
        "personality": "You feel deeply and create emotional security wherever you go.",
        "strengths": ["nurturing", "intuition", "loyalty", "emotional depth"],
        "challenges": ["moodiness", "over-sensitivity", "clinging"],
        "life_theme": "Creating emotional bonds and nurturing others"
    },
    "Leo": {
        "keywords": ["creative", "confident", "generous", "dramatic", "leadership"],
        "personality": "You're here to shine and express your unique creativity.",
        "strengths": ["confidence", "creativity", "generosity", "leadership"],
        "challenges": ["pride", "stubbornness", "need for attention"],
        "life_theme": "Creative self-expression and heartfelt leadership"
    },
    "Virgo": {
        "keywords": ["analytical", "practical", "helpful", "perfectionist", "modest"],
        "personality": "You see the details others miss and strive to improve everything.",
        "strengths": ["analytical", "helpful", "practical", "reliable"],
        "challenges": ["perfectionism", "worry", "criticism"],
        "life_theme": "Service through analysis and practical improvement"
    },
    "Libra": {
        "keywords": ["diplomatic", "harmonious", "fair", "social", "graceful"],
        "personality": "You seek balance and beauty in all your relationships.",
        "strengths": ["diplomacy", "fairness", "charm", "cooperation"],
        "challenges": ["indecision", "avoidance of conflict", "people-pleasing"],
        "life_theme": "Creating harmony through partnership and beauty"
    },
    "Scorpio": {
        "keywords": ["intense", "passionate", "transformative", "magnetic", "determined"],
        "personality": "You experience life deeply and transform through intensity.",
        "strengths": ["depth", "passion", "determination", "insight"],
        "challenges": ["jealousy", "secrecy", "controlling behavior"],
        "life_theme": "Transformation through emotional depth and regeneration"
    },
    "Sagittarius": {
        "keywords": ["optimistic", "adventurous", "philosophical", "freedom-loving", "direct"],
        "personality": "You're a seeker of truth and meaning, always exploring horizons.",
        "strengths": ["optimism", "adventure", "philosophy", "generosity"],
        "challenges": ["restlessness", "bluntness", "over-committing"],
        "life_theme": "Exploring meaning through freedom and adventure"
    },
    "Capricorn": {
        "keywords": ["ambitious", "disciplined", "responsible", "practical", "patient"],
        "personality": "You build lasting structures and achieve through perseverance.",
        "strengths": ["ambition", "discipline", "responsibility", "patience"],
        "challenges": ["rigidity", "pessimism", "workaholic tendencies"],
        "life_theme": "Achieving mastery through discipline and responsibility"
    },
    "Aquarius": {
        "keywords": ["innovative", "independent", "humanitarian", "intellectual", "unconventional"],
        "personality": "You think differently and envision better futures for everyone.",
        "strengths": ["innovation", "independence", "humanitarianism", "intellect"],
        "challenges": ["detachment", "rebelliousness", "unpredictability"],
        "life_theme": "Innovating for the collective good through individuality"
    },
    "Pisces": {
        "keywords": ["compassionate", "artistic", "intuitive", "spiritual", "sensitive"],
        "personality": "You feel the universe deeply and bridge material and spiritual.",
        "strengths": ["compassion", "creativity", "intuition", "spirituality"],
        "challenges": ["escapism", "over-sensitivity", "victim mentality"],
        "life_theme": "Transcending boundaries through compassion and imagination"
    }
}

HOUSE_INTERPRETATIONS = {
    1: {
        "name": "First House",
        "theme": "Self and Identity",
        "meaning": "How you see yourself and present yourself to the world",
        "life_area": "Personal identity, physical appearance, first impressions"
    },
    2: {
        "name": "Second House",
        "theme": "Values and Possessions",
        "meaning": "What you value in life and how you handle resources",
        "life_area": "Money, possessions, values, self-worth"
    },
    3: {
        "name": "Third House",
        "theme": "Communication and Learning",
        "meaning": "How you communicate, learn, and connect with your immediate environment",
        "life_area": "Communication, siblings, short trips, early education"
    },
    4: {
        "name": "Fourth House",
        "theme": "Home and Family",
        "meaning": "Your roots, home life, and emotional foundations",
        "life_area": "Home, family, parents, emotional security"
    },
    5: {
        "name": "Fifth House",
        "theme": "Creativity and Romance",
        "meaning": "How you express yourself creatively and experience romance",
        "life_area": "Creativity, romance, children, pleasure, self-expression"
    },
    6: {
        "name": "Sixth House",
        "theme": "Work and Health",
        "meaning": "Your daily routines, work environment, and health habits",
        "life_area": "Work, service, health, daily routines, pets"
    },
    7: {
        "name": "Seventh House",
        "theme": "Partnerships",
        "meaning": "How you relate to others in one-on-one relationships",
        "life_area": "Partnerships, marriage, close relationships, open enemies"
    },
    8: {
        "name": "Eighth House",
        "theme": "Transformation and Shared Resources",
        "meaning": "Deep transformation, intimacy, and shared resources",
        "life_area": "Transformation, death, inheritance, shared resources, intimacy"
    },
    9: {
        "name": "Ninth House",
        "theme": "Higher Learning and Philosophy",
        "meaning": "Your search for meaning, travel, and expansion of horizons",
        "life_area": "Higher education, travel, philosophy, religion, foreign lands"
    },
    10: {
        "name": "Tenth House",
        "theme": "Career and Public Image",
        "meaning": "Your ambitions, career, and how you're seen publicly",
        "life_area": "Career, public image, reputation, authority figures"
    },
    11: {
        "name": "Eleventh House",
        "theme": "Community and Dreams",
        "meaning": "Your place in community and hopes for the future",
        "life_area": "Friends, community, hopes, dreams, humanitarian causes"
    },
    12: {
        "name": "Twelfth House",
        "theme": "Spirituality and Unconscious",
        "meaning": "Your spiritual nature and unconscious patterns",
        "life_area": "Spirituality, unconscious, hidden things, solitude, karma"
    }
}

ASPECT_INTERPRETATIONS = {
    "conjunction": {
        "meaning": "amplification and fusion",
        "interpretation": "These two energies blend and amplify each other"
    },
    "opposition": {
        "meaning": "tension and balance",
        "interpretation": "These energies create tension that seeks balance and integration"
    },
    "trine": {
        "meaning": "harmony and flow",
        "interpretation": "These energies flow together naturally and harmoniously"
    },
    "square": {
        "meaning": "challenge and growth",
        "interpretation": "These energies create dynamic tension that drives growth"
    },
    "sextile": {
        "meaning": "opportunity and support",
        "interpretation": "These energies offer opportunities for positive expression"
    }
}

PLANET_INTERPRETATIONS = {
    "Sun": {
        "meaning": "Core identity and life purpose",
        "question": "Who are you becoming?"
    },
    "Moon": {
        "meaning": "Emotional nature and inner world",
        "question": "What do you need to feel emotionally secure?"
    },
    "Mercury": {
        "meaning": "Communication and mental processes",
        "question": "How do you think and communicate?"
    },
    "Venus": {
        "meaning": "Love, values, and attraction",
        "question": "What do you value and how do you love?"
    },
    "Mars": {
        "meaning": "Action, drive, and desire",
        "question": "What motivates you to act?"
    },
    "Jupiter": {
        "meaning": "Expansion and wisdom",
        "question": "Where do you seek growth and meaning?"
    },
    "Saturn": {
        "meaning": "Discipline and responsibility",
        "question": "Where must you develop mastery?"
    },
    "Uranus": {
        "meaning": "Innovation and freedom",
        "question": "Where do you express your uniqueness?"
    },
    "Neptune": {
        "meaning": "Dreams and spirituality",
        "question": "Where do you seek transcendence?"
    },
    "Pluto": {
        "meaning": "Transformation and power",
        "question": "Where do you experience deep transformation?"
    }
}


# ============================================================================
# INTERPRETATION FUNCTIONS
# ============================================================================

def interpret_sun_sign(sun_sign: str) -> dict:
    """Get interpretation for Sun sign"""
    return SIGN_INTERPRETATIONS.get(sun_sign, {
        "keywords": [],
        "personality": "Sign not found in database",
        "strengths": [],
        "challenges": [],
        "life_theme": "Unknown"
    })


def interpret_moon_sign(moon_sign: str) -> dict:
    """Get interpretation for Moon sign (emotional nature)"""
    sign = SIGN_INTERPRETATIONS.get(moon_sign, {})
    return {
        "emotional_nature": sign.get("personality", "Unknown"),
        "emotional_needs": sign.get("keywords", []),
        "inner_theme": sign.get("life_theme", "Unknown")
    }


def interpret_ascendant(ascendant: str) -> dict:
    """Get interpretation for Ascendant (outer personality)"""
    sign = SIGN_INTERPRETATIONS.get(ascendant, {})
    return {
        "outer_personality": sign.get("personality", "Unknown"),
        "first_impressions": f"People see you as {sign.get('keywords', [''])[0] if sign.get('keywords') else 'unique'}",
        "approach_to_life": sign.get("life_theme", "Unknown")
    }


def interpret_planet_in_sign(planet: str, sign: str) -> str:
    """Generate interpretation for planet in sign"""
    planet_meaning = PLANET_INTERPRETATIONS.get(planet, {})
    sign_data = SIGN_INTERPRETATIONS.get(sign, {})

    if not planet_meaning or not sign_data:
        return f"{planet} in {sign}"

    return f"With {planet} in {sign}, {planet_meaning.get('meaning', 'you express this energy')} through {sign_data.get('keywords', [''])[0] if sign_data.get('keywords') else 'this sign'}' qualities."


def interpret_house_with_sign(house_num: int, sign: str) -> str:
    """Generate interpretation for house with sign"""
    house_info = HOUSE_INTERPRETATIONS.get(house_num, {})
    sign_data = SIGN_INTERPRETATIONS.get(sign, {})

    if not house_info:
        return f"House {house_num} in {sign}"

    house_theme = house_info.get("theme", "")
    sign_keywords = sign_data.get("keywords", [""])[0] if sign_data.get("keywords") else ""

    return f"Your {house_theme} (House {house_num}) expresses through {sign} qualities — {sign_keywords} and {sign_data.get('life_theme', 'self-expression').lower()}."


def generate_chart_summary(chart: dict) -> str:
    """Generate natural language summary of chart"""
    parts = []

    # Sun sign
    sun = chart.get("sun_sign", "")
    if sun:
        sun_interp = interpret_sun_sign(sun)
        parts.append(f"Your Sun in {sun} reveals: {sun_interp['personality']}")

    # Moon sign
    moon = chart.get("moon_sign", "")
    if moon:
        moon_interp = interpret_moon_sign(moon)
        parts.append(f"Emotionally, your Moon in {moon} means {moon_interp['emotional_nature']}")

    # Ascendant
    asc = chart.get("ascendant", "")
    if asc:
        asc_interp = interpret_ascendant(asc)
        parts.append(f"Others see you as {asc_interp['outer_personality']}")

    return " ".join(parts)


def get_relationship_compatibility(sign1: str, sign2: str) -> dict:
    """Get basic compatibility between two signs"""
    element_map = {
        "Aries": "fire", "Leo": "fire", "Sagittarius": "fire",
        "Taurus": "earth", "Virgo": "earth", "Capricorn": "earth",
        "Gemini": "air", "Libra": "air", "Aquarius": "air",
        "Cancer": "water", "Scorpio": "water", "Pisces": "water"
    }

    elem1 = element_map.get(sign1)
    elem2 = element_map.get(sign2)

    if not elem1 or not elem2:
        return {"compatibility": "unknown", "reason": "Sign not found"}

    # Same element = high compatibility
    if elem1 == elem2:
        return {
            "compatibility": "high",
            "reason": f"Both {elem1} signs — natural understanding"
        }

    # Complementary elements
    complementary = {
        "fire": ["air"],
        "air": ["fire", "water"],
        "water": ["earth"],
        "earth": ["water"]
    }

    if elem2 in complementary.get(elem1, []):
        return {
            "compatibility": "good",
            "reason": f"{elem1} and {elem2} complement each other"
        }

    return {
        "compatibility": "challenging but potentially rewarding",
        "reason": f"Different elements {elem1} and {elem2} create dynamic tension"
    }


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Get Western astrology interpretations'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # sun-sign command
    sun_parser = subparsers.add_parser('sun-sign', help='Interpret Sun sign')
    sun_parser.add_argument('sign', help='Sun sign (e.g., Aries)')

    # compatibility command
    compat_parser = subparsers.add_parser('compatibility', help='Check sign compatibility')
    compat_parser.add_argument('sign1', help='First sign')
    compat_parser.add_argument('sign2', help='Second sign')

    # summary command
    summary_parser = subparsers.add_parser('summary', help='Generate chart summary')
    summary_parser.add_argument('--sun', help='Sun sign')
    summary_parser.add_argument('--moon', help='Moon sign')
    summary_parser.add_argument('--ascendant', help='Ascendant sign')

    args = parser.parse_args()

    if args.command == 'sun-sign':
        result = interpret_sun_sign(args.sign.capitalize())
        print(json.dumps(result, indent=2))

    elif args.command == 'compatibility':
        result = get_relationship_compatibility(
            args.sign1.capitalize(),
            args.sign2.capitalize()
        )
        print(json.dumps(result, indent=2))

    elif args.command == 'summary':
        chart = {}
        if args.sun:
            chart['sun_sign'] = args.sun.capitalize()
        if args.moon:
            chart['moon_sign'] = args.moon.capitalize()
        if args.ascendant:
            chart['ascendant'] = args.ascendant.capitalize()

        summary = generate_chart_summary(chart)
        print(summary)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
