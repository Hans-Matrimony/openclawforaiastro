#!/usr/bin/env python3
"""
Mem0 CLI Client for OpenClaw Skill (Robust Version).
Invokes the local Mem0 server API.
Features:
- Uses requests library with fallback to urllib
- Timeout and retry logic
- Better error handling
- Verbose mode for debugging
- Phone number normalization
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

def normalize_user_id(user_id):
    """Normalize user IDs for Mem0 queries.
    
    Rules:
    - Phone numbers (WhatsApp): Keep + prefix (e.g., +919876543210)
    - Telegram IDs: Keep as-is WITHOUT + prefix (e.g., 1455293571)
    - Other IDs (web sessions, etc.): Keep as-is
    
    Telegram IDs are numeric but NOT phone numbers, so don't add + prefix.
    """
    if not user_id:
        return user_id
    
    user_id = str(user_id).strip()
    
    # If already has + prefix, it's a phone number - keep it
    if user_id.startswith('+'):
        return user_id
    
    # If it's all digits, check if it's a phone number or Telegram ID
    if user_id.isdigit():
        # Phone numbers with country code are usually 12+ digits
        # Example: 919876543210 (India) = 12 digits
        # Telegram IDs are usually 9-10 digits
        # WhatsApp numbers come WITH + prefix already, so this is for edge cases
        if len(user_id) >= 12:
            # Looks like phone number without +, add it
            return f"+{user_id}"
        else:
            # Likely a Telegram ID or other numeric ID - keep as-is
            return user_id
    
    # Non-numeric IDs (web sessions, etc.) - keep as-is
    return user_id

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

    # Update
    update_parser = subparsers.add_parser("update")
    update_parser.add_argument("--memory-id", required=True, help="Memory ID to update")
    update_parser.add_argument("--content", help="New memory content")
    update_parser.add_argument("--metadata", default="{}", help="Updated metadata JSON string")

    # Delete
    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("--memory-id", required=True, help="Memory ID to delete")

    # Upsert
    upsert_parser = subparsers.add_parser("upsert")
    upsert_parser.add_argument("query", help="Search query to find existing memory")
    upsert_parser.add_argument("--content", required=True, help="Memory content")
    upsert_parser.add_argument("--user-id", required=True, help="User ID")
    upsert_parser.add_argument("--metadata", default="{}", help="Metadata JSON string")
    upsert_parser.add_argument("--limit", type=int, default=5, help="Search result limit")

    args = parser.parse_args()
    verbose = getattr(args, 'verbose', False)

    # Normalize user_id for phone numbers (only for commands that use it)
    normalized_user_id = None
    if hasattr(args, 'user_id') and args.user_id:
        normalized_user_id = normalize_user_id(args.user_id)

    if args.command == "search":
        result = call_api("/memory/search", {
            "query": args.query,
            "user_id": normalized_user_id,
            "limit": args.limit
        }, verbose=verbose)
        print(json.dumps(result, indent=2))

    elif args.command == "add":
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeException:
            metadata = {}

        result = call_api("/memory/add", {
            "content": args.content,
            "user_id": normalized_user_id,
            "metadata": metadata
        }, verbose=verbose)
        print(json.dumps(result, indent=2))

    elif args.command == "list":
        result = call_api(
            f"/memory/{normalized_user_id}?limit={args.limit}",
            method="GET",
            verbose=verbose
        )
        print(json.dumps(result, indent=2))

    elif args.command == "update":
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeException:
            metadata = {}

        payload = {
            "memory_id": args.memory_id,
            "metadata": metadata
        }
        if args.content is not None:
            payload["content"] = args.content

        result = call_api("/memory/update", payload, method="POST", verbose=verbose)
        print(json.dumps(result, indent=2))

    elif args.command == "delete":
        result = call_api(
            f"/memory/{args.memory_id}",
            method="DELETE",
            verbose=verbose
        )
        print(json.dumps(result, indent=2))

    elif args.command == "upsert":
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeException:
            metadata = {}

        # First, search for existing memory
        search_result = call_api("/memory/search", {
            "query": args.query,
            "user_id": normalized_user_id,
            "limit": args.limit
        }, verbose=verbose)

        # Extract results from search response
        results = []
        if isinstance(search_result, dict) and "results" in search_result:
            results = search_result["results"]
        elif isinstance(search_result, list):
            results = search_result

        # Check if search found existing memories with IDs
        memory_id = None
        if results:
            for item in results:
                # Try to get memory_id from various possible fields
                mid = item.get("id") or item.get("memory_id")
                if mid:
                    memory_id = mid
                    break

        if memory_id:
            # Update existing memory
            payload = {
                "memory_id": memory_id,
                "metadata": metadata
            }
            if args.content is not None:
                payload["content"] = args.content

            result = call_api("/memory/update", payload, method="POST", verbose=verbose)
            result["_upsert"] = "updated"
            result["_memory_id"] = memory_id
        else:
            # Add new memory
            result = call_api("/memory/add", {
                "content": args.content,
                "user_id": normalized_user_id,
                "metadata": metadata
            }, verbose=verbose)
            result["_upsert"] = "created"

        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()