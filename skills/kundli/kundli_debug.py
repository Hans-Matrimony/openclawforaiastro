#!/usr/bin/env python3
"""
Debug version of Kundli skill to track data source selection
"""

import os
import sys
import json
import subprocess
import requests
from datetime import datetime

# Configuration
MONGO_METADATA_URL = "https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/metadata"
MEM0_SERVER = "https://rg4g0gkk0wwkk4cc00g4sg0c.api.hansastro.com"
MEM0_API_KEY = os.getenv("MEM0_API_KEY")

def log_debug(user_id, step, data=None, error=None):
    """Log debug information"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = {
        "timestamp": timestamp,
        "user_id": user_id,
        "step": step
    }

    if error:
        log_entry["status"] = "ERROR"
        log_entry["error"] = error
        print(f"[{timestamp}] ❌ {step}: {error}")
    else:
        log_entry["status"] = "SUCCESS"
        print(f"[{timestamp}] ✅ {step}")
        if data:
            log_entry["data"] = data
            print(json.dumps(data, indent=2, default=str))

    return log_entry

def get_mongodb_birth_details(user_id):
    """Get birth details from MongoDB metadata API"""
    try:
        clean_user_id = user_id.replace("telegram:", "")
        url = f"{MONGO_METADATA_URL}/{clean_user_id}"
        headers = {"Content-Type": "application/json"}

        if MEM0_API_KEY:
            headers["Authorization"] = f"Token {MEM0_API_KEY}"

        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            birth_details = {
                "dateOfBirth": data.get("dateOfBirth"),
                "timeOfBirth": data.get("timeOfBirth"),
                "birthPlace": data.get("birthPlace"),
                "gender": data.get("gender")
            }

            log_debug(user_id, "MongoDB API Success", birth_details)
            return birth_details
        else:
            log_debug(user_id, "MongoDB API Error", error=f"HTTP {response.status_code}: {response.text}")
            return None

    except Exception as e:
        log_debug(user_id, "MongoDB API Exception", error=str(e))
        return None

def get_mem0_birth_details(user_id):
    """Get birth details from Mem0"""
    try:
        clean_user_id = user_id.replace("telegram:", "")
        cmd = [
            sys.executable,
            os.path.expanduser("~/.openclaw/skills/mem0/mem0_client.py"),
            "list",
            "--user-id", clean_user_id,
            "--verbose"  # Add verbose for more debug info
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            data = json.loads(result.stdout)
            log_debug(user_id, "Mem0 Success", data)

            # Extract birth details from memories
            birth_details = {}
            gender = None

            if "memories" in data:
                for memory in data["memories"]:
                    content = memory.get("content", "")
                    metadata = memory.get("metadata", {})

                    # Extract birth details from content
                    if "DOB:" in content:
                        import re
                        dob_match = re.search(r'DOB:\s*([^,\n]+)', content)
                        if dob_match:
                            birth_details["dateOfBirth"] = dob_match.group(1).strip()

                    if "TOB:" in content:
                        tob_match = re.search(r'TOB:\s*([^,\n]+)', content)
                        if tob_match:
                            birth_details["timeOfBirth"] = tob_match.group(1).strip()

                    if "Place:" in content:
                        place_match = re.search(r'Place:\s*([^\n]+)', content)
                        if place_match:
                            birth_details["birthPlace"] = place_match.group(1).strip()

                    # Extract gender
                    if metadata.get("gender"):
                        gender = metadata.get("gender")
                    elif "Gender:" in content:
                        gender_match = re.search(r'Gender:\s*(\w+)', content, re.IGNORECASE)
                        if gender_match:
                            gender = gender_match.group(1)

            return {
                "birth_details": birth_details,
                "gender": gender,
                "memories_count": data.get("count", 0),
                "raw_memories": data
            }
        else:
            log_debug(user_id, "Mem0 Error", error=f"Return code {result.returncode}: {result.stderr}")
            return None

    except Exception as e:
        log_debug(user_id, "Mem0 Exception", error=str(e))
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 kundli_debug.py <user_id>")
        sys.exit(1)

    user_id = sys.argv[1]
    print("=" * 70)
    print("🔍 DEBUG: Kundli Data Source Selection")
    print("=" * 70)
    print(f"User ID: {user_id}")
    print()

    # Step 1: Check MongoDB first (as per documentation)
    print("Step 1: Checking MongoDB metadata API...")
    mongo_data = get_mongodb_birth_details(user_id)

    # Step 2: Check Mem0 if MongoDB fails or is incomplete
    print("\nStep 2: Checking Mem0...")
    mem0_data = get_mem0_birth_details(user_id)

    # Step 3: Determine which source to use
    print("\n" + "=" * 70)
    print("📊 DATA SOURCE ANALYSIS")
    print("=" * 70)

    # Check MongoDB data
    if mongo_data:
        if all(mongo_data.values()):
            print("✅ MongoDB has complete birth data")
            print("   According to docs, this should be used")
            source_to_use = "mongodb"
        else:
            print("⚠️  MongoDB has partial data")
            if mongo_data["dateOfBirth"] and mongo_data["timeOfBirth"] and mongo_data["birthPlace"]:
                print("   Birth details complete, using MongoDB")
                source_to_use = "mongodb"
            else:
                print("   Birth details incomplete, falling back to Mem0")
                source_to_use = "mem0"
    else:
        print("❌ MongoDB has no data or API failed")
        source_to_use = "mem0"

    # Check Mem0 data
    if mem0_data and mem0_data["memories_count"] > 0:
        print(f"\n✅ Mem0 has {mem0_data['memories_count']} memories")
        if mem0_data["birth_details"]:
            print(f"   Birth details: {mem0_data['birth_details']}")
        if mem0_data["gender"]:
            print(f"   Gender: {mem0_data['gender']}")
    else:
        print("\n❌ Mem0 has no data or API failed")

    # Final decision
    print(f"\n🎯 FINAL DECISION: Using {source_to_use}")

    # Calculate Kundli if we have the data
    if source_to_use == "mongodb" and mongo_data and all(mongo_data.values()):
        print("\n💡 Would calculate Kundli using MongoDB data")
        print(f"   DOB: {mongo_data['dateOfBirth']}")
        print(f"   TOB: {mongo_data['timeOfBirth']}")
        print(f"   Place: {mongo_data['birthPlace']}")
    elif source_to_use == "mem0" and mem0_data and mem0_data["birth_details"]:
        print("\n💡 Would calculate Kundli using Mem0 data")
        print(f"   Birth details: {mem0_data['birth_details']}")
    else:
        print("\n❌ Insufficient data to calculate Kundli")
        print("   Would need to ask user for birth details")

    print("\n" + "=" * 70)
    print("🔍 DEBUG COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()