#!/usr/bin/env python3
"""
Debug script to test MongoDB metadata API vs Mem0 data flow
This helps identify which data source is actually being used
"""

import os
import sys
import json
# Try requests first, fall back to urllib
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False
import subprocess
import time
from datetime import datetime

# Configuration
MONGO_METADATA_URL = "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata"
MEM0_SERVER = "https://rg4g0gkk0wwkk4cc00g4sg0c.api.hansastro.com"
MEM0_API_KEY = os.getenv("MEM0_API_KEY")

def log_step(step_name, data=None, error=None):
    """Log a step with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status = "SUCCESS" if not error else "ERROR"
    prefix = "[OK]" if not error else "[FAIL]"
    print(f"[{timestamp}] {prefix} {step_name}")
    if error:
        print(f"  Error: {error}")
    if data:
        print(json.dumps(data, indent=2))

def call_api_requests(endpoint, params=None, method="GET"):
    """Call API using requests library."""
    url = f"{MONGO_METADATA_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if MEM0_API_KEY:
        headers["Authorization"] = f"Token {MEM0_API_KEY}"

    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        else:
            response = requests.request(method, url, json=params, headers=headers, timeout=10)

        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def call_api_urllib(endpoint, params=None, method="GET"):
    """Call API using urllib (fallback)."""
    url = f"{MONGO_METADATA_URL}{endpoint}"

    # Convert params to query string
    if params:
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        full_url = f"{url}?{query_string}"
    else:
        full_url = url

    try:
        data = json.dumps(params).encode("utf-8") if params else None
        req = urllib.request.Request(full_url, data=data, headers={"Content-Type": "application/json"}, method=method)

        with urllib.request.urlopen(req, timeout=10) as response:
            return json.load(response)
    except Exception as e:
        return {"error": str(e)}

def test_mongodb_metadata(user_id):
    """Test MongoDB metadata API"""
    log_step(f"Testing MongoDB metadata for {user_id}")

    try:
        # Clean user_id (remove telegram: prefix if present)
        clean_user_id = user_id.replace("telegram:", "")

        if HAS_REQUESTS:
            data = call_api_requests(f"/{clean_user_id}")
        else:
            data = call_api_urllib(f"/{clean_user_id}")

        if "error" not in data:
            log_step(f"MongoDB API Success", data)

            # Extract birth details
            birth_data = {
                "dateOfBirth": data.get("dateOfBirth"),
                "timeOfBirth": data.get("timeOfBirth"),
                "birthPlace": data.get("birthPlace"),
                "gender": data.get("gender")
            }

            return birth_data
        else:
            log_step(f"MongoDB API Error", error=data["error"])
            return None

    except Exception as e:
        log_step(f"MongoDB API Exception", error=str(e))
        return None

def test_mem0_data(user_id):
    """Test Mem0 data"""
    log_step(f"Testing Mem0 data for {user_id}")

    try:
        # Clean user_id (remove telegram: prefix if present)
        clean_user_id = user_id.replace("telegram:", "")

        # Build command
        cmd = [
            sys.executable,
            os.path.expanduser("~/.openclaw/skills/mem0/mem0_client.py"),
            "list",
            "--user-id", clean_user_id
        ]

        # Add verbose flag if we want debug output
        # cmd.append("--verbose")

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            data = json.loads(result.stdout)
            log_step(f"Mem0 Success", data)

            # Extract birth details from memories
            birth_details = []
            gender = None

            if "memories" in data:
                for memory in data["memories"]:
                    content = memory.get("content", "")
                    metadata = memory.get("metadata", {})

                    # Check for birth details in content
                    if "DOB:" in content or "TOB:" in content or "Place:" in content:
                        birth_details.append(content)

                    # Check for gender in metadata
                    if metadata.get("gender"):
                        gender = metadata.get("gender")
                    elif "Gender:" in content:
                        # Extract gender from content
                        import re
                        gender_match = re.search(r'Gender:\s*(\w+)', content, re.IGNORECASE)
                        if gender_match:
                            gender = gender_match.group(1)

            return {
                "count": data.get("count", 0),
                "birth_details": birth_details,
                "gender": gender,
                "raw_data": data
            }
        else:
            log_step(f"Mem0 Error", error=f"Return code {result.returncode}: {result.stderr}")
            return None

    except Exception as e:
        log_step(f"Mem0 Exception", error=str(e))
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 debug_user_data_flow.py <user_id>")
        print("Example: python3 debug_user_data_flow.py +919876543210")
        print("Example: python3 debug_user_data_flow.py telegram:1455293571")
        sys.exit(1)

    user_id = sys.argv[1]
    print("=" * 70)
    print("DEBUG: User Data Flow Test")
    print("=" * 70)
    print(f"User ID: {user_id}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()

    # Test MongoDB metadata API first (as per documentation)
    mongo_data = test_mongodb_metadata(user_id)

    # Test Mem0 (what's actually being used)
    mem0_data = test_mem0_data(user_id)

    # Analysis
    print("\n" + "=" * 70)
    print("ANALYSIS")
    print("=" * 70)

    # Check if MongoDB has birth data
    if mongo_data and all(mongo_data.values()):
        print("[OK] MongoDB has complete birth data")
        print("     This should be used according to documentation")
    elif mongo_data:
        print("[WARN] MongoDB has partial birth data")
        print("      Some fields missing")
    else:
        print("[ERROR] MongoDB has no birth data or API failed")

    # Check Mem0 data
    if mem0_data:
        print(f"\n[OK] Mem0 has {mem0_data['count']} memories")
        if mem0_data['gender']:
            print(f"     Gender from Mem0: {mem0_data['gender']}")
        if mem0_data['birth_details']:
            print(f"     Birth details from Mem0: {len(mem0_data['birth_details'])} found")
    else:
        print("\n[ERROR] Mem0 has no data or API failed")

    # Determine which source would be used
    print("\n" + "=" * 70)
    print("WHICH SOURCE WOULD BE USED?")
    print("=" * 70)

    if mongo_data and all(mongo_data.values()):
        print("[IDEAL] According to docs: MongoDB metadata API")
        print("       Fast lookup, optimized for birth details")
    elif mem0_data and mem0_data['count'] > 0:
        print("[ACTUAL] Likely: Mem0 fallback")
        print("        MongoDB failed or incomplete, using Mem0")
    else:
        print("[ACTUAL] No user data found")
        print("        User is new or both APIs failed")

    print("\n" + "=" * 70)
    print("RECOMMENDATIONS")
    print("=" * 70)

    if mongo_data and not all(mongo_data.values()):
        print("- MongoDB API is working but incomplete")
        print("  Consider checking if birth data is being saved correctly")

    if mem0_data and mem0_data['count'] > 0 and not mongo_data:
        print("- Mem0 has data but MongoDB doesn't")
        print("  User data might not be getting saved to MongoDB")

    if not mongo_data and not mem0_data:
        print("- Both APIs failed or user is new")
        print("  Check API endpoints and authentication")

if __name__ == "__main__":
    main()