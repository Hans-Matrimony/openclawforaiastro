# Audio Analyzer Skill

Advanced audio analysis for emotion detection, astrological question extraction, and language detection.

## Commands

### Analyze Audio
Analyzes transcribed audio text for emotional tone and astrology-related content.

```bash
python3 ~/.openclaw/skills/audio_analyzer/audio_client.py analyze "<transcribed_text>"
```

### Get Remedy
Get audio remedy (mantra/prayer) for specific category.

```bash
python3 ~/.openclaw/skills/audio_analyzer/audio_client.py remedy "<category>"
```

Remedy categories:
- `stress_relief`: Peace mantra for stress relief
- `marriage_delay`: Vishnu mantra for removing marriage obstacles
- `career_issues`: Durga mantra for career success

## Output Format

**Analysis output (JSON):**
- **transcript**: Original transcribed text
- **emotion**: Detected emotional state (stressed, sad, angry, happy, neutral)
- **is_astrology_question**: Boolean indicating if text contains astrology question
- **language**: Detected language (english or hinglish)

**Remedy output (JSON):**
- **mantra**: The mantra text
- **description**: Explanation of the remedy
- **duration_seconds**: Suggested duration for chanting

## Use Cases

- User sends stressed audio → Agent detects emotion and provides comforting response
- User asks astrology question in audio → Agent extracts question and provides guidance
- User sounds anxious → Agent suggests appropriate mantra/remedy
- User sends casual audio → Agent responds as a friend

## Features

1. **Emotion Detection**: Identifies emotional state from transcribed text
2. **Question Extraction**: Detects astrology-related questions
3. **Language Detection**: Automatically detects English vs Hinglish
4. **Remedy Suggestions**: Provides appropriate mantras based on context
