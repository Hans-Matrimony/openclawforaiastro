import sys
import json
import time
try:
    from duckduckgo_search import DDGS
except ImportError:
    print(json.dumps({"error": "duckduckgo_search package not installed. Run: python3 -m pip install -U duckduckgo-search"}))
    sys.exit(1)

def search(query, retry=2):
    last_error = None
    for attempt in range(retry):
        try:
            results = []
            # Use a slightly longer timeout or different regions if needed
            # For astrology, no region is often better
            with DDGS() as ddgs:
                # Add a small delay between retries
                if attempt > 0:
                    time.sleep(1)
                
                resp = ddgs.text(query, max_results=5)
                if resp:
                    for r in resp:
                        results.append({
                            "title": r.get('title', ''),
                            "link": r.get('href', ''),
                            "snippet": r.get('body', '')
                        })
            
            if results:
                return results
            
            # If no results, try a slightly modified query for second attempt
            if attempt == 0 and "today" in query.lower():
                query = query.lower().replace("today", "March 2026").replace("current", "transit")
            elif attempt == 0:
                query = query + " astrology"
                
        except Exception as e:
            last_error = str(e)
            time.sleep(1)
            
    if last_error:
        return {"error": last_error, "status": "failed"}
    return {"status": "no_results", "message": "No results found even after retries."}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query. Usage: python search.py 'query'"}))
        sys.exit(1)
        
    query = " ".join(sys.argv[1:])
    print(f"DEBUG: Searching for '{query}'", file=sys.stderr)
    results = search(query)
    print(json.dumps(results, indent=2))
