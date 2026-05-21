#!/usr/bin/env python3
"""
Western Astrology Knowledge Ingestion
Injects Western astrology data into SEPARATE Qdrant collection

Collection: western_astrology

This script:
- Creates a separate collection for Western astrology ONLY
- Uses same Qdrant instance but different collection name
"""

import os
import sys
import json
import argparse
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

COLLECTION_NAME = "western_astrology"

QDRANT_URL = os.environ.get('QDRANT_URL')
QDRANT_API_KEY = os.environ.get('QDRANT_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Western astrology data path
# Script is at: openclawforaiastro/skills/qdrant/ingest_western_astrology.py
# Data is at: western_astrology_data/ (project root)
WESTERN_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    'western_astrology_data'
)

JSON_FILES = {
    'zodiac_signs': 'zodiac_signs.json',
    'planets': 'planets.json',
    'houses': 'houses.json',
    'aspects': 'aspects.json',
    'planets_in_signs': 'planets_in_signs.json',
    'planets_in_houses': 'planets_in_houses.json',
    'compatibility': 'compatibility.json',
    'crystals_remedies': 'crystals_remedies.json',
    'transits': 'transits.json'
}

# ============================================================================
# QDRANT OPERATIONS
# ============================================================================

def get_collection_info() -> Dict[str, Any]:
    """Get information about the Western astrology collection"""
    if not QDRANT_URL or not QDRANT_API_KEY:
        return {"error": "QDRANT_URL or QDRANT_API_KEY not set"}

    url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json()
        elif resp.status_code == 404:
            return {"exists": False}
        return {"error": f"Status {resp.status_code}: {resp.text}"}
    except Exception as e:
        return {"error": str(e)}


