#!/usr/bin/env python3
"""
Daily Horoscope Scheduler
Sends personalized daily horoscopes to subscribed users via WhatsApp
"""

import sys
import os
import json
import argparse
from datetime import datetime
from typing import Dict, List

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from calculate import generate_daily_horoscope


# User storage - In production, use your MongoDB or database
# For now, using a local JSON file
USERS_FILE = os.path.join(SCRIPT_DIR, 'subscribed_users.json')


def load_subscribed_users() -> List[Dict]:
    """Load all subscribed users from storage."""
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading users: {e}", file=sys.stderr)
        return []


def save_subscribed_users(users: List[Dict]):
    """Save subscribed users to storage."""
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving users: {e}", file=sys.stderr)


def subscribe_user(
    user_id: str,
    dob: str,
    tob: str,
    place: str,
    language: str = 'auto',
    preferred_time: str = '08:00',
    channel: str = 'whatsapp'
) -> Dict:
    """
    Subscribe a user to daily horoscope service.

    Args:
        user_id: Unique identifier (phone number, email, etc.)
        dob: Date of birth
        tob: Time of birth
        place: Place of birth
        language: 'english', 'hinglish', or 'auto'
        preferred_time: Time to send horoscope (HH:MM format)
        channel: Delivery channel (whatsapp, email, etc.)

    Returns:
        Subscription status
    """
    users = load_subscribed_users()

    # Check if user already exists
    for user in users:
        if user['user_id'] == user_id:
            # Update existing user
            user.update({
                'dob': dob,
                'tob': tob,
                'place': place,
                'language': language,
                'preferred_time': preferred_time,
                'channel': channel,
                'subscribed': True,
                'updated_at': datetime.now().isoformat()
            })
            save_subscribed_users(users)
            return {
                "status": "updated",
                "message": f"User {user_id} subscription updated successfully",
                "user_id": user_id
            }

    # Add new user
    new_user = {
        'user_id': user_id,
        'dob': dob,
        'tob': tob,
        'place': place,
        'language': language,
        'preferred_time': preferred_time,
        'channel': channel,
        'subscribed': True,
        'created_at': datetime.now().isoformat()
    }

    users.append(new_user)
    save_subscribed_users(users)

    return {
        "status": "subscribed",
        "message": f"User {user_id} subscribed successfully",
        "user_id": user_id
    }


def unsubscribe_user(user_id: str) -> Dict:
    """Unsubscribe a user from daily horoscope service."""
    users = load_subscribed_users()

    for user in users:
        if user['user_id'] == user_id:
            user['subscribed'] = False
            user['unsubscribed_at'] = datetime.now().isoformat()
            save_subscribed_users(users)
            return {
                "status": "unsubscribed",
                "message": f"User {user_id} unsubscribed successfully",
                "user_id": user_id
            }

    return {
        "status": "not_found",
        "message": f"User {user_id} not found in subscription list"
    }


def send_whatsapp_message(phone_number: str, message: str):
    """
    Send message via WhatsApp Business API.
    TODO: Integrate with your WhatsApp API
    """
    # Placeholder for your WhatsApp integration
    print(f"[WhatsApp] To: {phone_number}")
    print(f"[WhatsApp] Message: {message[:100]}...")
    # Add your WhatsApp API call here
    # Example:
    # import requests
    # whatsapp_url = os.getenv("WHATSAPP_API_URL")
    # response = requests.post(whatsapp_url, json={
    #     "to": phone_number,
    #     "message": message
    # })


def format_horoscope_message(horoscope_data: Dict, user_name: str = None) -> str:
    """Format horoscope data into a readable message."""
    greeting = f"Namaste {user_name}! 🙏" if user_name else "Namaste! 🙏"

    sign = horoscope_data.get('birth_moon_sign', '')
    hindi_sign = horoscope_data.get('birth_moon_sign_hindi', '')
    date = horoscope_data.get('date', datetime.now().strftime("%Y-%m-%d"))

    message = f"""{greeting}

📅 *Your Daily Horoscope - {date}*

🌙 *Moon Sign:* {sign} ({hindi_sign})
🌟 *Nakshatra:* {horoscope_data.get('birth_nakshatra', '')}
🔮 *Today\'s Moon Transit:* House {horoscope_data.get('transit_moon_house', '')}

✨ *Prediction:*
{horoscope_data.get('prediction', '')}

🎨 *Lucky Color:* {horoscope_data.get('lucky_color', '')}
🔢 *Lucky Numbers:* {', '.join(map(str, horoscope_data.get('lucky_numbers', [])))}
📆 *Lucky Day:* {horoscope_data.get('lucky_day', '')}

---
🔥 *100% Accurate* - Calculated using Swiss Ephemeris
"""

    return message


