#!/usr/bin/env python3
"""
Audio Analyzer Client
Advanced audio analysis including emotion detection, astrology question extraction, and remedy suggestions.
"""

import json
import sys
import re
from typing import Dict, List, Tuple


# Emotion keywords for analysis (English, Hinglish, and Brazilian Portuguese)
EMOTION_KEYWORDS = {
    "stressed": [
        "tension", "stress", "stressed", "worried", "worry", "panic", "scared", "afraid",
        "dar", "bhay", "tension", "pareshan", "pareshani", "ghabra", "ghabrana",
        "estresse", "estressado", "estressada", "preocupado", "preocupada", "ansioso", "ansiosa", "medo"
    ],
    "sad": [
        "sad", "unhappy", "depressed", "upset", "feeling down", "low",
        "dukhi", "udas", " negativity", "dard", "pain",
        "triste", "chateado", "chateada", "deprimido", "deprimida", "mal"
    ],
    "angry": [
        "angry", "furious", "mad", "frustrated", "annoyed", "irritated",
        "gussa", "krodh", "naraz", "naraaz", "aggressive",
        "bravo", "brava", "irritado", "irritada", "raiva", "frustrado", "frustrada"
    ],
    "happy": [
        "happy", "glad", "excited", "great", "wonderful", "fantastic",
        "khush", "prasann", "acha", "accha", "good", "great",
        "feliz", "animado", "animada", "otimo", "otima", "maravilhoso", "maravilhosa"
    ],
    "confused": [
        "confused", "don't understand", "not clear", "uncertain", "unsure",
        "confused", "samajh nahi", "samajh nahi aa raha", "clear nahi",
        "confuso", "confusa", "nao entendo", "nao esta claro", "duvida"
    ]
}

# Astrology question patterns (English, Hinglish, and Brazilian Portuguese)
ASTROLOGY_PATTERNS = [
    r"(?:meri|mera)\s+(?:kundli|chart|rashi|lagna)",
    r"(?:shaadi|marriage)\s+kab",
    r"(?:career|job|naukri)\s+kaisa",
    r"(?:education|padhai)\s+kaisi",
    r"(?:what|how|when)\s+(?:will|is|are).*(?:astrology|kundli|chart|rashi)",
    r"(?:remedy|upay|solution)\s+(?:kya|hai)",
    r"(?:graha|planet).*(?:effect|asar|prabhav)",
    r"(?:dasha|mahadasha|antar)", r"(?:gochar|transit)",
    r"(?:yog|yoga)\s+(?:hai|is)",
    r"tell.*about.*(?:kundli|chart|rashi)",
    r"predict.*(?:future|bhavishya)",
    r"when.*marriage.*(?:hoga|happens)",
    r"(?:meu|minha)\s+(?:mapa|kundli|signo|rashi|lagna)",
    r"(?:casamento|carreira|trabalho|amor)\s+(?:quando|como)",
    r"(?:previsao|previsão).*(?:futuro|astrologia|mapa)",
    r"(?:remedio|remédio|solucao|solução)\s+(?:para|astrologico|astrológico)"
]

# Common astrology terms
ASTROLOGY_TERMS = [
    "kundli", "rashi", "lagna", "graha", "dasha", "mahadasha", "antar",
    "gochar", "transit", "yog", "yoga", "upay", "remedy", "shaadi", "marriage",
    "career", "naukri", "job", "padhai", "education", "bhavishya", "future",
    "prediction", "predict", "horoscope", "janam patri", "birth chart",
    "mapa", "signo", "previsao", "previsão", "casamento", "carreira",
    "trabalho", "amor", "futuro", "astrologia", "remedio", "remédio"
]

