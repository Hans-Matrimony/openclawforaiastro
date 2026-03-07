import sys
import json
try:
    from duckduckgo_search import DDGS
except ImportError:
    print(json.dumps({"error": "duckduckgo_search package not installed. Run: python3 -m pip install -U duckduckgo-search"}))
    sys.exit(1)

def search(query):
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=5):
                results.append({
                    "title": r.get('title', ''),
                    "link": r.get('href', ''),
                    "snippet": r.get('body', '')
                })
        if not results:
            return {"status": "no_results", "message": "No results found for this query."}
        return results
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query. Usage: python search.py 'query'"}))
        sys.exit(1)
        
    query = " ".join(sys.argv[1:])
    print(f"DEBUG: Searching for '{query}'", file=sys.stderr)
    results = search(query)
    print(json.dumps(results, indent=2))