def create_collection() -> bool:
    """Create the Western astrology collection with proper vector config"""
    if not QDRANT_URL or not QDRANT_API_KEY:
        print("Error: QDRANT_URL or QDRANT_API_KEY not set", file=sys.stderr)
        return False

    url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    # Vector config for OpenAI text-embedding-3-small (1536 dimensions)
    payload = {
        "vectors": {
            "size": 1536,
            "distance": "Cosine"
        },
        "payload_schema": {
            "text": "text",
            "category": "keyword",
            "topic": "keyword",
            "sign_name": "keyword",
            "house_number": "integer",
            "planet_name": "keyword",
            "aspect_name": "keyword",
            "element": "keyword",
            "modality": "keyword"
        }
    }

    try:
        resp = requests.put(url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            print(f"✅ Collection '{COLLECTION_NAME}' created successfully", file=sys.stderr)
            return True
        else:
            print(f"Error creating collection: {resp.status_code} - {resp.text}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False


def delete_collection() -> bool:
    """Delete the Western astrology collection"""
    if not QDRANT_URL or not QDRANT_API_KEY:
        print("Error: QDRANT_URL or QDRANT_API_KEY not set", file=sys.stderr)
        return False

    url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        resp = requests.delete(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            print(f"✅ Collection '{COLLECTION_NAME}' deleted successfully", file=sys.stderr)
            return True
        elif resp.status_code == 404:
            print(f"Collection '{COLLECTION_NAME}' does not exist", file=sys.stderr)
            return True
        else:
            print(f"Error deleting collection: {resp.status_code} - {resp.text}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False


def get_collection_stats() -> Dict[str, Any]:
    """Get statistics about the Western astrology collection"""
    info = get_collection_info()

    if "error" in info:
        return info
    if info.get("exists") == False:
        return {"error": "Collection does not exist"}

    try:
        result = info["result"]
        return {
            "status": "exists",
            "vectors_count": result.get("points_count", 0),
            "segments_count": result.get("segments_count", 0),
            "indexed_vectors_count": result.get("indexed_vectors_count", 0)
        }
    except:
        return info


def generate_embedding(text: str) -> List[float] | None:
    """Generate embedding using OpenAI API"""
    if not OPENAI_API_KEY:
        print("Error: OPENAI_API_KEY not set", file=sys.stderr)
        return None

    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "input": text,
            "model": "text-embedding-3-small"
        }
        resp = requests.post("https://api.openai.com/v1/embeddings",
                            headers=headers, json=data, timeout=30)
        if resp.status_code == 200:
            return resp.json()['data'][0]['embedding']
        else:
            print(f"OpenAI Error {resp.status_code}: {resp.text}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Embedding error: {e}", file=sys.stderr)
        return None


def upsert_points(points: List[Dict]) -> bool:
    """Upsert points to Western astrology collection"""
    if not QDRANT_URL or not QDRANT_API_KEY:
        print("Error: QDRANT_URL or QDRANT_API_KEY not set", file=sys.stderr)
        return False

    upsert_url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    payload = {
        "points": [
            {
                "id": p["id"],
                "vector": p["vector"],
                "payload": p["payload"]
            }
            for p in points
        ]
    }

    try:
        resp = requests.put(upsert_url, headers=headers, json=payload, timeout=60)
        if resp.status_code == 200:
            print(f"✅ Upserted {len(points)} points to '{COLLECTION_NAME}'", file=sys.stderr)
            return True
        else:
            print(f"Qdrant Error {resp.status_code}: {resp.text}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Request Error: {str(e)}", file=sys.stderr)
        return False


# ============================================================================
# DATA LOADERS - Western Astrology Only
# ============================================================================

def load_json_file(file_key: str) -> Dict:
    """Load a Western astrology JSON file"""
    if file_key not in JSON_FILES:
        print(f"Unknown file key: {file_key}", file=sys.stderr)
        return {}

    file_path = os.path.join(WESTERN_DATA_DIR, JSON_FILES[file_key])

    if not os.path.exists(file_path):
        print(f"File not found: {file_path}", file=sys.stderr)
        return {}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {file_key}: {e}", file=sys.stderr)
        return {}


# ============================================================================
# DOCUMENT BUILDERS - Transform JSON to Qdrant Documents
# ============================================================================

def build_zodiac_sign_documents(data: Dict) -> List[Dict]:
    """Build documents from zodiac signs data"""
    documents = []

    # Element overview
    for elem_name, elem_data in data.get("elements", {}).items():
        text = f"{elem_name.capitalize()} signs include {', '.join(elem_data.get('signs', []))}. " \
              f"Traits: {', '.join(elem_data.get('traits', []))}. " \
              f"{elem_data.get('description', '')}"
        documents.append({
            "text": text,
            "metadata": {
                "category": "zodiac_sign",
                "topic": "element",
                "element": elem_name
            }
        })

    # Modality overview
    for mod_name, mod_data in data.get("modalities", {}).items():
        text = f"{mod_name.capitalize()} signs include {', '.join(mod_data.get('signs', []))}. " \
              f"Traits: {', '.join(mod_data.get('traits', []))}. " \
              f"{mod_data.get('description', '')}"
        documents.append({
            "text": text,
            "metadata": {
                "category": "zodiac_sign",
                "topic": "modality",
                "modality": mod_name
            }
        })

    # Individual signs
    for sign_name, sign_data in data.get("signs", {}).items():
        text = f"{sign_name} ({sign_data.get('symbol', '')}) is a {sign_data.get('element', '')} sign, " \
              f"{sign_data.get('modality', '')} modality. Dates: {sign_data.get('dates', '')}. " \
              f"Ruled by {sign_data.get('ruling_planet', '')}. " \
              f"Key phrase: '{sign_data.get('key_phrase', '')}'. " \
              f"Strengths: {', '.join(sign_data.get('strengths', [])[:5])}. " \
              f"Personality: {sign_data.get('personality', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "zodiac_sign",
                "topic": "sign_traits",
                "sign_name": sign_name,
                "element": sign_data.get('element'),
                "modality": sign_data.get('modality'),
                "ruling_planet": sign_data.get('ruling_planet')
            }
        })

        # Love and relationships
        if sign_data.get('love_and_relationships'):
            documents.append({
                "text": f"{sign_name} in love: {sign_data.get('love_and_relationships', '')}",
                "metadata": {
                    "category": "zodiac_sign",
                    "topic": "love_relationships",
                    "sign_name": sign_name
                }
            })

        # Career
        if sign_data.get('career_and_work'):
            documents.append({
                "text": f"{sign_name} career: {sign_data.get('career_and_work', '')}",
                "metadata": {
                    "category": "zodiac_sign",
                    "topic": "career",
                    "sign_name": sign_name
                }
            })

        # Compatibility
        if sign_data.get('best_matches'):
            matches = ', '.join(sign_data.get('best_matches', []))
            documents.append({
                "text": f"{sign_name} is most compatible with: {matches}",
                "metadata": {
                    "category": "zodiac_sign",
                    "topic": "compatibility",
                    "sign_name": sign_name
                }
            })

    return documents


