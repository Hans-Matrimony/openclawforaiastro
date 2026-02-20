
#!/usr/bin/env python3
"""
Mem0 CLI Client for OpenClaw Skill.
Invokes the local Mem0 server API.
"""
import sys
import argparse
import json
import urllib.request
import os

MEM0_SERVER = os.getenv("MEM0_URL", "https://rg4g0gkk0wwkk4cc00g4sg0c.api.hansastro.com")
MEM0_API_KEY = os.getenv("MEM0_API_KEY")

def call_api(endpoint, payload=None, method="POST"):
    url = f"{MEM0_SERVER}{endpoint}"
    headers = {
        "Content-Type": "application/json"
    }
    if MEM0_API_KEY:
        headers["Authorization"] = f"Token {MEM0_API_KEY}"
    
    try:
        data = json.dumps(payload).encode("utf-8") if payload else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req) as response:
            return json.load(response)
    except urllib.error.URLError as e:
        print(json.dumps({"error": str(e), "message": "Failed to connect to Mem0 server"}))
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Mem0 Client")
    subparsers = parser.add_subparsers(dest="command", required=True)

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

    if args.command == "search":
        result = call_api("/memory/search", {
            "query": args.query,
            "user_id": args.user_id,
            "limit": args.limit
        })
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
        })
        print(json.dumps(result, indent=2))
        
    elif args.command == "list":
        # GET request for list
        url = f"{MEM0_SERVER}/memory/{args.user_id}?limit={args.limit}"
        try:
            with urllib.request.urlopen(url) as response:
                print(json.dumps(json.load(response), indent=2))
        except urllib.error.URLError as e:
             print(json.dumps({"error": str(e)}))
             sys.exit(1)

if __name__ == "__main__":
    main()
