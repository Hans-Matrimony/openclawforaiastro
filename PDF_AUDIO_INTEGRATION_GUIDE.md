# PDF and Audio Analysis - Integration Guide

## 🎯 Overview

This guide explains how to integrate and use the new PDF and audio analysis features in your WhatsApp astrologer agent.

**IMPORTANT:** These features are **disabled by default** and will NOT affect existing functionality until explicitly enabled.

---

## ✅ What's Been Implemented

### 1. PDF Analyzer Skill
- **Location:** `d:\HansMatrimonyOrg\openclawforaiastro\skills\pdf_analyzer\`
- **Features:**
  - Extract text from PDFs
  - OCR on images within PDFs
  - PDF metadata extraction
  - Full analysis command

### 2. Audio Analyzer Skill
- **Location:** `d:\HansMatrimonyOrg\openclawforaiastro\skills\audio_analyzer\`
- **Features:**
  - Emotion detection (stressed, sad, angry, happy, neutral)
  - Astrology question extraction
  - Language detection (English vs Hinglish)
  - Remedy suggestions (mantras, prayers)

### 3. Feature Flags (SAFE ROLLBACK)
- **Location:** `d:\HansMatrimonyOrg\hans-ai-whatsapp\app\config\settings.py`
- **Flags:**
  - `enable_pdf_analysis: bool = False` (OFF by default)
  - `enable_audio_emotion_detection: bool = False` (OFF by default)

### 4. Isolated Code Module
- **Location:** `d:\HansMatrimonyOrg\hans-ai-whatsapp\app\services\tasks_pdf_audio.py`
- **Contains:** `PDFAnalyzer` and `AudioAnalyzer` classes
- **Safety:** Completely isolated from existing functionality

### 5. Webhook Enhancement
- **Location:** `d:\HansMatrimonyOrg\hans-ai-whatsapp\whatsapp_webhook.py`
- **Change:** PDF detection only (non-breaking addition)
- **Impact:** ZERO - just adds metadata marker

---

## 🔒 Safety Guarantees

### ZERO Impact on Existing Functionality

1. **Feature Flags OFF by Default**
   - New code only runs when flags are explicitly enabled
   - Default behavior is completely unchanged

2. **Separate Code Module**
   - New functions in `tasks_pdf_audio.py` (separate file)
   - No modifications to existing `tasks.py` functions
   - Can be deleted without affecting anything

3. **Non-Breaking Webhook Changes**
   - Only adds PDF detection metadata
   - Doesn't change existing message handling
   - All existing media types work exactly as before

4. **Easy Rollback**
   - Set feature flags to False to disable
   - Delete `tasks_pdf_audio.py` to remove completely
   - System reverts to original behavior instantly

---

## 🚀 How to Enable (When Ready)

### Step 1: Install Dependencies

```bash
# Install PDF processing libraries
pip install pdfplumber==0.10.3 PyPDF2==3.0.1 pdf2image==1.16.3 pytesseract==0.3.10

# Install system dependencies for OCR
apt-get update
apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin poppler-utils
```

### Step 2: Enable Feature Flags

**Option A: Enable via Environment Variables**
```bash
# Enable PDF analysis
export ENABLE_PDF_ANALYSIS=true

# Enable audio emotion detection
export ENABLE_AUDIO_EMOTION_DETECTION=true

# Restart services
```

**Option B: Enable via .env File**
```bash
# Add to your .env file
ENABLE_PDF_ANALYSIS=true
ENABLE_AUDIO_EMOTION_DETECTION=true
```

### Step 3: Test the Features

**Test PDF Upload:**
1. Send a PDF via WhatsApp to your test number
2. Check logs for `[PDF Analysis]` prefix
3. Verify agent acknowledges PDF upload
4. Ask: "What does this PDF say?"

**Test Audio Emotion:**
1. Send audio: "I'm very stressed about my marriage"
2. Check logs for `[Audio Analysis]` prefix
3. Verify agent detects "stressed" emotion
4. Verify agent provides comforting response

---

## 📊 How It Works

### PDF Analysis Flow (When Enabled)

```
User uploads PDF → WhatsApp Webhook → Celery Task → tasks_pdf_audio.py
                                                             ↓
                                              Check feature flag (False = skip)
                                                             ↓
                                              PDFAnalyzer.process_pdf_document()
                                                             ↓
                                              Download PDF from WhatsApp
                                                             ↓
                                              Save to temporary file
                                                             ↓
                                              Call pdf_analyzer skill
                                                             ↓
                                              Store analysis in mem0
                                                             ↓
                                              Send summary to user
```

### Audio Analysis Flow (When Enabled)

```
User sends audio → WhatsApp Webhook → Existing transcription
                                                  ↓
                                          Check feature flag (False = skip)
                                                  ↓
                                          AudioAnalyzer.analyze_audio_advanced()
                                                  ↓
                                          Analyze transcript for emotion
                                                  ↓
                                          Detect astrology questions
                                                  ↓
                                          Store analysis in mem0
                                                  ↓
                                          Suggest remedy if needed
