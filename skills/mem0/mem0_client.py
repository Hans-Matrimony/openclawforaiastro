#!/usr/bin/env python3
"""
Mem0 CLI Client for OpenClaw Skill (Robust Version).
Invokes the local Mem0 server API.
Features:
- Uses requests library with fallback to urllib
- Timeout and retry logic
- Better error handling
- Verbose mode for debugging
"""
import sys
import argparse
import json
import os
import time

# Try requests first, fall back to urllib
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False

MEM0_SERVER = os.getenv("MEM0_URL", "https://rg4g0gkk0wwkk4cc00g4sg0c.api.hansastro.com")
MEM0_API_KEY = os.getenv("MEM0_API_KEY")
DEFAULT_TIMEOUT = 10  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 1  # second

def call_api_requests(endpoint, payload=None, method="POST", verbose=False):
    """Call API using requests library."""
    url = f"{MEM0_SERVER}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if MEM0_API_KEY:
        headers["Authorization"] = f"Token {MEM0_API_KEY}"
    for attempt in range(MAX_RETRIES):
        try:
            if verbose:
                print(f"[DEBUG] Attempt {attempt + 1}/{MAX_RETRIES}: {method} {url}", file=sys.stderr)

            if method == "GET":
                response = requests.get(url, headers=headers, params=payload, timeout=DEFAULT_TIMEOUT)
            else:
                response = requests.request(
                    method, url, json=payload, headers=headers, timeout=DEFAULT_TIMEOUT
                )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if verbose:
                print(f"[DEBUG] Attempt {attempt + 1} failed: {e}", file=sys.stderr)

            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e), "message": f"Failed to connect to Mem0 server after {MAX_RETRIES} attempts"}

def call_api_urllib(endpoint, payload=None, method="POST", verbose=False):
    """Call API using urllib (fallback)."""
    url = f"{MEM0_SERVER}{endpoint}"
    headers = {"Content-Type": "application/json"}

    for attempt in range(MAX_RETRIES):
        try:
            if verbose:
                print(f"[DEBUG] Attempt {attempt + 1}/{MAX_RETRIES}: {method} {url}", file=sys.stderr)

            data = json.dumps(payload).encode("utf-8") if payload else None
            req = urllib.request.Request(url, data=data, headers=headers, method=method)

            # Add timeout context
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as response:
                return json.load(response)

        except urllib.error.URLError as e:
            if verbose:
                print(f"[DEBUG] Attempt {attempt + 1} failed: {e}", file=sys.stderr)

            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e), "message": f"Failed to connect to Mem0 server after {MAX_RETRIES} attempts"}

def call_api(endpoint, payload=None, method="POST", verbose=False):
    """Call API with automatic library selection."""
    if HAS_REQUESTS:
        return call_api_requests(endpoint, payload, method, verbose)
    else:
        return call_api_urllib(endpoint, payload, method, verbose)

def main():
    parser = argparse.ArgumentParser(description="Mem0 Client (Robust Version)")
    # Note: verbose must come BEFORE the command
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug output")
    subparsers = parser.add_subparsers(dest="command", required=True, title="commands")

    # Search
    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--user-id", required=True, help="User ID")
    search_parser.add_argument("--limit", type=int, default=5, help="Result limit")

    # Add
    add_parser = subparsers.add_parser("add")
    add_parser.add_argument("content", help="Memory content")
    add_parser.add_argument("--user-id", required=True, help="User ID")
    add_parser.add_argument("--metadata", default="{}", help="Metadata JSON string")

    # List (get all)
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--user-id", required=True, help="User ID")
    list_parser.add_argument("--limit", type=int, default=100, help="Result limit")

    args = parser.parse_args()
    verbose = getattr(args, 'verbose', False)

    if args.command == "search":
        result = call_api("/memory/search", {
            "query": args.query,
            "user_id": args.user_id,
            "limit": args.limit
        }, verbose=verbose)
        print(json.dumps(result, indent=2))

    elif args.command == "add":
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeError:
            metadata = {}

        result = call_api("/memory/add", {
            "content": args.content,
            "user_id": args.user_id,
            "metadata": metadata
        }, verbose=verbose)
        print(json.dumps(result, indent=2))

    elif args.command == "list":
        result = call_api(
            f"/memory/{args.user_id}?limit={args.limit}",
            method="GET",
            verbose=verbose
        )
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()