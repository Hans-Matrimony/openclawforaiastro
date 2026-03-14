#!/usr/bin/env python3
"""
Vastu Shastra Analysis Calculator
Analyzes property Vastu compliance based on direction, room placement, and elements.
"""

import sys
import os
import json
import argparse
from typing import Dict, List, Optional

# Use relative path for reliability across environments
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RULES_FILE = os.path.join(SCRIPT_DIR, 'vastu_rules.json')


def load_rules():
    """Load Vastu rules from JSON file."""
    try:
        with open(RULES_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Failed to load rules: {str(e)}"}


def normalize_direction(direction: str) -> str:
    """Normalize direction input to lowercase with underscores."""
    return direction.lower().replace(" ", "_").replace("-", "_")


def analyze_entrance(direction: str, rules: Dict) -> Dict:
    """Analyze entrance direction for Vastu compliance."""
    norm_dir = normalize_direction(direction)
    entrance_info = rules.get("entrance", {}).get(norm_dir, {})

    if not entrance_info:
        return {
            "direction": direction,
            "status": "unknown",
            "message": f"Direction '{direction}' not recognized. Valid: north, south, east, west, northeast, northwest, southeast, southwest"
        }

    verdict = entrance_info.get("verdict", "unknown")
    result = {
        "direction": direction,
        "hindi_name": entrance_info.get("hindi", ""),
        "verdict": verdict,
        "benefits": entrance_info.get("benefits", []),
        "concerns": entrance_info.get("concerns", []),
        "remedies": entrance_info.get("remedies", "")
    }

    # Add score based on verdict
    scores = {"excellent": 100, "moderate": 70, "challenging": 50, "critical": 30, "unknown": 50}
    result["score"] = scores.get(verdict, 50)

    return result


def analyze_room(room: str, direction: str, rules: Dict) -> Dict:
    """Analyze room placement for Vastu compliance."""
    norm_dir = normalize_direction(direction)
    room_key = room.lower().replace(" ", "_")

    # Check aliases first
    aliases = rules.get("room_aliases", {})
    canonical_room = aliases.get(room_key, room_key)

    room_rules = rules.get("rooms", {}).get(canonical_room, {})

    if not room_rules:
        return {
            "room": room,
            "location": direction,
            "status": "unknown_room",
            "message": f"Room type '{room}' not in database"
        }

    ideal = room_rules.get("ideal")
    acceptable = room_rules.get("acceptable", [])
    avoid = room_rules.get("avoid", [])

    # Check if direction matches
    if isinstance(ideal, list):
        is_ideal = norm_dir in ideal
    else:
        is_ideal = norm_dir == ideal

    is_acceptable = norm_dir in acceptable
    is_avoid = norm_dir in avoid

    if is_ideal:
        status = "ideal"
        score = 100
        message = f"{room} in {direction} is ideal. {room_rules.get('reason', '')}"
    elif is_acceptable:
        status = "acceptable"
        score = 75
        message = f"{room} in {direction} is acceptable. Ideally use: {ideal}"
    elif is_avoid:
        status = "avoid"
        score = 30
        message = f"{room} in {direction} is NOT recommended. {room_rules.get('reason', '')}"
    else:
        status = "neutral"
        score = 60
        message = f"{room} in {direction} is neutral placement."

    return {
        "room": room,
        "location": direction,
        "status": status,
        "score": score,
        "message": message,
        "ideal_location": ideal,
        "reason": room_rules.get("reason", "")
    }


def detect_doshas(rooms: Dict[str, str], rules: Dict) -> List[Dict]:
    """Detect Vastu doshas based on room placements."""
    detected = []

    dosha_rules = rules.get("doshas", {})
    aliases = rules.get("room_aliases", {})

    # Check room combinations that create doshas
    # Include both canonical names and aliases
    room_mappings = {
        "northeast_toilet": ["toilet", "bathroom", "washroom"],
        "southeast_bedroom": ["bedroom", "master_bedroom", "master_bed", "main_bedroom"],
        "southwest_kitchen": ["kitchen"],
        "kitchen_northeast": ["kitchen"],
        "toilet_southwest": ["toilet", "bathroom", "washroom"]
    }

    for dosha_key, room_types in room_mappings.items():
        dosha_info = dosha_rules.get(dosha_key)
        if not dosha_info:
            continue

        # Check if any room in rooms dict matches the dosha condition
        for room_name, direction in rooms.items():
            if room_name.lower() in [rt.lower() for rt in room_types]:
                norm_dir = normalize_direction(direction)

                # Check if direction matches the dosha
                if dosha_key == "northeast_toilet" and norm_dir == "northeast":
                    detected.append({
                        "dosha": dosha_key,
                        "severity": dosha_info.get("severity"),
                        "cause": f"{room_name} in {direction}",
                        "effects": dosha_info.get("effects", []),
                        "remedies": dosha_info.get("remedies", [])
                    })
                elif dosha_key == "southeast_bedroom" and norm_dir == "southeast":
                    detected.append({
                        "dosha": dosha_key,
                        "severity": dosha_info.get("severity"),
                        "cause": f"{room_name} in {direction}",
                        "effects": dosha_info.get("effects", []),
                        "remedies": dosha_info.get("remedies", [])
                    })
                elif dosha_key == "southwest_kitchen" and norm_dir == "southwest":
                    detected.append({
                        "dosha": dosha_key,
                        "severity": dosca_info.get("severity"),
                        "cause": f"{room_name} in {direction}",
                        "effects": dosha_info.get("effects", []),
                        "remedies": dosha_info.get("remedies", [])
                    })
                elif dosha_key == "kitchen_northeast" and norm_dir == "northeast":
                    detected.append({
                        "dosha": dosha_key,
                        "severity": dosha_info.get("severity"),
                        "cause": f"{room_name} in {direction}",
                        "effects": dosha_info.get("effects", []),
                        "remedies": dosha_info.get("remedies", [])
                    })
                elif dosha_key == "toilet_southwest" and norm_dir == "southwest":
                    detected.append({
                        "dosha": dosha_key,
                        "severity": dosha_info.get("severity"),
                        "cause": f"{room_name} in {direction}",
                        "effects": dosha_info.get("effects", []),
                        "remedies": dosha_info.get("remedies", [])
                    })

    return detected


def get_concern_remedies(concerns: List[str], rules: Dict) -> List[Dict]:
    """Get specific remedies based on user's concerns."""
    concern_map = rules.get("concern_mapping", {})
    remedies = []

    for concern in concerns:
        concern_lower = concern.lower()
        for key, value in concern_map.items():
            if key in concern_lower or concern_lower in key:
                remedies.append({
                    "concern": concern,
                    "directions": value.get("directions", []),
                    "elements": value.get("elements", []),
                    "remedies": value.get("remedies", [])
                })

    return remedies if remedies else [{"message": "Specific remedies not found. Consult general remedies."}]


def check_element_balance(rooms: Dict[str, str], rules: Dict) -> Dict:
    """Check balance of 5 elements based on room placements."""
    direction_elements = {}
    for dir_key, dir_info in rules.get("directions", {}).items():
        direction_elements[dir_key] = dir_info.get("element", "")

    # Count elements from room placements
    element_count = {"fire": 0, "water": 0, "earth": 0, "air": 0, "space": 0}

    for room_name, direction in rooms.items():
        norm_dir = normalize_direction(direction)
        element = direction_elements.get(norm_dir, "")
        if element and element in element_count:
            element_count[element] += 1

    # Determine balance status
    max_count = max(element_count.values()) if element_count else 0
    min_count = min(element_count.values()) if element_count else 0

    balance_status = "balanced" if max_count - min_count <= 1 else "imbalanced"

    return {
        "status": balance_status,
        "element_count": element_count,
        "dominant": max(element_count, key=element_count.get) if element_count else None,
        "weak": min(element_count, key=element_count.get) if element_count else None
    }


def calculate_vastu_score(entrance_analysis: Dict, room_analyses: List[Dict], doshas: List[Dict]) -> int:
    """Calculate overall Vastu score (0-100)."""
    # Entrance weight: 40%
    entrance_score = entrance_analysis.get("score", 50) * 0.4

    # Room placements weight: 60%
    if room_analyses:
        room_score = sum(r.get("score", 50) for r in room_analyses) / len(room_analyses) * 0.6
    else:
        room_score = 50 * 0.6

    # Doshas penalty: -20%
    dosha_penalty = 0
    for dosha in doshas:
        severity = dosha.get("severity", "moderate")
        if severity == "critical":
            dosha_penalty += 15
        elif severity == "high":
            dosha_penalty += 10
        elif severity == "moderate":
            dosha_penalty += 5

    total_score = int(entrance_score + room_score - min(dosha_penalty, 25))
    return max(0, min(100, total_score))


def analyze_vastu(
    property_type: str,
    entrance: str,
    rooms: Optional[str] = None,
    concerns: Optional[str] = None
) -> Dict:
    """
    Main function to analyze Vastu of a property.

    Args:
        property_type: flat, house, office, shop
        entrance: Main entrance direction
        rooms: JSON string of room locations e.g. '{"kitchen": "southeast", "bedroom": "southwest"}'
        concerns: Comma-separated concerns e.g. "money,health"

    Returns:
        JSON with complete Vastu analysis
    """
    rules = load_rules()

    if "error" in rules:
        return {"error": rules["error"]}

    # Parse rooms JSON if provided
    room_dict = {}
    if rooms:
        try:
            room_dict = json.loads(rooms)
        except:
            return {"error": f"Invalid rooms JSON: {rooms}"}

    # Parse concerns
    concern_list = []
    if concerns:
        concern_list = [c.strip() for c in concerns.split(",")]

    # Analyze entrance
    entrance_analysis = analyze_entrance(entrance, rules)

    # Analyze each room
    room_analyses = []
    for room, direction in room_dict.items():
        room_analyses.append(analyze_room(room, direction, rules))

    # Detect doshas
    doshas = detect_doshas(room_dict, rules)

    # Check element balance
    element_balance = check_element_balance(room_dict, rules)

    # Get concern-specific remedies
    concern_remedies = []
    if concern_list:
        concern_remedies = get_concern_remedies(concern_list, rules)

    # Calculate overall score
    overall_score = calculate_vastu_score(entrance_analysis, room_analyses, doshas)

    # Compile general remedies
    general_remedies = rules.get("remedies", {}).get("general", [])

    # Build result
    result = {
        "property_type": property_type,
        "overall_score": overall_score,
        "summary": get_summary(overall_score, entrance_analysis, doshas),
        "entrance": entrance_analysis,
        "rooms": room_analyses,
        "doshas": doshas,
        "element_balance": element_balance,
        "general_remedies": general_remedies,
        "concern_remedies": concern_remedies,
        "user_input": {
            "property_type": property_type,
            "entrance": entrance,
            "rooms": room_dict,
            "concerns": concern_list
        }
    }

    return result


def get_summary(score: int, entrance: Dict, doshas: List[Dict]) -> str:
    """Generate a brief summary of the analysis."""
    if score >= 80:
        verdict = "excellent"
        message = "Your property has excellent Vastu compliance."
    elif score >= 60:
        verdict = "good"
        message = "Your property has good Vastu with minor improvements possible."
    elif score >= 40:
        verdict = "moderate"
        message = "Your property needs some Vastu corrections."
    else:
        verdict = "poor"
        message = "Your property has significant Vastu issues that need attention."

    entrance_verdict = entrance.get("verdict", "unknown")
    dosha_count = len([d for d in doshas if d.get("severity") in ["critical", "high"]])

    summary = f"Overall: {verdict.upper()} ({score}/100). {message} "
    summary += f"Entrance: {entrance_verdict}. "

    if dosha_count > 0:
        summary += f"Found {dosha_count} serious dosha(s) requiring remedies."
    else:
        summary += "No major doshas detected."

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Vastu Shastra Analysis Calculator')
    parser.add_argument('--type', required=True, choices=['flat', 'house', 'office', 'shop'],
                       help='Type of property')
    parser.add_argument('--entrance', required=True,
                       help='Main entrance direction (north, south, east, west, northeast, northwest, southeast, southwest)')
    parser.add_argument('--rooms', help='Room locations as JSON string, e.g. \'{"kitchen": "southeast", "bedroom": "southwest"}\'')
    parser.add_argument('--concerns', help='Comma-separated concerns, e.g. "money,health,relationship"')

    args = parser.parse_args()

    try:
        output = analyze_vastu(
            property_type=args.type,
            entrance=args.entrance,
            rooms=args.rooms,
            concerns=args.concerns
        )
        print(json.dumps(output, indent=2, default=lambda x: str(x)))
    except Exception as e:
        import traceback
        error_info = {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))
        sys.exit(1)
