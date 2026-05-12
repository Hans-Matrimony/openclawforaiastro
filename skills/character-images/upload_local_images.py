#!/usr/bin/env python3
"""
Upload local Meera and Aarav character images to the server.
Usage: python3 upload_local_images.py /path/to/meera.jpg /path/to/aarav.jpg
"""

import os
import sys
import base64
import httpx
from pathlib import Path


# Use dev URL for dev branch, prod URL for production
MONGO_LOGGER_URL = os.environ.get(
    "MONGO_LOGGER_URL",
    "https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com"  # DEV environment
)
UPLOAD_ENDPOINT = f"{MONGO_LOGGER_URL}/kundli-image"


def image_to_base64(image_path: str) -> str:
    """Convert image file to base64 string"""
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    return base64.b64encode(image_bytes).decode()


async def upload_character_image(image_path: str, character_name: str) -> str:
    """Upload image to server and return public URL"""
    print(f"[INFO] Uploading {character_name}...")

    # Convert to base64
    b64_data = image_to_base64(image_path)
    image_format = Path(image_path).suffix[1:]  # jpg, png, etc.

    # Prepare payload (matching Kundli upload format)
    payload = {
        "userId": "system",  # System upload, not user-specific
        "sessionId": "character-images",
        "birthDetails": {},
        "kundliData": {
            "character": character_name,
            "type": "character_portrait"
        },
        "imageBase64": f"data:image/{image_format};base64,{b64_data}",
        "chartType": "character_portrait",
        "format": image_format
    }

    # Upload to server
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(UPLOAD_ENDPOINT, json=payload)
        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            file_id = data.get("fileId")
            public_url = f"{MONGO_LOGGER_URL}/kundli-image/{file_id}"
            return public_url
        else:
            raise Exception(f"Upload failed: {data}")


async def main():
    if len(sys.argv) < 3:
        print("Usage: python3 upload_local_images.py <meera_image_path> <aarav_image_path>")
        print()
        print("Example:")
        print("  python3 upload_local_images.py meera.jpg aarav.jpg")
        print("  python3 upload_local_images.py C:/images/meera.png C:/images/aarav.png")
        return 1

    meera_path = sys.argv[1]
    aarav_path = sys.argv[2]

    # Check files exist
    if not Path(meera_path).exists():
        print(f"[ERROR] Meera image not found: {meera_path}")
        return 1
    if not Path(aarav_path).exists():
        print(f"[ERROR] Aarav image not found: {aarav_path}")
        return 1

    print("=" * 60)
    print("CHARACTER IMAGE UPLOAD")
    print("=" * 60)
    print()

    # Upload Meera
    try:
        meera_url = await upload_character_image(meera_path, "meera")
        print(f"[SUCCESS] Meera uploaded: {meera_url}")
    except Exception as e:
        print(f"[ERROR] Meera upload failed: {e}")
        meera_url = None

    print()

    # Upload Aarav
    try:
        aarav_url = await upload_character_image(aarav_path, "aarav")
        print(f"[SUCCESS] Aarav uploaded: {aarav_url}")
    except Exception as e:
        print(f"[ERROR] Aarav upload failed: {e}")
        aarav_url = None

    print()
    print("=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print()

    if meera_url:
        print(f"Meera URL: {meera_url}")
    if aarav_url:
        print(f"Aarav URL: {aarav_url}")

    print()
    print("Update astrologer.md with these URLs:")
    print(f"  IMAGE_URL: {meera_url or '<MEERA_URL>'}")
    print(f"  IMAGE_URL: {aarav_url or '<AARAV_URL>'}")

    return 0 if meera_url and aarav_url else 1


if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))