def build_planet_documents(data: Dict) -> List[Dict]:
    """Build documents from planets data"""
    documents = []

    for planet_name, planet_data in data.get("planets", {}).items():
        text = f"{planet_name} ({planet_data.get('symbol', '')}) is a {planet_data.get('type', '')}. " \
              f"Keywords: {', '.join(planet_data.get('keywords', [])[:8])}. " \
              f"Rulership: {planet_data.get('rulership', '')}. " \
              f"Description: {planet_data.get('description', '')} " \
              f"Psychological meaning: {planet_data.get('psychological_meaning', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "planet",
                "topic": "planet_meanings",
                "planet_name": planet_name,
                "type": planet_data.get('type'),
                "category_type": planet_data.get('category')
            }
        })

    return documents


def build_house_documents(data: Dict) -> List[Dict]:
    """Build documents from houses data"""
    documents = []

    # House categories
    for cat_name, cat_data in data.get("house_categories", {}).items():
        text = f"{cat_name.capitalize()} houses: {', '.join(map(str, cat_data.get('houses', [])))}. " \
              f"{cat_data.get('description', '')}"
        documents.append({
            "text": text,
            "metadata": {
                "category": "house",
                "topic": "house_category",
                "category_type": cat_name
            }
        })

    # Individual houses
    for house_num, house_data in data.get("houses", {}).items():
        text = f"House {house_num}: {house_data.get('name', '')}. " \
              f"Also known as: {', '.join(house_data.get('alternate_names', []))}. " \
              f"Natural ruler: {house_data.get('natural_ruler', '')}. " \
              f"Life areas: {', '.join(house_data.get('life_areas', [])[:6])}. " \
              f"Description: {house_data.get('description', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "house",
                "topic": "house_meanings",
                "house_number": int(house_num),
                "natural_ruler": house_data.get('natural_ruler'),
                "type": house_data.get('type'),
                "element": house_data.get('element')
            }
        })

    return documents


def build_aspect_documents(data: Dict) -> List[Dict]:
    """Build documents from aspects data"""
    documents = []

    # Aspect categories
    for cat_name, cat_data in data.get("aspect_categories", {}).items():
        text = f"{cat_name.capitalize()} aspects: {', '.join(cat_data.get('aspects', []))}. " \
              f"{cat_data.get('description', '')}"
        documents.append({
            "text": text,
            "metadata": {
                "category": "aspect",
                "topic": "aspect_category",
                "category_type": cat_name
            }
        })

    # Individual aspects
    for aspect_name, aspect_data in data.get("aspects", {}).items():
        text = f"{aspect_name} aspect: {aspect_data.get('angle', '')} degrees, " \
              f"orb {aspect_data.get('orb', '')} degrees. " \
              f"Type: {aspect_data.get('type', '')}, Quality: {aspect_data.get('quality', '')}. " \
              f"Keywords: {', '.join(aspect_data.get('keywords', []))}. " \
              f"Description: {aspect_data.get('description', '')} " \
              f"General meaning: {aspect_data.get('general_meaning', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "aspect",
                "topic": "aspect_meanings",
                "aspect_name": aspect_name,
                "angle": aspect_data.get('angle'),
                "type": aspect_data.get('type'),
                "quality": aspect_data.get('quality')
            }
        })

    return documents


