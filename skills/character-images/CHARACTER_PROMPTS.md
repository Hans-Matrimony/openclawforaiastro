# Character Image Prompts for Meera and Aarav

## MEERA (Female Astrologer - for Male Users)

**DALL-E Prompt:**
```
A warm, friendly Indian woman named Meera, age 28, from Varanasi. She has a gentle, caring smile and kind eyes that convey wisdom and compassion. She wears a simple, elegant yellow cotton saree with a traditional border. She sits near the Ganga river ghats in the soft morning light, holding a small brass oil lamp. She has a small bindi and minimal jewelry - just small earrings and a simple pendant. Her hair is tied in a traditional bun. The background shows the ancient temples of Kashi Vishwanath in soft focus. Warm golden hour lighting. Photorealistic portrait, natural beauty, authentic Indian astrologer aesthetic. --style natural
```

**Alternative Expressions:**
- Thinking/Consulting charts: "Meera looking thoughtfully at an ancient Kundli chart, soft expression of concentration"
- Listening with empathy: "Meera with a warm, empathetic expression, as if listening deeply to someone's concerns"

## AARAV (Male Astrologer - for Female Users)

**DALL-E Prompt:**
```
A gentle, caring Indian man named Aarav, age 30, from Varanasi. He has a calm, reassuring demeanor with kind eyes that convey wisdom and protection. He wears a simple, clean cream-colored kurta and traditional Indian attire. He sits on the steps of the Ganga river ghats during the peaceful morning hours, holding ancient palm leaf manuscripts. He has a well-groomed beard and a serene presence. The background shows the ancient temples of Kashi in soft, misty morning light. Warm natural lighting. Photorealistic portrait, authentic Indian astrologer aesthetic. --style natural
```

**Alternative Expressions:**
- Consulting charts: "Aarav thoughtfully examining an ancient astrological chart, expression of focused wisdom"
- Reassuring presence: "Aarav with a warm, protective smile, conveying confidence and support"

## GENERATION COMMANDS

```bash
# Generate Meera's portrait
python3 ~/.openclaw/skills/openai-image-gen/scripts/gen.py \
  --model dall-e-3 \
  --style natural \
  --size 1024x1792 \
  --prompt "A warm, friendly Indian woman named Meera, age 28, from Varanasi. She has a gentle, caring smile and kind eyes that convey wisdom and compassion. She wears a simple, elegant yellow cotton saree with a traditional border. Soft natural lighting. Photorealistic portrait, natural beauty, authentic Indian astrologer aesthetic." \
  --count 1

# Generate Aarav's portrait
python3 ~/.openclaw/skills/openai-image-gen/scripts/gen.py \
  --model dall-e-3 \
  --style natural \
  --size 1024x1792 \
  --prompt "A gentle, caring Indian man named Aarav, age 30, from Varanasi. He has a calm, reassuring demeanor with kind eyes that convey wisdom and protection. He wears a simple, clean cream-colored kurta. Soft natural lighting. Photorealistic portrait, authentic Indian astrologer aesthetic." \
  --count 1
```

## STORAGE LOCATION

After generation, store images at:
- Meera: `/public/characters/meera-portrait.png`
- Aarav: `/public/characters/aarav-portrait.png`

Public URLs (DEV environment):
- `https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com/kundli-image/<meera_file_id>`
- `https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com/kundli-image/<aarav_file_id>`

Public URLs (PROD environment):
- `https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/kundli-image/<meera_file_id>`
- `https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com/kundli-image/<aarav_file_id>`
