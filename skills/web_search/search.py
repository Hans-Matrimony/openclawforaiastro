import sys
import json
import time
from duckduckgo_search import DDGS

def search(query):
    # Try multiple variations to ensure we get results for astrology
    variations = [
        query, # Original
    ]
    
    # If searching for Saturn, try "Shani" and avoid store results
    if "saturn" in query.lower():
        # Variation 1: Add Shani and vedic terms
        var1 = query.lower().replace("saturn", "Shani transit") + " vedic astrology ephemeris"
        variations.append(var1)
        # Variation 2: Negative keywords for store
        var2 = query.lower() + " -store -shop -deals -price -sale -buy"
        variations.append(var2)
        # Variation 3: Specific planetary position search
        variations.append("Saturn transit position today March 2026 vedic")
    
    # Generic variation if no results
    if "today" in query.lower():
        variations.append(query.lower().replace("today", "current transit position"))

    best_error = None
    for v in variations:
        print(f"DEBUG: Attempting search with: '{v}'", file=sys.stderr)
        results = _perform_search(v)
        if results and len(results) > 0:
            # Check if results are likely electronics store results
            is_store = any("saturn.de" in r.get("href", "") or "technik" in r.get("title", "").lower() for r in results)
            if is_store and "saturn" in v.lower():
                print(f"DEBUG: Found store results, skipping...", file=sys.stderr)
                continue
            return results
        
    return {"status": "no_results", "message": "No results found even after multiple variations."}

def _perform_search(query):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            if results and len(results) > 0:
                return results
    except Exception as e:
        print(f"DEBUG: Error during search execution: {str(e)}", file=sys.stderr)
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query. Usage: python search.py 'query'"}))
        sys.exit(1)
        
    query = " ".join(sys.argv[1:])
    results = search(query)
    
    # Print the final result
    print(json.dumps(results, indent=2))
