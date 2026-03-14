---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image (Nano Banana Pro).
homepage: https://ai.google.dev/
metadata:
  {
    "openclaw":
      {
        "emoji": "🍌",
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"] },
        "primaryEnv": "GEMINI_API_KEY",
        "install":
          [
            {
              "id": "uv-brew",
              "kind": "brew",
              "formula": "uv",
              "bins": ["uv"],
              "label": "Install uv (brew)",
            },
          ],
      },
  }
---

# Nano Banana Pro (Gemini 3 Pro Image)

**RESTRICTED USE: Astrology-related images ONLY**

This skill is configured to generate **ONLY astrology-related images** for the astrologer agent. This includes:

## CRITICAL: ALWAYS Check Mem0 First

For EVERY image generation request:
1. **FIRST** search mem0 for user's birth details and preferences:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py search "birth details kundli preferences" --user-id "<USER_ID>"
   ```
2. Use birth details from mem0 (Lagna, Moon Sign, Nakshatra) for chart generation
3. Only ask for details if NOT found in mem0
4. After generating image, store reference in mem0:
   ```bash
   python3 ~/.openclaw/skills/mem0/mem0_client.py add "Kundli chart generated: <FILENAME> for <LAGNA> lagna" --user-id "<USER_ID>"
   ```
- Kundli charts, birth charts, horoscope diagrams
- Zodiac sign illustrations
- Planetary position diagrams
- Vedic astrology visual representations
- Nakshatra symbol images

**Do NOT use this skill for any other image generation purposes.**

Use the bundled script to generate or edit images.

Generate

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "your image description" --filename "output.png" --resolution 1K
```

Edit (single image)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "edit instructions" --filename "output.png" -i "/path/in.png" --resolution 2K
```

Multi-image composition (up to 14 images)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "combine these into one scene" --filename "output.png" -i img1.png -i img2.png -i img3.png
```

API key

- `GEMINI_API_KEY` env var
- Or set `skills."nano-banana-pro".apiKey` / `skills."nano-banana-pro".env.GEMINI_API_KEY` in `~/.openclaw/openclaw.json`

Notes

- Resolutions: `1K` (default), `2K`, `4K`.
- Use timestamps in filenames: `yyyy-mm-dd-hh-mm-ss-name.png`.
- The script prints a `MEDIA:` line for OpenClaw to auto-attach on supported chat providers.
- Do not read the image back; report the saved path only.
