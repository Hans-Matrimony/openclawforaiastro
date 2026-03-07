import sys
import json
import time
from duckduckgo_search import DDGS

def search(query):
    # Try the specific query provided by the agent first
    print(f"DEBUG: Searching for '{query}'", file=sys.stderr)
    results = _perform_search(query)
    if results and len(results) > 0:
        return results
    
    # FALLBACK: If no results, try a broader query (remove specific dates/terms)
    # This helps if 'today' or 'March 7 2026' doesn't have many results yet
    broad_query = query.lower().replace("vedic astrology", "").replace("ephemeris", "").replace("today", "current").strip()
    if broad_query != query.lower():
        print(f"DEBUG: No results. Retrying with broader query: '{broad_query}'", file=sys.stderr)
        results = _perform_search(broad_query)
        if results and len(results) > 0:
            return results
    
    # SECOND FALLBACK: Absolute minimum query for Saturn position
    if "saturn" in query.lower():
        min_query = "Saturn transit position March 2026 astrology"
        print(f"DEBUG: Final fallback attempt: '{min_query}'", file=sys.stderr)
        results = _perform_search(min_query)
        if results and len(results) > 0:
            return results
            
    return {"status": "no_results", "message": "No results found even after multiple fallsbacks."}

def _perform_search(query):
    last_error = None
    for attempt in range(2):
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
                if results and len(results) > 0:
                    return results
        except Exception as e:
            last_error = str(e)
            print(f"DEBUG: Attempt {attempt+1} failed: {last_error}", file=sys.stderr)
            time.sleep(1)
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query. Usage: python search.py 'query'"}))
        sys.exit(1)
        
    query = " ".join(sys.argv[1:])
    results = search(query)
    
    # Log raw results to stderr for debugging in Coolify logs
    print(f"DEBUG_RESULTS: {json.dumps(results)}", file=sys.stderr)
    
    # Final JSON output for the openclaw tool execution
    print(json.dumps(results, indent=2))
