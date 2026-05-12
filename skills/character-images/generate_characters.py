#!/usr/bin/env python3
"""
Generate character portraits for Meera and Aarav astrologers.
Uses OpenAI DALL-E 3 to create consistent character images.
"""

import os
import sys
import base64
import httpx
from pathlib import Path


# Character prompts based on SOUL.md profiles
MEERA_PROMPT = """A warm, friendly Indian woman named Meera, age 28, from Varanasi. She has a gentle, caring smile and kind eyes that convey wisdom and compassion. She wears a simple, elegant yellow cotton saree with a traditional border. She sits near the Ganga river ghats in the soft morning light, holding a small brass oil lamp. She has a small bindi and minimal jewelry - just small earrings and a simple pendant. Her hair is tied in a traditional bun. The background shows the ancient temples of Kashi Vishwanath in soft focus. Warm golden hour lighting. Photorealistic portrait, natural beauty, authentic Indian astrologer aesthetic."""

AARAV_PROMPT = """A gentle, caring Indian man named Aarav, age 30, from Varanasi. He has a calm, reassuring demeanor with kind eyes that convey wisdom and protection. He wears a simple, clean cream-colored kurta and traditional Indian attire. He sits on the steps of the Ganga river ghats during the peaceful morning hours, holding ancient palm leaf manuscripts. He has a well-groomed beard and a serene presence. The background shows the ancient temples of Kashi in soft, misty morning light. Warm natural lighting. Photorealistic portrait, authentic Indian astrologer aesthetic."""


async def generate_image(prompt: str, api_key: str) -> str:
    """Generate image using DALL-E 3 and return base64 data"""
    url = "https://api.openai.com/v1/images/generations"

    payload = {
        "model": "dall-e-3",
        "prompt": prompt,
        "size": "1024x1792",  # Portrait orientation
        "quality": "standard",
        "style": "natural",
        "n": 1
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        # Get the image URL
        image_url = data["data"][0]["url"]

        # Download the image
        image_response = await client.get(image_url)
        image_response.raise_for_status()

        # Convert to base64
        image_base64 = base64.b64encode(image_response.content).decode()
        return image_base64


async def upload_to_storage(image_base64: str, filename: str, storage_url: str) -> str:
    """Upload image to your storage server and return public URL"""
    # This uploads to your MongoDB logger storage (same as Kundli images)
    # DEV: https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com
    # PROD: https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com
    url = f"{storage_url}/kundli-image"

    # Match the Kundli upload format
    payload = {
        "userId": "system",
        "sessionId": "character-images",
        "birthDetails": {},
        "kundliData": {"character": filename.replace(".png", ""), "type": "character_portrait"},
        "imageBase64": f"data:image/png;base64,{image_base64}",
        "chartType": "character_portrait",
        "format": "png"
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            file_id = data.get("fileId")
            return f"{storage_url}/kundli-image/{file_id}"
        else:
            raise Exception(f"Upload failed: {data}")


async def main():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable not set", file=sys.stderr)
        return 1

    storage_url = os.environ.get("MONGO_LOGGER_URL", "https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com")

    print("🎨 Generating character portraits for Meera and Aarav...")
    print()

    # Generate Meera
    print("📸 Generating Meera's portrait...")
    try:
        meera_b64 = await generate_image(MEERA_PROMPT, api_key)
        meera_url = await upload_to_storage(meera_b64, "meera.png", storage_url)
        print(f"✅ Meera's portrait: {meera_url}")
    except Exception as e:
        print(f"❌ Failed to generate Meera: {e}", file=sys.stderr)
        meera_url = None

    print()

    # Generate Aarav
    print("📸 Generating Aarav's portrait...")
    try:
        aarav_b64 = await generate_image(AARAV_PROMPT, api_key)
        aarav_url = await upload_to_storage(aarav_b64, "aarav.png", storage_url)
        print(f"✅ Aarav's portrait: {aarav_url}")
    except Exception as e:
        print(f"❌ Failed to generate Aarav: {e}", file=sys.stderr)
        aarav_url = None

    print()
    print("=" * 60)
    print("CHARACTER IMAGES READY!")
    print("=" * 60)
    print()
    print("Update these URLs in astrologer.md:")
    print(f"  Meera: {meera_url or 'PENDING'}")
    print(f"  Aarav: {aarav_url or 'PENDING'}")
    print()

    return 0 if meera_url and aarav_url else 1


if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))
