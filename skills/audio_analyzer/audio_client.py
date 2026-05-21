#!/usr/bin/env python3
"""
Audio Analyzer Client
Advanced audio analysis including emotion detection and Western astrology question extraction.
"""

import json
import sys
import re
from typing import Dict


EMOTION_KEYWORDS = {
    "stressed": [
        "tension", "stress", "stressed", "worried", "worry", "panic", "scared", "afraid",
        "dar", "bhay", "pareshan", "pareshani", "ghabra", "ghabrana"
    ],
    "sad": [
        "sad", "unhappy", "depressed", "upset", "feeling down", "low",
        "dukhi", "udas", "negativity", "dard", "pain"
    ],
    "angry": [
        "angry", "furious", "mad", "frustrated", "annoyed", "irritated",
        "gussa", "krodh", "naraz", "naraaz", "aggressive"
    ],
    "happy": [
        "happy", "glad", "excited", "great", "wonderful", "fantastic",
        "khush", "prasann", "acha", "accha", "good"
    ],
    "confused": [
        "confused", "don't understand", "not clear", "uncertain", "unsure",
        "samajh nahi", "samajh nahi aa raha", "clear nahi"
    ],
}


ASTROLOGY_PATTERNS = [
    r"(?:my|meri|mera)\s+(?:birth\s+chart|natal\s+chart|chart|zodiac)",
    r"(?:shaadi|marriage)\s+kab",
    r"(?:career|job|naukri)\s+kaisa",
    r"(?:education|padhai)\s+kaisi",
    r"(?:what|how|when)\s+(?:will|is|are).*(?:astrology|natal\s+chart|birth\s+chart|zodiac)",
    r"(?:remedy|solution|affirmation)\s+(?:kya|hai)",
    r"(?:planet).*(?:effect|asar|prabhav)",
    r"(?:transit|retrograde|aspect)",
    r"tell.*about.*(?:natal\s+chart|birth\s+chart|chart|zodiac)",
    r"predict.*(?:future|bhavishya)",
    r"when.*marriage.*(?:hoga|happens)",
]


ASTROLOGY_TERMS = [
    "natal chart", "birth chart", "zodiac", "sun sign", "moon sign", "rising sign",
    "ascendant", "transit", "retrograde", "aspect", "remedy", "affirmation",
    "shaadi", "marriage", "career", "naukri", "job", "padhai", "education",
    "bhavishya", "future", "prediction", "predict", "horoscope",
]


WELLNESS_PROMPTS = {
    "stress_relief": {
        "mantra": "I breathe in calm and breathe out pressure.",
        "hinglish_mantra": "Main calm inhale karta/karti hoon aur pressure release karta/karti hoon.",
        "description": "Grounding affirmation for stress relief and mental calm",
        "hinglish_description": "Stress relief aur mental calm ke liye grounding affirmation",
        "duration_seconds": 30,
        "benefits": "Reduces anxiety, brings inner peace, calms the mind",
    },
    "marriage_delay": {
        "mantra": "I am open to love that feels steady, honest, and mutual.",
        "hinglish_mantra": "Main steady, honest aur mutual love ke liye open hoon.",
        "description": "Relationship affirmation for patience and openness",
        "hinglish_description": "Relationship patience aur openness ke liye affirmation",
        "duration_seconds": 60,
        "benefits": "Builds emotional clarity, patience, and openness in relationships",
    },
    "career_issues": {
        "mantra": "I choose one clear next step and trust my growth.",
        "hinglish_mantra": "Main ek clear next step choose karta/karti hoon aur apni growth par trust karta/karti hoon.",
        "description": "Career affirmation for confidence and professional growth",
        "hinglish_description": "Career confidence aur professional growth ke liye affirmation",
        "duration_seconds": 45,
        "benefits": "Supports confidence, focus, and steady professional progress",
    },
    "health_issues": {
        "mantra": "I listen to my body and choose care today.",
        "hinglish_mantra": "Main apne body ko listen karta/karti hoon aur aaj care choose karta/karti hoon.",
        "description": "Wellness affirmation for care and steadiness",
        "hinglish_description": "Care aur steadiness ke liye wellness affirmation",
        "duration_seconds": 60,
        "benefits": "Encourages steadiness, self-care, and calm attention",
    },
    "general_wellbeing": {
        "mantra": "I return to myself with kindness and clarity.",
        "hinglish_mantra": "Main kindness aur clarity ke saath apne aap par wapas aata/aati hoon.",
        "description": "Simple affirmation for overall wellbeing",
        "hinglish_description": "Overall wellbeing ke liye simple affirmation",
        "duration_seconds": 30,
        "benefits": "Brings calm, clarity, and emotional steadiness",
    },
}


