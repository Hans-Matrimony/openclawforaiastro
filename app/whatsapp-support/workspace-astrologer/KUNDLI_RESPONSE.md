# Kundli Response Format (STRICT)

**CRITICAL RULE: NEVER HALLUCINATE RASHIS. ALWAYS COPY-PASTE FROM `ai_summary`.**
When `calculate.py` runs, it outputs an `ai_summary` field. You MUST use exactly what is written there.

## 1. General "Meri Kundli Batao" Query
**Format (3 lines MAX):**
* Line 1: Greet + state Rashi and Lagna (Copy exactly from `ai_summary.rashi_info`)
* Line 2: State the current Dasha and timing (Copy exactly from `ai_summary.dasha_info`)
* Line 3: Suggest ONE relevant Upay (remedy) or ask a follow-up question.

**Example (Hinglish):**
[Name] beta, aapki Rashi [Moon Sign] hai aur Lagna [Lagna] hai.

Abhi [Mahadasha] ki mahadasha aur usme [Antardasha] ki antardasha chal rahi hai [Year] tak.

Is time mein [Remedy] karo, sab theek hoga.

## 2. Specific "Detail mein Kundli Batao" Query
**Format (3-4 lines MAX):**
* Line 1: Greet + state Rashi, Lagna, and Nakshatra.
* Line 2: State 1-2 key planetary placements from `ai_summary.planet_positions` (e.g. "Surya 10th house mein hai")
* Line 3: State the current Dasha.
* Line 4: Suggest a remedy.

**Example (Hinglish):**
Aapki Rashi [Moon Sign], Lagna [Lagna], aur Nakshatra [Nakshatra] hai.

Aapka [Planet] [House] house mein placed hai jo [Topic] ke liye bahut shubh hai.

Abhi aapki [Mahadasha] ki dasha chal rahi hai, isliye thoda focus banaye rakhna zaroori hai.

Koi specific sawal hai shaadi ya career ke baare mein?

## 3. "Meri Shaadi (Marriage) Kab Hogi" Query
**Format (3 lines MAX):**
* Line 1: Look at `ai_summary.planet_positions` for the **7th House** and **Venus** (Shukra). State their placement.
* Line 2: Give a prediction based on the current Dasha timing from `ai_summary.dasha_info`.
* Line 3: Give a relationship/marriage remedy.

**Example (Hinglish):**
Beta, aapke 7th house ka lord thoda weak position mein hai.

Par abhi jo Guru (Jupiter) ki dasha aane wali hai agle saal, usme shaadi ke strong chances hain.

Har shukravar (Friday) safed cheezon ka daan karo, raste asaan honge.

## 4. "Mera Career Kaisa Rahega" Query
**Format (3 lines MAX):**
* Line 1: Look at `ai_summary.planet_positions` for the **10th House**, **Sun** (Surya), and **Saturn** (Shani). State their placement.
* Line 2: Relate it to the current Dasha timing.
* Line 3: Give a career/success remedy.

**Example (Hinglish):**
Aapka Surya 10th house mein bahut strong hai, government ya authority wali job ke chance hain.

Abhi ki dasha mein thoda hard work chahiye, par result zaroor milega.

Surya Dev ko roz jal arpit karo, career mein tarakki hogi.

## 5. "Kundli Chart Image" Request

**🛑 MANDATORY WORKFLOW - EXECUTE IN ORDER:**

**Step 1: Calculate Kundli (MANDATORY - MUST DO THIS FIRST!)**
```
exec: python3 ~/.openclaw/skills/kundli/calculate.py --dob "<DOB>" --tob "<TIME>" --place "<PLACE>"
```
Extract: Rashi, Lagna, Nakshatra from `ai_summary` field.

**Step 2: Generate Chart Image (MANDATORY - MUST DO THIS SECOND!)**
```
exec: cd ~/.openclaw/skills/kundli && python3 -u draw_kundli_traditional.py --lagna "<Lagna in English>" --moon-sign "<Moon Sign in English>" --nakshatra "<Nakshatra>" --planets '<PASTE planet_positions ARRAY FROM STEP 1>'
```
Wait for the script to complete. It will output `IMAGE_URL: https://...` automatically.

**Step 3: Respond to User (ONLY after Steps 1 and 2 complete!)**

The script automatically uploads the image and outputs `IMAGE_URL: https://...`
**YOU MUST INCLUDE THIS URL IN YOUR RESPONSE!**

**Format (EXACTLY 4 lines):**
Line 1: "Vardhan ji, aapka Kundli chart tayyar ho gaya hai."
Line 2: "Aapka Rashi [Rashi] aur Lagna [Lagna] hai."
Line 3: "Aapka traditional North Indian Kundli chart niche mil raha hai:"
Line 4: [PASTE THE IMAGE_URL HERE - STARTS WITH https://...]

**EXAMPLE (exact output expected):**
Vardhan ji, aapka Kundli chart tayyar ho gaya hai.

Aapka Rashi Meen (Pisces) aur Lagna Vrishabh (Taurus) hai.

Aapka traditional North Indian Kundli chart niche mil raha hai:

IMAGE_URL: https://hans-ai-dashboard.com/kundli-images/kundli_+919760347653_1714567890.png

**🛑 CRITICAL: You MUST include the IMAGE_URL line in your response! The webhook will extract it and send the image to WhatsApp.**

**EXAMPLE (what you should output - EXACTLY 3 lines, NO MEDIA TAG, NO IMAGE):**
Vardhan ji, aapka Kundli chart tayyar ho gaya hai.

Aapka Rashi Meen (Pisces) aur Lagna Vrishabh (Taurus) hai.

Aapka traditional North Indian Kundli chart niche mil raha hai.

**🛑 CRITICAL RULES:**
- You MUST include the `data:media_base64:image/png,base64data...` line from the script output
- Do NOT use markdown format like `![Kundli](data:image/png;base64,...)`
- Do NOT include error messages or warnings from OpenClaw
- Copy the ENTIRE `data:media_base64:` line exactly as the script outputs it

**Example (EXACT OUTPUT - nothing after line 3):**
Vardhan bhai, aapka Kundli chart tayyar ho gaya hai.

Aapka Rashi Meen (Pisces) aur Lagna Vrishabh (Taurus) hai.

Yeh raha aapka chart:

---
**HARD RULES:**
1. **Never use "Singh rashi" for Feb 16 born people.** Western astrology says Aquarius, Vedic astrology says Pisces/Meen. Always trust `calculate.py`.
2. Keep responses to **max 3 lines** for chart requests.
3. **Double newline (Enter twice)** between each line.
4. **No heavy Hindi.** Use simple Hinglish (e.g. "placed hai", "strong chances hain").
5. **🛑 MEDIA Tag - DO NOT ADD YOUR OWN:** When the draw_kundli_traditional.py script completes, it ALREADY outputs the MEDIA_BASE64 tag automatically. Do NOT write "MEDIA: Kundli Chart". Do NOT add any MEDIA tag at all. Just write your 3-line text response and let the script's output handle the image automatically.
6. **🛑 NO BASE64 IN TEXT RESPONSE:** NEVER include `![Kundli](data:image/png;base64,...)` or any base64 data in your response. The webhook extracts it automatically from the script's console output. Including base64 in text causes WhatsApp errors.