def send_daily_horoscopes(dry_run: bool = False):
    """
    Send daily horoscopes to all subscribed users.
    This function should be called by cron job daily.
    """
    users = load_subscribed_users()
    subscribed_users = [u for u in users if u.get('subscribed', False)]

    if not subscribed_users:
        print("No subscribed users found.", file=sys.stderr)
        return

    print(f"Sending horoscopes to {len(subscribed_users)} users...", file=sys.stderr)

    success_count = 0
    failed_count = 0

    for user in subscribed_users:
        try:
            # Generate horoscope
            horoscope = generate_daily_horoscope(
                dob=user['dob'],
                tob=user['tob'],
                place=user['place'],
                language=user.get('language', 'auto')
            )

            if 'error' in horoscope:
                print(f"Error generating horoscope for {user['user_id']}: {horoscope['error']}", file=sys.stderr)
                failed_count += 1
                continue

            # Format message
            message = format_horoscope_message(
                horoscope,
                user_name=user.get('name')
            )

            # Send message (skip if dry run)
            if not dry_run:
                send_whatsapp_message(user['user_id'], message)

            print(f"✓ Sent to {user['user_id']}", file=sys.stderr)
            success_count += 1

        except Exception as e:
            print(f"✗ Failed for {user['user_id']}: {e}", file=sys.stderr)
            failed_count += 1

    print(f"\nSummary: {success_count} sent, {failed_count} failed", file=sys.stderr)


def list_subscribers():
    """List all subscribed users."""
    users = load_subscribed_users()
    subscribed_users = [u for u in users if u.get('subscribed', False)]

    if not subscribed_users:
        print("No subscribed users.")
        return

    print(f"\n=== Total Subscribers: {len(subscribed_users)} ===\n")
    for user in subscribed_users:
        print(f"User ID: {user['user_id']}")
        print(f"  Language: {user.get('language', 'auto')}")
        print(f"  Time: {user.get('preferred_time', '08:00')}")
        print(f"  Channel: {user.get('channel', 'whatsapp')}")
        print(f"  Subscribed: {user.get('created_at', 'N/A')}")
        print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Daily Horoscope Scheduler')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Subscribe command
    subscribe_parser = subparsers.add_parser('subscribe', help='Subscribe a user')
    subscribe_parser.add_argument('--user-id', required=True, help='User ID (phone number)')
    subscribe_parser.add_argument('--dob', required=True, help='Date of Birth')
    subscribe_parser.add_argument('--tob', required=True, help='Time of Birth')
    subscribe_parser.add_argument('--place', required=True, help='Place of Birth')
    subscribe_parser.add_argument('--language', default='auto', choices=['english', 'hinglish', 'auto'])
    subscribe_parser.add_argument('--time', default='08:00', help='Preferred time (HH:MM)')
    subscribe_parser.add_argument('--name', help='User name (optional)')

    # Unsubscribe command
    unsubscribe_parser = subparsers.add_parser('unsubscribe', help='Unsubscribe a user')
    unsubscribe_parser.add_argument('--user-id', required=True, help='User ID to unsubscribe')

    # Send command
    send_parser = subparsers.add_parser('send', help='Send daily horoscopes')
    send_parser.add_argument('--dry-run', action='store_true', help='Preview without sending')

    # List command
    subparsers.add_parser('list', help='List all subscribers')

    # Test command
    test_parser = subparsers.add_parser('test', help='Test horoscope generation')
    test_parser.add_argument('--dob', required=True, help='Date of Birth')
    test_parser.add_argument('--tob', required=True, help='Time of Birth')
    test_parser.add_argument('--place', required=True, help='Place of Birth')
    test_parser.add_argument('--language', default='english', choices=['english', 'hinglish'])

    args = parser.parse_args()

    if args.command == 'subscribe':
        result = subscribe_user(
            user_id=args.user_id,
            dob=args.dob,
            tob=args.tob,
            place=args.place,
            language=args.language,
            preferred_time=args.time
        )
        print(json.dumps(result, indent=2))

    elif args.command == 'unsubscribe':
        result = unsubscribe_user(args.user_id)
        print(json.dumps(result, indent=2))

    elif args.command == 'send':
        send_daily_horoscopes(dry_run=args.dry_run)

    elif args.command == 'list':
        list_subscribers()

    elif args.command == 'test':
        horoscope = generate_daily_horoscope(
            dob=args.dob,
            tob=args.tob,
            place=args.place,
            language=args.language
        )
        print(json.dumps(horoscope, indent=2, ensure_ascii=False))

    else:
        parser.print_help()