# Audio remedies (mantras and prayers)
REMEDIES_AUDIO = {
    "stress_relief": {
        "mantra": "Om Shanti Shanti Shanti",
        "hinglish_mantra": "ॐ शान्ति शान्ति शान्ति",
        "description": "Peace mantra for stress relief and mental calm",
        "hinglish_description": "Shanti mantra for stress relief aur mental calm ke liye",
        "duration_seconds": 30,
        "benefits": "Reduces anxiety, brings inner peace, calms the mind"
    },
    "marriage_delay": {
        "mantra": "Om Namah Bhagvate Vasudevaya",
        "hinglish_mantra": "ॐ नमो भगवते वासुदेवाय",
        "description": "Vishnu mantra for removing marriage obstacles",
        "hinglish_description": "Vishnu mantra marriage ki rukawat door karne ke liye",
        "duration_seconds": 60,
        "benefits": "Removes obstacles in marriage, brings favorable partner"
    },
    "career_issues": {
        "mantra": "Om Dum Durgayei Namaha",
        "hinglish_mantra": "ॐ दुं दुर्गायै नमः",
        "description": "Durga mantra for career success and professional growth",
        "hinglish_description": "Durga mantra career success aur professional growth ke liye",
        "duration_seconds": 45,
        "benefits": "Brings success in career, removes professional obstacles"
    },
    "health_issues": {
        "mantra": "Om Trayambakam Yajamahe Sugandhim Pushti Vardhanam",
        "hinglish_mantra": "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टि वर्धनम्",
        "description": "Maha Mrityunjaya mantra for health and longevity",
        "hinglish_description": "Maha Mrityunjaya mantra health aur longevity ke liye",
        "duration_seconds": 60,
        "benefits": "Improves health, removes diseases, brings longevity"
    },
    "general_wellbeing": {
        "mantra": "Om Sarve Bhavantu Sukhinah",
        "hinglish_mantra": "ॐ सर्वे भवन्तु सुखिनः",
        "description": "Universal peace mantra for overall wellbeing",
        "hinglish_description": "Universal peace mantra overall wellbeing ke liye",
        "duration_seconds": 30,
        "benefits": "Brings peace, prosperity, and happiness to all"
    }
}

PT_BR_REMEDY_DESCRIPTIONS = {
    "stress_relief": "Mantra de paz para aliviar o estresse e acalmar a mente",
    "marriage_delay": "Mantra de Vishnu para remover obstaculos no casamento",
    "career_issues": "Mantra de Durga para sucesso na carreira e crescimento profissional",
    "health_issues": "Maha Mrityunjaya mantra para saude e longevidade",
    "general_wellbeing": "Mantra universal de paz para bem-estar geral",
}


def detect_emotion(text: str) -> str:
    """
    Detect emotional state from transcribed text.

    Args:
        text: Transcribed audio text

    Returns:
        Detected emotion: stressed, sad, angry, happy, confused, or neutral
    """
    text_lower = text.lower()
    emotions_found = []

    # Check each emotion category
    for emotion, keywords in EMOTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                emotions_found.append(emotion)
                break  # Found this emotion, move to next

    # Return first detected emotion or neutral
    return emotions_found[0] if emotions_found else "neutral"


def extract_astrology_question(text: str) -> bool:
    """
    Check if text contains an astrology-related question.

    Args:
        text: Transcribed audio text

    Returns:
        True if astrology question detected, False otherwise
    """
    text_lower = text.lower()

    # Check regex patterns
    for pattern in ASTROLOGY_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True

    # Check for astrology terms (must have at least one)
    for term in ASTROLOGY_TERMS:
        if term in text_lower:
            return True

    return False


def detect_language(text: str) -> str:
    """
    Detect if text is English, Hinglish, or Brazilian Portuguese.

    Args:
        text: Transcribed audio text

    Returns:
        "english", "hinglish", or "portuguese_brazil"
    """
    # Check for Hindi/Devanagari characters or common Hinglish words
    hinglish_indicators = [
        "hai", "hain", "kya", "kaise", "kab", "kah", "kar", "ke", "ka",
        "ko", "ki", "hai", "hoga", "hogi", "karein", "karo", "batao",
        "batana", "dekho", "suno", "arere", "yaar", "main", "mera", "meri",
        "tumhara", "tumhari", "hum", "hamara", "apna", "apni"
    ]
    portuguese_indicators = [
        "voce", "você", "minha", "meu", "quero", "saber", "sobre", "casamento",
        "carreira", "saude", "saúde", "familia", "família", "trabalho", "amor",
        "relacionamento", "mapa", "signo", "quando", "como", "previsao",
        "previsão", "obrigado", "obrigada", "gratis", "grátis", "preco", "preço"
    ]

    text_lower = text.lower()

    # Check for Devanagari Unicode range
    has_devanagari = any('\u0900' <= c <= '\u097F' for c in text)

    # Check for Hinglish words
    hinglish_word_count = sum(1 for word in hinglish_indicators if word in text_lower.split())
    portuguese_count = sum(1 for word in portuguese_indicators if word in text_lower.split())

    if any(alias in text_lower for alias in ["pt-br", "pt_br", "brazilian portuguese", "portuguese brazil"]):
        return "portuguese_brazil"

    if portuguese_count >= 2:
        return "portuguese_brazil"

    if has_devanagari or hinglish_word_count >= 3:
        return "hinglish"
    else:
        return "english"