def build_planets_in_signs_documents(data: Dict) -> List[Dict]:
    """Build documents from planets in signs data"""
    documents = []

    # Sun in signs
    sun_data = data.get("Sun_in_Signs", {})
    for sign_name in [k for k in sun_data.keys() if k != "description"]:
        sign_info = sun_data[sign_name]
        text = f"Sun in {sign_name}: {sign_info.get('personality', '')} " \
              f"Strengths: {', '.join(sign_info.get('strengths', []))}. " \
              f"Challenges: {', '.join(sign_info.get('challenges', []))}. " \
              f"Life approach: {sign_info.get('life_approach', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "planet_in_sign",
                "topic": "sun_sign",
                "planet_name": "Sun",
                "sign_name": sign_name
            }
        })

    # Moon in signs
    moon_data = data.get("Moon_in_Signs", {})
    for sign_name in [k for k in moon_data.keys() if k != "description"]:
        sign_info = moon_data[sign_name]
        text = f"Moon in {sign_name}: {sign_info.get('personality', '')} " \
              f"Strengths: {', '.join(sign_info.get('strengths', []))}. " \
              f"Challenges: {', '.join(sign_info.get('challenges', []))}. " \
              f"Life approach: {sign_info.get('life_approach', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "planet_in_sign",
                "topic": "moon_sign",
                "planet_name": "Moon",
                "sign_name": sign_name
            }
        })

    return documents


def build_planets_in_houses_documents(data: Dict) -> List[Dict]:
    """Build documents from planets in houses data"""
    documents = []

    # Sun in houses
    sun_data = data.get("Sun_in_Houses", {})
    for house_num in [k for k in sun_data.keys() if k != "description"]:
        house_info = sun_data[house_num]
        text = f"Sun in House {house_num}: {house_info.get('meaning', '')} " \
              f"Themes: {', '.join(house_info.get('themes', []))}. " \
              f"Strengths: {', '.join(house_info.get('strengths', []))}. " \
              f"Guidance: {house_info.get('guidance', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "planet_in_house",
                "topic": "sun_house",
                "planet_name": "Sun",
                "house_number": int(house_num)
            }
        })

    # Moon in houses
    moon_data = data.get("Moon_in_Houses", {})
    for house_num in [k for k in moon_data.keys() if k != "description"]:
        house_info = moon_data[house_num]
        text = f"Moon in House {house_num}: {house_info.get('meaning', '')} " \
              f"Themes: {', '.join(house_info.get('themes', []))}. " \
              f"Strengths: {', '.join(house_info.get('strengths', []))}. " \
              f"Guidance: {house_info.get('guidance', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "planet_in_house",
                "topic": "moon_house",
                "planet_name": "Moon",
                "house_number": int(house_num)
            }
        })

    return documents


def build_compatibility_documents(data: Dict) -> List[Dict]:
    """Build documents from compatibility data"""
    documents = []

    # Compatibility rules
    rules = data.get("compatibility_rules", {})

    # Element compatibility
    for elem_key, elem_desc in rules.get("element_compatibility", {}).items():
        if isinstance(elem_desc, str) and elem_desc:
            documents.append({
                "text": f"Element compatibility ({elem_key}): {elem_desc}",
                "metadata": {
                    "category": "compatibility",
                    "topic": "element_rules"
                }
            })

    # Modality compatibility
    for mod_key, mod_desc in rules.get("modality_compatibility", {}).items():
        documents.append({
            "text": f"Modality compatibility ({mod_key}): {mod_desc}",
            "metadata": {
                "category": "compatibility",
                "topic": "modality_rules"
            }
        })

    # Sign compatibility
    for sign_name, sign_data in data.get("sign_compatibility", {}).items():
        best = sign_data.get("best_matches", [])
        if best:
            best_str = "; ".join([f"{m['sign']} - {m.get('reason', '')}" for m in best[:2]])
            documents.append({
                "text": f"{sign_name} best matches: {best_str}",
                "metadata": {
                    "category": "compatibility",
                    "topic": "best_matches",
                    "sign_name": sign_name
                }
            })

        challenging = sign_data.get("challenging_matches", [])
        if challenging:
            chall_str = "; ".join([f"{m['sign']} - {m.get('reason', '')}" for m in challenging[:2]])
            documents.append({
                "text": f"{sign_name} challenging matches: {chall_str}",
                "metadata": {
                    "category": "compatibility",
                    "topic": "challenging_matches",
                    "sign_name": sign_name
                }
            })

    return documents


