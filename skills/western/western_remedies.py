#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Western Astrology Remedies Helper
Provides crystals, colors, and affirmations for each sign

Western remedies focus on crystals, colors, and affirmations
rather than mantras and gemstones (Vedic approach).
"""

import json

# ============================================================================
# REMEDIES DATABASE
# ============================================================================

WESTERN_REMEDIES = {
    "Aries": {
        "primary_crystals": [
            {"name": "Carnelian", "properties": "Courage, vitality, motivation", "chakra": "Root"},
            {"name": "Red Jasper", "properties": "Grounding, stamina, strength", "chakra": "Root"},
            {"name": "Bloodstone", "properties": "Courage, purification, vitality", "chakra": "Root"}
        ],
        "colors": {
            "primary": "Red",
            "secondary": ["Orange", "Yellow", "White"],
            "wear": "Red and bold colors for confidence"
        },
        "affirmations": [
            "I am confident in my ability to lead",
            "I embrace new beginnings with courage",
            "I assert my needs while respecting others",
            "I channel my energy constructively"
        ],
        "stress_relief": "Physical exercise, starting new projects, competition",
        "emotional_support": "Aromatherapy with citrus oils, spending time in nature"
    },
    "Taurus": {
        "primary_crystals": [
            {"name": "Emerald", "properties": "Abundance, love, patience", "chakra": "Heart"},
            {"name": "Rose Quartz", "properties": "Unconditional love, peace, healing", "chakra": "Heart"},
            {"name": "Green Aventurine", "properties": "Luck, abundance, heart healing", "chakra": "Heart"}
        ],
        "colors": {
            "primary": "Green",
            "secondary": ["Pink", "Blue", "Earth tones"],
            "wear": "Green and natural colors for grounding"
        },
        "affirmations": [
            "I am secure and abundant",
            "I trust in the process of life",
            "I deserve pleasure and comfort",
            "I am grounded and patient"
        ],
        "stress_relief": "Gardening, cooking, music, comfortable surroundings",
        "emotional_support": "Time in nature, sensual pleasures, massage"
    },
    "Gemini": {
        "primary_crystals": [
            {"name": "Agate", "properties": "Communication, balance, mental clarity", "chakra": "Throat"},
            {"name": "Citrine", "properties": "Mental clarity, abundance, joy", "chakra": "Solar Plexus"},
            {"name": "Aquamarine", "properties": "Calm communication, truth", "chakra": "Throat"}
        ],
        "colors": {
            "primary": "Yellow",
            "secondary": ["Light blue", "Green", "Orange"],
            "wear": "Yellow and light colors for mental stimulation"
        },
        "affirmations": [
            "I communicate clearly and authentically",
            "I embrace my curiosity with focus",
            "I balance my thoughts and emotions",
            "I connect with others meaningfully"
        ],
        "stress_relief": "Reading, puzzles, socializing, learning new skills",
        "emotional_support": "Journaling, conversation, variety in routine"
    },
    "Cancer": {
        "primary_crystals": [
            {"name": "Moonstone", "properties": "Emotional balance, intuition, nurturing", "chakra": "Third Eye"},
            {"name": "Pearl", "properties": "Purity, emotional healing, wisdom", "chakra": "Crown"},
            {"name": "Chalcedony", "properties": "Nurturing, calm, brotherhood", "chakra": "Throat"}
        ],
        "colors": {
            "primary": "White/Silver",
            "secondary": ["Sea green", "Blue", "Cream"],
            "wear": "White and soft colors for emotional comfort"
        },
        "affirmations": [
            "I honor my emotions as guidance",
            "I create safe spaces for myself and others",
            "I trust my intuition",
            "I am worthy of love and nurturing"
        ],
        "stress_relief": "Home-based activities, water activities, family time",
        "emotional_support": "Creating cozy spaces, water therapy, moon gazing"
    },
    "Leo": {
        "primary_crystals": [
            {"name": "Citrine", "properties": "Abundance, confidence, joy", "chakra": "Solar Plexus"},
            {"name": "Tiger's Eye", "properties": "Personal power, courage, protection", "chakra": "Solar Plexus"},
            {"name": "Sunstone", "properties": "Leadership, vitality, warmth", "chakra": "Sacral"}
        ],
        "colors": {
            "primary": "Gold/Orange",
            "secondary": ["Red", "Yellow", "Purple"],
            "wear": "Gold and bright colors for confidence"
        },
        "affirmations": [
            "I shine my light confidently",
            "I express my creativity freely",
            "I give and receive love generously",
            "I am worthy of attention and recognition"
        ],
        "stress_relief": "Creative hobbies, performing, sunshine, exercise",
        "emotional_support": "Practice humility, share the spotlight, creative expression"
    },
    "Virgo": {
        "primary_crystals": [
            {"name": "Amazonite", "properties": "Truth, communication, calming", "chakra": "Throat"},
            {"name": "Sapphire", "properties": "Wisdom, discipline, focus", "chakra": "Third Eye"},
            {"name": "Jade", "properties": "Harmony, abundance, purity", "chakra": "Heart"}
        ],
        "colors": {
            "primary": "Navy Blue/Gray",
            "secondary": ["Green", "Brown", "White"],
            "wear": "Navy and earth tones for grounding"
        },
        "affirmations": [
            "I am perfect in my imperfection",
            "I serve with love and healthy boundaries",
            "I release the need to control",
            "I trust in the natural order of life"
        ],
        "stress_relief": "Organizing, helping others, nature walks, detailed work",
        "emotional_support": "Relaxation techniques, accepting imperfection, self-care"
    },
    "Libra": {
        "primary_crystals": [
            {"name": "Rose Quartz", "properties": "Unconditional love, harmony", "chakra": "Heart"},
            {"name": "Lepidolite", "properties": "Balance, peace, emotional calm", "chakra": "Heart"},
            {"name": "Opal", "properties": "Creativity, emotional expression, balance", "chakra": "Heart"}
        ],
        "colors": {
            "primary": "Pink",
            "secondary": ["Light blue", "Lavender", "Peach"],
            "wear": "Pink and pastel colors for harmony"
        },
        "affirmations": [
            "I create balance in my life and relationships",
            "I make decisions that honor my authentic self",
            "I am worthy of harmonious partnerships",
            "I embrace my individuality within relationships"
        ],
        "stress_relief": "Art, music, beauty, social activities",
        "emotional_support": "Self-reflection, decisive action, alone time for clarity"
    },
    "Scorpio": {
        "primary_crystals": [
            {"name": "Obsidian", "properties": "Protection, grounding, transformation", "chakra": "Root"},
            {"name": "Malachite", "properties": "Transformation, heart protection", "chakra": "Heart"},
            {"name": "Topaz", "properties": "Strength, protection, manifestation", "chakra": "Third Eye"}
        ],
        "colors": {
            "primary": "Black/Dark Red",
            "secondary": ["Maroon", "Dark purple", "Black"],
            "wear": "Dark and intense colors for power"
        },
        "affirmations": [
            "I transform challenges into power",
            "I trust the process of death and rebirth",
            "I release what no longer serves me",
            "I embrace emotional depth with courage"
        ],
        "stress_relief": "Intense exercise, therapy, research, solitude",
        "emotional_support": "Emotional release work, meditation, deep conversations"
    },
    "Sagittarius": {
        "primary_crystals": [
            {"name": "Turquoise", "properties": "Protection, wisdom, communication", "chakra": "Throat"},
            {"name": "Lapis Lazuli", "properties": "Wisdom, truth, spiritual connection", "chakra": "Third Eye"},
            {"name": "Sodalite", "properties": "Truth, logic, intuition", "chakra": "Third Eye"}
        ],
        "colors": {
            "primary": "Purple",
            "secondary": ["Blue", "Red", "Orange"],
            "wear": "Purple and rich colors for expansion"
        },
        "affirmations": [
            "I embrace life's adventures with optimism",
            "I seek truth while respecting diverse paths",
            "I balance freedom with commitment",
            "I trust in the abundance of the universe"
        ],
        "stress_relief": "Travel, outdoor activities, philosophy, teaching",
        "emotional_support": "Nature adventures, learning, freedom within structure"
    },
    "Capricorn": {
        "primary_crystals": [
            {"name": "Garnet", "properties": "Grounding, commitment, vitality", "chakra": "Root"},
            {"name": "Onyx", "properties": "Strength, focus, protection", "chakra": "Root"},
            {"name": "Tiger Eye", "properties": "Balance, protection, manifestation", "chakra": "Solar Plexus"}
        ],
        "colors": {
            "primary": "Black/Dark Brown",
            "secondary": ["Gray", "Green", "Brown"],
            "wear": "Black and earth tones for stability"
        },
        "affirmations": [
            "I build lasting foundations for success",
            "I balance ambition with self-compassion",
            "I trust in my ability to achieve my goals",
            "I deserve rest and play alongside work"
        ],
        "stress_relief": "Goal planning, hiking, structured exercise, achievement",
        "emotional_support": "Work-life balance, scheduling downtime, nature connection"
    },
    "Aquarius": {
        "primary_crystals": [
            {"name": "Amethyst", "properties": "Intuition, spiritual connection, calm", "chakra": "Crown"},
            {"name": "Aquamarine", "properties": "Communication, calm, truth", "chakra": "Throat"},
            {"name": "Fluorite", "properties": "Focus, innovation, mental clarity", "chakra": "Third Eye"}
        ],
        "colors": {
            "primary": "Electric Blue",
            "secondary": ["Silver", "Violet", "Turquoise"],
            "wear": "Electric blue and unique colors for individuality"
        },
        "affirmations": [
            "I celebrate my unique perspective",
            "I balance independence with community connection",
            "I innovate for the greater good",
            "I embrace change with excitement"
        ],
        "stress_relief": "Technology, group activities, learning, humanitarian causes",
        "emotional_support": "Community connection, alone time for recharging, innovation"
    },
    "Pisces": {
        "primary_crystals": [
            {"name": "Amethyst", "properties": "Spiritual connection, intuition, calm", "chakra": "Crown"},
            {"name": "Moonstone", "properties": "Emotional balance, intuition, feminine energy", "chakra": "Third Eye"},
            {"name": "Aquamarine", "properties": "Calm, clarity, emotional release", "chakra": "Throat"}
        ],
        "colors": {
            "primary": "Sea Green",
            "secondary": ["Purple", "Blue", "Lavender"],
            "wear": "Sea green and mystical colors for intuition"
        },
        "affirmations": [
            "I trust my intuition and inner guidance",
            "I create healthy boundaries with compassion",
            "I transmute challenges into spiritual growth",
            "I express my creativity freely"
        ],
        "stress_relief": "Meditation, art, music, water activities, spiritual practice",
        "emotional_support": "Grounding exercises, creative expression, time near water"
    }
}

# ============================================================================
# RETROGRADE GUIDANCE
# ============================================================================

RETROGRADE_GUIDANCE = {
    "Mercury": {
        "themes": ["communication", "technology", "travel", "contracts"],
        "meaning": "Time to review, revisit, and reflect",
        "do": ["review plans", "back up data", "reconnect with old contacts"],
        "avoid": ["signing contracts", "major purchases", "important travel"]
    },
    "Venus": {
        "themes": ["love", "values", "money", "relationships"],
        "meaning": "Time to reassess relationships and values",
        "do": ["reflect on relationships", "revisit past loves", "revalue possessions"],
        "avoid": ["major relationship decisions", "expensive purchases", "beauty treatments"]
    },
    "Mars": {
        "themes": ["action", "desire", "anger", "initiative"],
        "meaning": "Time to reconsider how you assert yourself",
        "do": ["reflect on anger", "revisit goals", "practice patience"],
        "avoid": ["starting new ventures", "confrontations", "risky activities"]
    },
    "Jupiter": {
        "themes": ["growth", "expansion", "wisdom", "beliefs"],
        "meaning": "Time for inner growth and philosophical reflection",
        "do": ["explore new philosophies", "reflect on beliefs", "inner exploration"],
        "avoid": ["major expansion", "legal matters", "long-distance travel"]
    },
    "Saturn": {
        "themes": ["discipline", "responsibility", "structure", "karma"],
        "meaning": "Time to take responsibility and rebuild foundations",
        "do": ["review commitments", "strengthen boundaries", "karmic clearing"],
        "avoid": ["new responsibilities", "major structural changes"]
    }
}

# ============================================================================
# FUNCTIONS
# ============================================================================

def get_remedies_for_sign(sign: str) -> dict:
    """Get remedies for a zodiac sign"""
    return WESTERN_REMEDIES.get(sign.capitalize(), {})


def get_crystal_recommendation(sign: str, concern: str = None) -> list:
    """Get crystal recommendations for a sign"""
    remedies = get_remedies_for_sign(sign)
    crystals = remedies.get("primary_crystals", [])

    if concern == "stress":
        return [c for c in crystals if "calm" in c["properties"].lower() or "grounding" in c["properties"].lower()]
    elif concern == "confidence":
        return [c for c in crystals if "confidence" in c["properties"].lower() or "power" in c["properties"].lower()]
    elif concern == "relationships":
        return [c for c in crystals if "love" in c["properties"].lower() or "harmony" in c["properties"].lower()]

    return crystals[:2]


def get_color_therapy(sign: str) -> dict:
    """Get color therapy recommendations"""
    remedies = get_remedies_for_sign(sign)
    return remedies.get("colors", {})


def get_affirmations(sign: str, count: int = 1) -> list:
    """Get affirmations for a sign"""
    remedies = get_remedies_for_sign(sign)
    all_affirmations = remedies.get("affirmations", [])
    return all_affirmations[:count]


def get_retrograde_guidance(planet: str) -> dict:
    """Get guidance for planetary retrograde"""
    return RETROGRADE_GUIDANCE.get(planet.capitalize(), {})


def generate_daily_guidance(sign: str, current_transits: list = None) -> str:
    """Generate daily guidance based on sign and transits"""
    parts = []

    remedies = get_remedies_for_sign(sign)
    if not remedies:
        return f"Guidance for {sign} not available."

    # Color guidance
    colors = remedies.get("colors", {})
    if colors:
        parts.append(f"Wear {colors.get('wear', colors.get('primary', 'your favorite colors'))} today.")

    # Affirmation
    affirmations = remedies.get("affirmations", [])
    if affirmations:
        parts.append(f"Affirm: \"{affirmations[0]}\"")

    # Crystal
    crystals = remedies.get("primary_crystals", [])
    if crystals:
        parts.append(f"Carry {crystals[0]['name']} for {crystals[0]['properties'].lower()}.")

    # Stress relief
    stress_relief = remedies.get("stress_relief", "")
    if stress_relief:
        parts.append(f"For stress: {stress_relief}")

    return " ".join(parts)


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Get Western astrology remedies'
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # remedies command
    remedies_parser = subparsers.add_parser('remedies', help='Get remedies for a sign')
    remedies_parser.add_argument('sign', help='Zodiac sign')

    # crystal command
    crystal_parser = subparsers.add_parser('crystal', help='Get crystal recommendation')
    crystal_parser.add_argument('sign', help='Zodiac sign')
    crystal_parser.add_argument('--concern', help='Specific concern (stress/confidence/relationships)')

    # affirmation command
    affirm_parser = subparsers.add_parser('affirmation', help='Get affirmation for a sign')
    affirm_parser.add_argument('sign', help='Zodiac sign')
    affirm_parser.add_argument('--count', type=int, default=1, help='Number of affirmations')

    # color command
    color_parser = subparsers.add_parser('color', help='Get color therapy for a sign')
    color_parser.add_argument('sign', help='Zodiac sign')

    # retrograde command
    retro_parser = subparsers.add_parser('retrograde', help='Get retrograde guidance')
    retro_parser.add_argument('planet', help='Planet name')

    # daily command
    daily_parser = subparsers.add_parser('daily', help='Get daily guidance')
    daily_parser.add_argument('sign', help='Zodiac sign')

    args = parser.parse_args()

    if args.command == 'remedies':
        result = get_remedies_for_sign(args.sign)
        print(json.dumps(result, indent=2))

    elif args.command == 'crystal':
        result = get_crystal_recommendation(args.sign, args.concern)
        print(json.dumps(result, indent=2))

    elif args.command == 'affirmation':
        result = get_affirmations(args.sign, args.count)
        for i, affirmation in enumerate(result, 1):
            print(f"{i}. {affirmation}")

    elif args.command == 'color':
        result = get_color_therapy(args.sign)
        print(json.dumps(result, indent=2))

    elif args.command == 'retrograde':
        result = get_retrograde_guidance(args.planet)
        print(json.dumps(result, indent=2))

    elif args.command == 'daily':
        result = generate_daily_guidance(args.sign)
        print(result)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