def analyze_audio(transcript_text: str) -> Dict:
    """
    Perform complete audio analysis.

    Args:
        transcript_text: Transcribed audio text

    Returns:
        Analysis result with emotion, astrology detection, and language
    """
    result = {
        "transcript": transcript_text,
        "emotion": detect_emotion(transcript_text),
        "is_astrology_question": extract_astrology_question(transcript_text),
        "language": detect_language(transcript_text)
    }
    return result


def get_remedy(category: str, language: str = "english") -> Dict:
    """
    Get audio remedy for given category.

    Args:
        category: Remedy category (stress_relief, marriage_delay, career_issues, etc.)
        language: Response language (english, hinglish, or portuguese_brazil)

    Returns:
        Remedy details with mantra, description, duration, and benefits
    """
    remedy = REMEDIES_AUDIO.get(category, REMEDIES_AUDIO["general_wellbeing"])

    normalized_language = language.lower().replace("-", "_")

    if normalized_language in {"portuguese_brazil", "brazilian_portuguese", "pt_br", "pt"}:
        return {
            "mantra": remedy["mantra"],
            "description": PT_BR_REMEDY_DESCRIPTIONS.get(category, remedy["description"]),
            "duration_seconds": remedy["duration_seconds"],
            "benefits": remedy["benefits"]
        }

    if normalized_language == "hinglish":
        return {
            "mantra": remedy.get("hinglish_mantra", remedy["mantra"]),
            "description": remedy.get("hinglish_description", remedy["description"]),
            "duration_seconds": remedy["duration_seconds"],
            "benefits": remedy["benefits"]
        }
    else:
        return {
            "mantra": remedy["mantra"],
            "description": remedy["description"],
            "duration_seconds": remedy["duration_seconds"],
            "benefits": remedy["benefits"]
        }


def suggest_remedy(emotion: str, is_astrology_question: bool, language: str = "english") -> str:
    """
    Suggest appropriate remedy based on emotion and context.

    Args:
        emotion: Detected emotion
        is_astrology_question: Whether user asked astrology question
        language: Response language

    Returns:
        Suggested remedy category
    """
    if emotion == "stressed":
        return "stress_relief"
    elif emotion == "sad":
        return "general_wellbeing"
    elif is_astrology_question:
        return "general_wellbeing"  # General mantra for astrology seekers
    else:
        return "general_wellbeing"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: audio_client.py <command> <argument>"}))
        print("Commands: analyze <transcript_text>, remedy <category> [--language english|hinglish|portuguese_brazil]")
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "analyze":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Transcript text required for analyze command"}))
                sys.exit(1)

            transcript = sys.argv[2]
            result = analyze_audio(transcript)

            # Suggest remedy based on analysis
            remedy_category = suggest_remedy(
                result["emotion"],
                result["is_astrology_question"],
                result["language"]
            )
            result["suggested_remedy"] = remedy_category

            print(json.dumps(result, indent=2, ensure_ascii=False))

        elif command == "remedy":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "Category required for remedy command"}))
                sys.exit(1)

            category = sys.argv[2]
            language = "english"

            # Parse optional --language flag
            if "--language" in sys.argv:
                try:
                    idx = sys.argv.index("--language")
                    if idx + 1 < len(sys.argv):
                        language = sys.argv[idx + 1].lower()
                except (ValueError, IndexError):
                    pass

            result = get_remedy(category, language)
            result["category"] = category

            print(json.dumps(result, indent=2, ensure_ascii=False))

        else:
            print(json.dumps({
                "error": f"Unknown command: {command}",
                "available_commands": ["analyze <transcript_text>", "remedy <category> [--language]"]
            }))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
