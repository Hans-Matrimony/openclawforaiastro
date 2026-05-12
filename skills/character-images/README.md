# Character Images Feature

## Overview

This feature allows the astrologer AI (Meera/Aarav) to share character portraits when users ask for photos.

## How It Works

1. **User asks for photo**: "aapki photo dikhao" / "show me your picture"
2. **AI detects gender**: MongoDB → Mem0 fallback
3. **AI responds with appropriate image**:
   - Male users → Meera's photo
   - Female users → Aarav's photo
   - Unknown gender → Meera's photo (default)

## File Structure

```
skills/character-images/
├── README.md                  # This file
├── CHARACTER_PROMPTS.md       # DALL-E prompts for generating images
├── UPLOADED_IMAGES.md         # File IDs for uploaded images
├── upload_local_images.py     # Script to upload local images to MongoDB
└── generate_characters.py     # Script to generate images via DALL-E
```

## Environment-Specific URLs

| Environment | MongoLogger URL | Meera File ID | Aarav File ID |
|-------------|-----------------|---------------|---------------|
| **DEV** | `https://aogwww0kwcggosc0ssgko4gc.api.hansastro.com` | `6a02af255961da2c2926457f` | `6a02af2a5961da2c292645a2` |
| **PROD** | `https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com` | TBD | TBD |

## Usage in astrologer.md

The astrologer prompt has been updated with the CHARACTER PHOTO REQUESTS section that tells the AI how to respond to photo requests.

## Edge Cases Handled

1. **Gender not found**: Defaults to Meera's photo
2. **Image URL not accessible**: AI still sends text response
3. **Upload failure**: Script continues and reports errors
4. **Partial upload**: Script reports success for uploaded images only

## Deploying to Production

When deploying to production:

1. Update `MONGO_LOGGER_URL` environment variable or edit the default in scripts
2. Upload images to production MongoLogger:
   ```bash
   export MONGO_LOGGER_URL="https://tkgsogkk4cg4wkgok0cw4gk8.api.hansastro.com"
   python3 skills/character-images/upload_local_images.py meera.png aarav.png
   ```
3. Update `.pi/prompts/astrologer.md` with production file IDs
4. Test on production

## Testing

To test the feature:

1. Send a WhatsApp message to the dev number
2. Ask: "aapki photo dikhao" or "show me your picture"
3. Verify:
   - Correct gender-based image is sent
   - Text response is warm and friendly
   - Follow-up question is natural

## Troubleshooting

**Image not sending:**
- Check IMAGE_URL format in response
- Verify MongoLogger URL is correct
- Check image is accessible via curl

**Wrong image sent:**
- Verify gender detection is working
- Check MongoDB/Mem0 for user's gender

**Upload fails:**
- Check image file exists
- Verify MongoLogger service is running
- Check network connectivity
