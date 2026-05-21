import sys
import json
from duckduckgo_search import DDGS


ASTRO_KEYWORDS = [
    "astrology", "western astrology", "natal chart", "birth chart", "zodiac",
    "sun sign", "moon sign", "rising sign", "ascendant", "planet", "planets",
    "house", "houses", "aspect", "aspects", "transit", "retrograde",
    "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune",
    "pluto", "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
    "ephemeris", "horoscope",
]


def search(query):
    query_lower = query.lower()
    is_astro = any(word in query_lower for word in ASTRO_KEYWORDS)

    if not is_astro:
        return {
            "status": "restricted",
            "message": "Search is restricted to Western astrology topics. Please ask an astrology-related question.",
            "query": query,
        }

    search_queries = [query]
    if "western astrology" not in query_lower:
        search_queries.append(f"{query} western astrology")

    for variation in search_queries:
        print(f"DEBUG: Attempting web search for: '{variation}'", file=sys.stderr)
        results = _perform_search(variation)
        if results:
            return results

    return {
        "status": "success",
        "message": "Continue with the Western astrology knowledge base.",
        "note": "Web search returned no specific results.",
    }


def _perform_search(query):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, region="wt-wt", safesearch="moderate", max_results=5))
            if results:
                return results
    except Exception as e:
        print(f"DEBUG: Search error: {str(e)}", file=sys.stderr)
    return None


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else ""
    results = search(query)
    print(json.dumps(results, indent=2))
