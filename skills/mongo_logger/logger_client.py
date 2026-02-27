#!/usr/bin/env python3
"""Mongo Logger CLI Client for OpenClaw Skill.

Logs chat messages to the openclaw_mongo_logger service.
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

# Full URL to the logger webhook (Coolify URL)
# Example: https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/webhook
MONGO_LOGGER_URL = os.getenv(
    "MONGO_LOGGER_URL",
    "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/webhook",
)

DEFAULT_TIMEOUT = 10
MAX_RETRIES = 3
RETRY_DELAY = 1


def call_api_requests(payload):
    headers = {"Content-Type": "application/json"}
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                MONGO_LOGGER_URL,
                json=payload,
                headers=headers,
                timeout=DEFAULT_TIMEOUT,
            )
            resp.raise_for_status()
            # logger returns {"status": "received"} – just print it
            return resp.json()
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e)}


def call_api_urllib(payload):
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(
                MONGO_LOGGER_URL,
                data=data,
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
                # Body is small JSON like {"status": "received"}
                return json.load(resp)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return {"error": str(e)}


def call_api(payload):
    if HAS_REQUESTS:
        return call_api_requests(payload)
    else:
        return call_api_urllib(payload)


def main():
    parser = argparse.ArgumentParser(description="Mongo Logger Client")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Single command: log one message
    log_parser = subparsers.add_parser("log", help="Log a chat message")
    log_parser.add_argument(
        "--session-id", required=True, help="Chat or thread id"
    )
    log_parser.add_argument(
        "--user-id", required=True, help="Stable user identifier"
    )
    log_parser.add_argument(
        "--role",
        required=True,
        choices=["user", "assistant"],
        help="Speaker role",
    )
    log_parser.add_argument("--text", required=True, help="Message text")
    log_parser.add_argument(
        "--channel",
        default="whatsapp",
        help="Channel name (whatsapp, telegram, web, etc.)",
    )

    args = parser.parse_args()

    if args.command == "log":
        payload = {
            "sessionId": args.session_id,
            "userId": args.user_id,
            "role": args.role,
            "text": args.text,
            "channel": args.channel,
        }
        result = call_api(payload)
        print(json.dumps(result))


if __name__ == "__main__":
    main()