def detect_emotion(text: str) -> str:
    """Detect emotional state from transcribed text."""
    text_lower = text.lower()

    for emotion, keywords in EMOTION_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return emotion
    return "neutral"


def extract_astrology_question(text: str) -> bool:
    """Check if text contains a Western astrology-related question."""
    text_lower = text.lower()

    if any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in ASTROLOGY_PATTERNS):
        return True
    return any(term in text_lower for term in ASTROLOGY_TERMS)


def detect_language(text: str) -> str:
    """Detect if text is English or Hinglish."""
    hinglish_indicators = [
        "hai", "hain", "kya", "kaise", "kab", "kah", "kar", "ke", "ka",
        "ko", "ki", "hoga", "hogi", "karein", "karo", "batao",
        "batana", "dekho", "suno", "yaar", "main", "mera", "meri",
        "tumhara", "tumhari", "hum", "hamara", "apna", "apni",
    ]

    text_lower = text.lower()
    has_devanagari = any("\u0900" <= c <= "\u097F" for c in text)
    hinglish_word_count = sum(1 for word in hinglish_indicators if word in text_lower.split())

    return "hinglish" if has_devanagari or hinglish_word_count >= 3 else "english"


def analyze_audio(transcript_text: str) -> Dict:
    """Perform complete audio analysis."""
    return {
        "transcript": transcript_text,
        "emotion": detect_emotion(transcript_text),
        "is_astrology_question": extract_astrology_question(transcript_text),
        "language": detect_language(transcript_text),
    }


def get_remedy(category: str, language: str = "english") -> Dict:
    """Return a supportive audio affirmation for the given category."""
    prompt = WELLNESS_PROMPTS.get(category, WELLNESS_PROMPTS["general_wellbeing"])

    if language == "hinglish":
        return {
            "mantra": prompt.get("hinglish_mantra", prompt["mantra"]),
            "description": prompt.get("hinglish_description", prompt["description"]),
            "duration_seconds": prompt["duration_seconds"],
            "benefits": prompt["benefits"],
        }
    return {
        "mantra": prompt["mantra"],
        "description": prompt["description"],
        "duration_seconds": prompt["duration_seconds"],
        "benefits": prompt["benefits"],
    }


def suggest_remedy(emotion: str, is_astrology_question: bool, language: str = "english") -> str:
    """Suggest an affirmation category based on emotion and context."""
    if emotion == "stressed":
        return "stress_relief"
    if emotion == "sad":
        return "general_wellbeing"
    if is_astrology_question:
        return "general_wellbeing"
    return "general_wellbeing"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: audio_client.py <command> <argument>"}))
        print("Commands: analyze <transcript_text>, remedy <category> [--language english|hinglish]")
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "analyze":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Transcript text required for analyze command"}))
                sys.exit(1)

            result = analyze_audio(sys.argv[2])
            result["suggested_remedy"] = suggest_remedy(
                result["emotion"],
                result["is_astrology_question"],
                result["language"],
            )
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return

        if command == "remedy":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Category required for remedy command"}))
                sys.exit(1)

            language = "english"
            if "--language" in sys.argv:
                idx = sys.argv.index("--language")
                if idx + 1 < len(sys.argv):
                    language = sys.argv[idx + 1].lower()

            result = get_remedy(sys.argv[2], language)
            result["category"] = sys.argv[2]
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return

        print(json.dumps({
            "error": f"Unknown command: {command}",
            "available_commands": ["analyze <transcript_text>", "remedy <category> [--language]"],
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
