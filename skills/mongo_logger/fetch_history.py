#!/usr/bin/env python3
"""
MongoDB Conversation History Fetcher for OpenClaw Skill.

Fetches recent conversation history from MongoDB Logger for context.
"""
import sys
import argparse
import json
import os

# Try requests first, fall back to urllib
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False

# MongoDB Logger URL
MONGO_LOGGER_URL = os.getenv(
    "MONGO_LOGGER_URL",
    "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com",
)

DEFAULT_TIMEOUT = 10
MAX_RETRIES = 3
RETRY_DELAY = 1


def call_api_requests(endpoint, params=None):
    headers = {"Content-Type": "application/json"}
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(
                f"{MONGO_LOGGER_URL}{endpoint}",
                params=params,
                headers=headers,
                timeout=DEFAULT_TIMEOUT,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                import time
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e)}


def call_api_urllib(endpoint, params=None):
    import time
    # Convert params to query string
    if params:
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        full_url = f"{MONGO_LOGGER_URL}{endpoint}?{query_string}"
    else:
        full_url = f"{MONGO_LOGGER_URL}{endpoint}"

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(
                full_url,
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                return json.load(resp)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e)}


def call_api(endpoint, params=None):
    if HAS_REQUESTS:
        return call_api_requests(endpoint, params)
    else:
        return call_api_urllib(endpoint, params)


def fetch_conversation_history(user_id, limit=40):
    """
    Fetch recent conversation history for a user.

    Args:
        user_id: User's phone number or ID
        limit: Number of recent messages to fetch (default: 40)

    Returns:
        Dictionary with messages array and metadata
    """
    result = call_api("/messages", {"userId": user_id, "limit": limit})

    if "error" in result:
        return {"error": result["error"], "messages": []}

    # Extract messages from user sessions
    users = result.get("users", [])
    messages = []

    for user in users:
        sessions = user.get("sessions", [])
        for session in sessions:
            session_messages = session.get("messages", [])
            for msg in session_messages:
                messages.append({
                    "role": msg.get("role", "unknown"),
                    "text": msg.get("text", ""),
                    "timestamp": msg.get("timestamp", "")
                })

    return {
        "user_id": user_id,
        "total_messages": len(messages),
        "messages": messages,
        "fetch_limit": limit
    }


def format_conversation_summary(messages):
    """
    Format conversation messages into a readable summary for the AI.

    Args:
        messages: Array of message objects

    Returns:
        Formatted string summary
    """
    if not messages:
        return "No previous conversation history found."

    summary = []
    summary.append(f"Recent conversation history ({len(messages)} messages):\n")

    # Get last 40 messages (most recent last)
    recent_messages = messages[-40:] if len(messages) > 40 else messages

    for msg in recent_messages:
        role = msg.get("role", "unknown")
        text = msg.get("text", "")
        # Truncate long messages
        if len(text) > 150:
            text = text[:147] + "..."
        summary.append(f"{role.upper()}: {text}")

    return "\n".join(summary)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch conversation history from MongoDB Logger"
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="User ID (phone number or session ID)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=40,
        help="Number of recent messages to fetch (default: 40)"
    )
    parser.add_argument(
        "--format",
        choices=["json", "summary"],
        default="summary",
        help="Output format (default: summary)"
    )

    args = parser.parse_args()

    # Fetch conversation history
    result = fetch_conversation_history(args.user_id, args.limit)

    if args.format == "json":
        print(json.dumps(result, indent=2))
    else:
        # Print summary for AI consumption
        if "error" in result:
            print(f"Error: {result['error']}")
            sys.exit(1)

        print(format_conversation_summary(result.get("messages", [])))


if __name__ == "__main__":
    main()