def build_crystals_remedies_documents(data: Dict) -> List[Dict]:
    """Build documents from crystals and remedies data"""
    documents = []

    # Element crystals
    for elem_name, elem_data in data.items():
        if elem_name.endswith("_signs"):
            text = f"{elem_name.replace('_', ' ').capitalize()}: {elem_data.get('general_crystals', [])}. " \
                  f"Colors: {elem_data.get('general_colors', [])}"
            documents.append({
                "text": text,
                "metadata": {
                    "category": "remedies",
                    "topic": "element_crystals",
                    "element": elem_name.replace("_signs", "")
                }
            })

    # Sign remedies
    sign_remedies = data.get("sign_remedies", {})
    for sign_name, remedy_data in sign_remedies.items():
        crystals = remedy_data.get("primary_crystals", [])
        if crystals:
            crystal_str = ", ".join([f"{c['name']} ({c['properties']})" for c in crystals])
            text = f"{sign_name} crystals: {crystal_str}. " \
                  f"Colors: {remedy_data.get('colors', {}).get('primary', '')}. " \
                  f"Affirmation: {remedy_data.get('affirmations', [''])[0] if remedy_data.get('affirmations') else ''}"

            documents.append({
                "text": text,
                "metadata": {
                    "category": "remedies",
                    "topic": "sign_crystals",
                    "sign_name": sign_name
                }
            })

    return documents


def build_transits_documents(data: Dict) -> List[Dict]:
    """Build documents from transits data"""
    documents = []

    # Major transits
    major_transits = data.get("major_transits", {})
    for transit_name, transit_data in major_transits.items():
        text = f"{transit_name}: {transit_data.get('description', '')}. " \
              f"Occurs: {transit_data.get('occurs', '')}. " \
              f"Themes: {', '.join(transit_data.get('themes', []))}. " \
              f"Meaning: {transit_data.get('meaning', '')}"

        documents.append({
            "text": text,
            "metadata": {
                "category": "transit",
                "topic": "major_transit",
                "transit_name": transit_name
            }
        })

    # Planetary transits/retrogrades
    planet_transits = data.get("planetary_transits", {})
    for planet_name, transit_data in planet_transits.items():
        retro_meaning = transit_data.get("retrograde_meaning", "")
        if retro_meaning:
            text = f"{planet_name} Retrograde: {retro_meaning}"
            documents.append({
                "text": text,
                "metadata": {
                    "category": "transit",
                    "topic": "retrograde",
                    "planet_name": planet_name.replace("_transits", "")
                }
            })

    return documents


# ============================================================================
# MAIN INGESTION FUNCTION
# ============================================================================

