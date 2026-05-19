#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Western Astrology Knowledge Query Client
Retrieves Western astrology knowledge from SEPARATE Qdrant collection

Collection: western_astrology (COMPLETELY SEPARATE from Vedic's astrology_knowledge)
"""

import os
import sys
import argparse
import requests
import json
from typing import Dict, Any
from dotenv import load_dotenv

# Fix Windows encoding issue
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION - COMPLETELY SEPARATE FROM VEDIC
# ============================================================================

COLLECTION_NAME = "western_astrology"  # Different from "astrology_knowledge"

QDRANT_URL = os.environ.get('QDRANT_URL')
QDRANT_API_KEY = os.environ.get('QDRANT_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')


# ============================================================================
# SEARCH FUNCTIONS
# ============================================================================

def search_western_astrology(
    query: str,
    limit: int = 5,
    category: str = None,
    sign_name: str = None,
    planet_name: str = None,
    house_number: int = None,
    aspect_name: str = None
) -> Dict[str, Any]:
    """
    Search Western astrology knowledge base

    Args:
        query: Natural language question
        limit: Max results (default: 5)
        category: Filter by category (zodiac_sign, planet, house, aspect, etc.)
        sign_name: Filter by sign name
        planet_name: Filter by planet name
        house_number: Filter by house number
        aspect_name: Filter by aspect name

    Returns:
        Dict with search results or error
    """
    if not QDRANT_URL or not QDRANT_API_KEY:
        return {"error": "QDRANT_URL or QDRANT_API_KEY not set"}

    # Generate embedding for query
    vector = None
    if OPENAI_API_KEY:
        try:
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            data = {
                "input": query,
                "model": "text-embedding-3-small"
            }
            resp = requests.post("https://api.openai.com/v1/embeddings",
                                headers=headers, json=data, timeout=10)
            if resp.status_code == 200:
                vector = resp.json()['data'][0]['embedding']
        except Exception as e:
            return {"error": f"Embedding generation failed: {e}"}

    if not vector:
        return {"error": "Could not generate embedding. Check OPENAI_API_KEY"}

    # Build filter
    filter_condition = None
    if category or sign_name or planet_name or house_number or aspect_name:
        must_conditions = []

        if category:
            must_conditions.append({
                "key": "category",
                "match": {"value": category}
            })

        if sign_name:
            must_conditions.append({
                "key": "sign_name",
                "match": {"value": sign_name}
            })

        if planet_name:
            must_conditions.append({
                "key": "planet_name",
                "match": {"value": planet_name}
            })

        if house_number is not None:
            must_conditions.append({
                "key": "house_number",
                "match": {"value": int(house_number)}
            })

        if aspect_name:
            must_conditions.append({
                "key": "aspect_name",
                "match": {"value": aspect_name}
            })

        if must_conditions:
            filter_condition = {"must": must_conditions}

    # Search Qdrant
    search_url = f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search"
    headers = {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
    }

    payload = {
        "vector": vector,
        "limit": int(limit),
        "with_payload": True
    }

    if filter_condition:
        payload["filter"] = filter_condition

    try:
        resp = requests.post(search_url, headers=headers, json=payload, timeout=15)
        if resp.status_code == 200:
            results = resp.json().get('result', [])
            output = []
            for res in results:
                output.append(res.get('payload', {}))

            return {
                "status": "success",
                "collection": COLLECTION_NAME,
                "query": query,
                "results_count": len(output),
                "results": output
            }
        else:
            return {
                "error": f"Qdrant Error {resp.status_code}: {resp.text}",
                "collection": COLLECTION_NAME
            }
    except Exception as e:
        return {
            "error": f"Request failed: {str(e)}",
            "collection": COLLECTION_NAME
        }


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
            data = resp.json()
            result = data.get("result", {})
            return {
                "status": "exists",
                "collection": COLLECTION_NAME,
                "points_count": result.get("points_count", 0),
                "vectors_count": result.get("vectors_count", 0),
                "indexed_vectors_count": result.get("indexed_vectors_count", 0)
            }
        elif resp.status_code == 404:
            return {
                "status": "not_found",
                "collection": COLLECTION_NAME,
                "message": "Collection does not exist. Run: python ingest_western_astrology.py ingest"
            }
        else:
            return {
                "error": f"Status {resp.status_code}: {resp.text}",
                "collection": COLLECTION_NAME
            }
    except Exception as e:
        return {"error": str(e), "collection": COLLECTION_NAME}


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Search Western Astrology Knowledge Base',
        epilog=f'Collection: {COLLECTION_NAME} (separate from Vedic astrology)'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # search command
    search_parser = subparsers.add_parser('search', help='Search Western astrology knowledge')
    search_parser.add_argument('query', help='Search query')
    search_parser.add_argument('--limit', type=int, default=5, help='Max results (default: 5)')
    search_parser.add_argument('--category', help='Filter by category')
    search_parser.add_argument('--sign', help='Filter by sign name')
    search_parser.add_argument('--planet', help='Filter by planet name')
    search_parser.add_argument('--house', type=int, help='Filter by house number')
    search_parser.add_argument('--aspect', help='Filter by aspect name')

    # info command
    info_parser = subparsers.add_parser('info', help='Show collection information')

    args = parser.parse_args()

    if args.command == 'search':
        result = search_western_astrology(
            query=args.query,
            limit=args.limit,
            category=args.category,
            sign_name=args.sign,
            planet_name=args.planet,
            house_number=args.house,
            aspect_name=args.aspect
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0 if "error" not in result else 1)

    elif args.command == 'info':
        info = get_collection_info()
        print(json.dumps(info, indent=2))
        sys.exit(0)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
