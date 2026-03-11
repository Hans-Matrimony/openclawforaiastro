#!/usr/bin/env python3
"""
Qdrant Ingestion Script for Vastu Shastra Knowledge
Ingests Vastu principles, rules, and remedies into the vector knowledge base.
"""

import os
import sys
import json
import requests
import argparse
from typing import List, Dict

# Load environment variables
QDRANT_URL = os.environ.get('QDRANT_URL')
QDRANT_API_KEY = os.environ.get('QDRANT_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
COLLECTION_NAME = "astrology_knowledge"

def generate_embedding(text: str) -> List[float] | None:
    """Generate embedding using OpenAI API."""
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
        resp = requests.post("https://api.openai.com/v1/embeddings", headers=headers, json=data)
        if resp.status_code == 200:
            return resp.json()['data'][0]['embedding']
        else:
            print(f"OpenAI Error {resp.status_code}: {resp.text}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Embedding error: {e}", file=sys.stderr)
        return None

def upsert_points(points: List[Dict]) -> bool:
    """Upsert points to Qdrant collection."""
    if not QDRANT_URL or not QDRANT_API_KEY:
        print("Error: QDRANT_URL or QDRANT_API_KEY not set", file=sys.stderr)
        return False

    upsert_url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    # Qdrant batch upsert format
    payload = {
        "points": [
            {
                "id": i,
                "vector": p["vector"],
                "payload": p["payload"]
            }
            for i, p in enumerate(points)
        ]
    }

    try:
        resp = requests.put(upsert_url, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            print(f"Successfully upserted {len(points)} points to Qdrant", file=sys.stderr)
            return True
        else:
            print(f"Qdrant Error {resp.status_code}: {resp.text}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Request Error: {str(e)}", file=sys.stderr)
        return False

def load_vastu_knowledge() -> List[Dict]:
    """Load Vastu knowledge from JSON file."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    vastu_rules_path = os.path.join(script_dir, "../vastu/vastu_rules.json")

    try:
        with open(vastu_rules_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading Vastu rules: {e}", file=sys.stderr)
        return []

def prepare_vastu_documents(vastu_rules: Dict) -> List[Dict]:
    """Prepare Vastu knowledge as documents for ingestion."""
    documents = []

    # 1. Vastu Introduction
    documents.append({
        "text": "Vastu Shastra is the ancient Indian science of architecture. It balances 5 elements (Earth, Water, Fire, Air, Space) with 8 directions (North, South, East, West, NE, NW, SE, SW) and Brahmasthan (center). Proper Vastu brings prosperity, health, and peace.",
        "metadata": {"category": "vastu", "topic": "introduction", "source": "vastu_rules"}
    })

    # 2. Direction Information
    for dir_key, dir_info in vastu_rules.get("directions", {}).items():
        hindi = dir_info.get("hindi", "")
        element = dir_info.get("element", "")
        deity = dir_info.get("deity", "")
        traits = ", ".join(dir_info.get("traits", []))
        best_for = ", ".join(dir_info.get("best_for", []))

        text = f"{dir_key.capitalize()} direction ({hindi} in Hindi) is ruled by {deity} and represents the {element} element. It is associated with {traits}. Ideal for: {best_for}."

        if dir_info.get("avoid"):
            avoid = ", ".join(dir_info.get("avoid", []))
            text += f" Avoid placing: {avoid}."

        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "direction", "direction": dir_key, "source": "vastu_rules"}
        })

    # 3. Room Placement Rules
    for room_key, room_info in vastu_rules.get("rooms", {}).items():
        room_name = room_key.replace("_", " ").title()
        ideal = room_info.get("ideal", [])
        if isinstance(ideal, list):
            ideal_str = ", ".join(ideal)
        else:
            ideal_str = ideal

        acceptable = ", ".join(room_info.get("acceptable", []))
        avoid = ", ".join(room_info.get("avoid", []))
        reason = room_info.get("reason", "")

        text = f"{room_name}: Ideal location is {ideal_str}. Also acceptable: {acceptable}. Avoid: {avoid}. Reason: {reason}"

        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "room_placement", "room": room_key, "source": "vastu_rules"}
        })

    # 4. Entrance Analysis
    for entrance_dir, entrance_info in vastu_rules.get("entrance", {}).items():
        verdict = entrance_info.get("verdict", "")
        benefits = ", ".join(entrance_info.get("benefits", []))
        concerns = ", ".join(entrance_info.get("concerns", []))
        remedies = entrance_info.get("remedies", "")
        hindi = entrance_info.get("hindi", "")

        text = f"Main entrance facing {entrance_dir} ({hindi}): Verdict is {verdict}."

        if benefits:
            text += f" Benefits include: {benefits}."

        if concerns:
            text += f" Concerns include: {concerns}."

        if remedies:
            text += f" Remedies: {remedies}."

        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "entrance", "direction": entrance_dir, "source": "vastu_rules"}
        })

    # 5. Doshas and Remedies
    for dosha_key, dosha_info in vastu_rules.get("doshas", {}).items():
        dosha_name = dosha_key.replace("_", " ").title()
        severity = dosha_info.get("severity", "")
        effects = ", ".join(dosha_info.get("effects", []))
        remedies_list = dosha_info.get("remedies", [])

        text = f"{dosha_name} is a {severity} Vastu dosha. Effects: {effects}. Remedies: {'; '.join(remedies_list)}."

        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "dosha", "dosha": dosha_key, "severity": severity, "source": "vastu_rules"}
        })

    # 6. General Remedies
    general_remedies = vastu_rules.get("remedies", {}).get("general", [])
    text = f"General Vastu remedies: {'; '.join(general_remedies)}. These remedies help balance energy in any property."
    documents.append({
        "text": text,
        "metadata": {"category": "vastu", "topic": "remedies", "source": "vastu_rules"}
    })

    # 7. Color Therapy
    color_info = vastu_rules.get("remedies", {}).get("colors", {}).get("direction_colors", {})
    for dir_key, colors in color_info.items():
        color_str = ", ".join(colors)
        text = f"For {dir_key} direction, use colors like {color_str} to enhance positive energy."
        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "colors", "direction": dir_key, "source": "vastu_rules"}
        })

    # 8. Plants in Vastu
    plants = vastu_rules.get("remedies", {}).get("plants", {})
    auspicious = ", ".join(plants.get("auspicious", []))
    avoid_plants = ", ".join(plants.get("avoid", []))
    text = f"Vastu plants: Auspicious plants include {auspicious}. Avoid plants like {avoid_plants} as they create negative energy."
    documents.append({
        "text": text,
        "metadata": {"category": "vastu", "topic": "plants", "source": "vastu_rules"}
    })

    # 9. Concern Mapping
    for concern, concern_info in vastu_rules.get("concern_mapping", {}).items():
        directions = ", ".join(concern_info.get("directions", []))
        elements = ", ".join(concern_info.get("elements", []))
        remedies = ", ".join(concern_info.get("remedies", []))
        text = f"For {concern} related problems, check {directions} directions and {elements} elements. Vastu remedies include: {remedies}."
        documents.append({
            "text": text,
            "metadata": {"category": "vastu", "topic": "concern", "concern": concern, "source": "vastu_rules"}
        })

    # 10. Brahmasthan (Center)
    documents.append({
        "text": "Brahmasthan is the center of the house. It must remain open, clean, and free from any construction, pillars, or heavy objects. Blocked Brahmasthan causes stagnation in life. Keep a copper pyramid or hang a crystal from the ceiling center to activate it.",
        "metadata": {"category": "vastu", "topic": "brahmasthan", "source": "vastu_rules"}
    })

    return documents

def ingest_vastu_knowledge():
    """Main function to ingest Vastu knowledge into Qdrant."""
    print("Loading Vastu knowledge...", file=sys.stderr)
    vastu_rules = load_vastu_knowledge()

    if not vastu_rules:
        print("Failed to load Vastu rules", file=sys.stderr)
        return

    print("Preparing documents for ingestion...", file=sys.stderr)
    documents = prepare_vastu_documents(vastu_rules)
    print(f"Prepared {len(documents)} documents", file=sys.stderr)

    # Generate embeddings and prepare points
    points = []
    for doc in documents:
        embedding = generate_embedding(doc["text"])
        if embedding:
            points.append({
                "vector": embedding,
                "payload": {
                    "text": doc["text"],
                    **doc["metadata"]
                }
            })
        else:
            print(f"Failed to generate embedding for: {doc['text'][:50]}...", file=sys.stderr)

    if not points:
        print("No points to ingest. Embedding generation failed.", file=sys.stderr)
        return

    print(f"Generated {len(points)} embeddings. Upserting to Qdrant...", file=sys.stderr)

    # Upsert to Qdrant
    success = upsert_points(points)

    if success:
        print(json.dumps({
            "status": "success",
            "message": f"Successfully ingested {len(points)} Vastu knowledge documents into Qdrant",
            "documents_count": len(documents),
            "points_ingested": len(points)
        }, indent=2))
    else:
        print(json.dumps({
            "status": "error",
            "message": "Failed to ingest documents into Qdrant"
        }, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Ingest Vastu knowledge into Qdrant vector database')
    parser.add_argument('command', choices=['ingest'])
    args = parser.parse_args()

    if args.command == 'ingest':
        ingest_vastu_knowledge()