def ingest_western_astrology(categories: List[str] = None) -> bool:
    """
    Ingest Western astrology data into Qdrant

    Args:
        categories: List of categories to ingest. If None, ingest all.
                   Options: zodiac_signs, planets, houses, aspects,
                             planets_in_signs, planets_in_houses,
                             compatibility, crystals_remedies, transits
    """
    if categories is None:
        categories = list(JSON_FILES.keys())

    print(f"Loading Western astrology data for: {', '.join(categories)}", file=sys.stderr)

    all_documents = []

    # Load and build documents for each category
    if 'zodiac_signs' in categories:
        data = load_json_file('zodiac_signs')
        if data:
            all_documents.extend(build_zodiac_sign_documents(data))

    if 'planets' in categories:
        data = load_json_file('planets')
        if data:
            all_documents.extend(build_planet_documents(data))

    if 'houses' in categories:
        data = load_json_file('houses')
        if data:
            all_documents.extend(build_house_documents(data))

    if 'aspects' in categories:
        data = load_json_file('aspects')
        if data:
            all_documents.extend(build_aspect_documents(data))

    if 'planets_in_signs' in categories:
        data = load_json_file('planets_in_signs')
        if data:
            all_documents.extend(build_planets_in_signs_documents(data))

    if 'planets_in_houses' in categories:
        data = load_json_file('planets_in_houses')
        if data:
            all_documents.extend(build_planets_in_houses_documents(data))

    if 'compatibility' in categories:
        data = load_json_file('compatibility')
        if data:
            all_documents.extend(build_compatibility_documents(data))

    if 'crystals_remedies' in categories:
        data = load_json_file('crystals_remedies')
        if data:
            all_documents.extend(build_crystals_remedies_documents(data))

    if 'transits' in categories:
        data = load_json_file('transits')
        if data:
            all_documents.extend(build_transits_documents(data))

    if not all_documents:
        print("No documents to ingest!", file=sys.stderr)
        return False

    print(f"Prepared {len(all_documents)} documents for ingestion", file=sys.stderr)

    # Generate embeddings and prepare points
    points = []
    point_id = 0

    for doc in all_documents:
        embedding = generate_embedding(doc["text"])
        if embedding:
            points.append({
                "id": point_id,
                "vector": embedding,
                "payload": {
                    "text": doc["text"],
                    **doc["metadata"]
                }
            })
            point_id += 1
        else:
            print(f"Failed to generate embedding for: {doc['text'][:50]}...", file=sys.stderr)

    if not points:
        print("No points to ingest. Embedding generation failed.", file=sys.stderr)
        return False

    print(f"Generated {len(points)} embeddings. Upserting to Qdrant...", file=sys.stderr)

    # Upsert to Qdrant
    success = upsert_points(points)

    if success:
        print(json.dumps({
            "status": "success",
            "message": f"Successfully ingested {len(points)} Western astrology documents",
            "collection": COLLECTION_NAME,
            "documents_count": len(all_documents),
            "points_ingested": len(points),
            "categories": categories
        }, indent=2))
    else:
        print(json.dumps({
            "status": "error",
            "message": "Failed to ingest documents into Qdrant"
        }, indent=2))

    return success


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Western Astrology Qdrant Ingestion',
        epilog=f'Collection name: {COLLECTION_NAME}'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # create-collection command
    create_parser = subparsers.add_parser('create-collection',
                                           help='Create the Western astrology collection')

    # delete-collection command
    delete_parser = subparsers.add_parser('delete-collection',
                                           help='Delete the Western astrology collection')

    # stats command
    stats_parser = subparsers.add_parser('stats',
                                          help='Show collection statistics')

    # ingest command
    ingest_parser = subparsers.add_parser('ingest',
                                          help='Ingest Western astrology data')
    ingest_parser.add_argument('--category',
                                choices=['zodiac_signs', 'planets', 'houses', 'aspects',
                                        'planets_in_signs', 'planets_in_houses',
                                        'compatibility', 'crystals_remedies', 'transits', 'all'],
                                default='all',
                                help='Category to ingest (default: all)')

    args = parser.parse_args()

    if args.command == 'create-collection':
        success = create_collection()
        sys.exit(0 if success else 1)

    elif args.command == 'delete-collection':
        success = delete_collection()
        sys.exit(0 if success else 1)

    elif args.command == 'stats':
        stats = get_collection_stats()
        print(json.dumps(stats, indent=2))
        sys.exit(0)

    elif args.command == 'ingest':
        categories = None if args.category == 'all' else [args.category]
        success = ingest_western_astrology(categories)
        sys.exit(0 if success else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