```

---

## 🧪 Testing Checklist

### Before Enabling Features
- [ ] Verify normal WhatsApp messages work
- [ ] Verify Kundli generation works
- [ ] Verify audio transcription works (existing)
- [ ] Verify image upload works
- [ ] Verify English mode works
- [ ] Verify Hinglish mode works

### After Enabling PDF Analysis
- [ ] PDF upload acknowledged by agent
- [ ] PDF text extraction works
- [ ] PDF metadata extraction works
- [ ] Agent can answer questions about PDF content
- [ ] PDF analysis stored in mem0
- [ ] Existing functionality still works

### After Enabling Audio Analysis
- [ ] Audio transcription still works
- [ ] Emotion detection works
- [ ] Astrology question extraction works
- [ ] Language detection works
- [ ] Remedy suggestions work
- [ ] Existing functionality still works

---

## 🔄 Rollback Procedure

If ANY issues occur:

### Quick Disable (Keeps Code)
```bash
# Set feature flags to false
export ENABLE_PDF_ANALYSIS=false
export ENABLE_AUDIO_EMOTION_DETECTION=false

# Restart services
# System reverts to original behavior
```

### Complete Removal (Deletes Code)
```bash
# Delete the new code module
rm d:/HansMatrimonyOrg/hans-ai-whatsapp/app/services/tasks_pdf_audio.py

# Revert webhook changes
cp d:/HansMatrimonyOrg/hans-ai-whatsapp/whatsapp_webhook.py.backup_pdf_audio_* \
   d:/HansMatrimonyOrg/hans-ai-whatsapp/whatsapp_webhook.py

# Remove feature flags from settings.py
# Restart services
```

---

## 📝 Usage Examples

### PDF Analysis

**User Action:** Uploads astrological chart PDF

**Agent Response (Hinglish):**
```
Arre, maine aapka PDF dekh liya. Yeh document Kundli chart hai.

Isme kuch important cheezein hain:
- Aapki Rashi Kark (Cancer) hai
- Lagna Tula (Libra) ban raha hai
- Abhi Mahadasha chal raha hai

Koi specific question hai is chart ke baarein?
```

**Agent Response (English):**
```
I've reviewed your PDF document. This appears to be a birth chart.

Here are the key points:
- Your Moon sign is Cancer
- Your ascendant is Libra
- Current Mahadasha is active

Any specific questions about this chart?
```

### Audio Analysis

**User Action:** Sends audio "I'm stressed about my marriage"

**Agent Response (Hinglish):**
```
Arre, tension mat lo. Main hoon na tumhare saath.

Main sun raha hoon ki tum marriage le kar stress ho. Don't worry, tumhara chart dekhunga aur sab theek hoga.

Kuch specific problem hai? Batao.
```

**Agent Response (English):**
```
I can hear you're stressed about your marriage. Don't worry, I'm here for you.

I understand this is a difficult time. Let me check your chart and we'll work through this together.

What's concerning you the most?
```

---

## 🔍 Monitoring and Logs

### PDF Analysis Logs
```
[PDF Analysis] Processing PDF for user +919876543210, media_id: media_123
[PDF Analysis] Step 1: Downloading PDF from WhatsApp
[PDF Analysis] Step 2: Saving PDF to temporary file
[PDF Analysis] Step 3: Analyzing PDF at /tmp/file.pdf
[PDF Analysis] Analysis complete: 5 pages
[PDF Analysis] Step 4: Storing analysis in mem0
[PDF Analysis] PDF processing completed successfully
```

### Audio Analysis Logs
```
[Audio Analysis] Performing advanced analysis for user +919876543210
[Audio Analysis] Analysis complete - Emotion: stressed, Astro Question: true, Language: hinglish
[Audio Analysis] Storing audio analysis in mem0
[Audio Analysis] Suggested remedy: stress_relief
```

---

## 💡 Best Practices

1. **Test First**: Always test with feature flags enabled on a test number first
2. **Monitor Logs**: Watch for `[PDF Analysis]` and `[Audio Analysis]` log prefixes
3. **Check mem0**: Verify that analyses are being stored correctly
4. **User Feedback**: Collect feedback from users on new features
5. **Performance**: Monitor response times for PDF/audio processing
6. **Rollback Ready**: Keep backup files handy for quick rollback if needed

---

## 📞 Support

If you encounter any issues:

1. **Check Logs**: Look for error messages with `[PDF Analysis]` or `[Audio Analysis]` prefix
2. **Verify Flags**: Ensure feature flags are set correctly
3. **Test Dependencies**: Verify all Python libraries are installed
4. **Check System Dependencies**: Ensure tesseract-ocr and poppler-utils are installed
5. **Rollback**: Use rollback procedure if issues persist

---

## ✅ Summary

- **NEW FEATURES:** PDF analysis, audio emotion detection
- **SAFETY:** Disabled by default, zero impact on existing functionality
- **ISOLATION:** Separate code module, easy to remove
- **ROLLBACK:** Instant disable via feature flags
- **TESTING:** Comprehensive test checklist provided

**Your existing WhatsApp astrologer agent continues to work exactly as before until you explicitly enable these new features!**
