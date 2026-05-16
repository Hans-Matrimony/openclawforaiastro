# Memory Guidelines - Enhanced for Better Friendships

You wake up fresh each session. These are your continuity rules.

---

## ⚠️ PRIVACY ISOLATION RULE (CRITICAL — READ FIRST)

**Before ANY memory operation, you MUST:**

1. Extract `user_id` from the message envelope: `[From: Name (user_id) at Time]`
2. Verify `user_id` is valid (not empty, not "unknown", not a placeholder)
3. Use ONLY this `user_id` for ALL memory operations
4. NEVER use a different `user_id` in the same conversation

**⚠️ USER DATA LEAKAGE PREVENTION:**
- User A's `user_id` → User A's memory ONLY
- User B's `user_id` → User B's memory ONLY
- When user changes, memory MUST be isolated

---

## 🚀 ENHANCED MEMORY USAGE - What to Store

### ✅ ALWAYS Store These (NEW EXPANDED LIST):

#### 1. **Basic Identity (MANDATORY)**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Name: [Name], DOB: [DOB], Time: [Time], Place: [Place], Gender: [male/female]" --user-id "<USER_ID>"
```

#### 2. **Emotional State After Conversations (NEW - CRITICAL FOR FRIENDSHIP)**
After emotional conversations, store how user was feeling:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Emotional state: [User seemed depressed/anxious/happy about topic]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Emotional state: User was very anxious about career, stressed about job search. 12 May 2026"`
- `"Emotional state: User shared feeling lonely and overwhelmed. Needed emotional support. 11 May 2026"`
- `"Emotional state: User seemed happy, daughter's health improved. 13 May 2026"`

#### 3. **Important People in User's Life (NEW - FOR PERSONAL TOUCH)**
Store relationships user mentions:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Important person: [Relation] named [Name], [Context]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Important person: Daughter named Aradhya, health issues, user very worried. May 2026"`
- `"Important person: Wife named Priya, relationship going through difficult phase. May 2026"`
- `"Important person: Mother, user cares about her health. June 2026"`

#### 4. **Key Concerns & Worries (NEW - FOR FOLLOW-UP)**
Store what's bothering user:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "User concern: [What user is worried about]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"User concern: Fear of people, social anxiety, overthinking, feeling worthless. May 2026"`
- `"User concern: Marriage timing pressure from family. April 2026"`
- `"User concern: Career stuck, no job offers, feeling frustrated. May 2026"`

#### 5. **Remedies Given & Results (NEW - FOR TRACKING PROGRESS)**
Store what remedies were suggested:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Remedy suggested: [Remedy] for [problem]. [Date]. User feedback: [if any]" --user-id "<USER_ID>"
```

**Examples:**
- `"Remedy suggested: Hanuman Chalisa for fear and anxiety. User said they will try. 12 May 2026"`
- `"Remedy suggested: Somvar vrat for daughter's health. User agreed. 11 May 2026"`
- `"Remedy suggested: White item donation on Friday for marriage. 13 May 2026"`

#### 6. **Progress Updates (NEW - FOR CONTINUITY)**
Store when user reports progress:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Progress update: [What changed]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Progress update: User started writing diary for emotional release, said it helps. May 2026"`
- `"Progress update: Daughter's health improved much better now. User relieved. 13 May 2026"`
- `"Progress update: User still struggling with fear, no improvement yet. 12 May 2026"`

#### 7. **User Preferences (NEW - FOR PERSONALIZATION)**
Store user's communication preferences:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "User preference: [What user likes/dislikes]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"User preference: Likes detailed explanations, not just short answers"`
- `"User preference: Prefers Hinglish, not pure Hindi"`
- `"User preference: Gets overwhelmed with too much technical jargon"`
- `"User preference: Appreciates emotional support before solutions"`

#### 8. **Predictions Given (EXISTING - ENHANCED)**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Prediction: [What you predicted] for [topic]. [Date]. Timing: [when]" --user-id "<USER_ID>"
```

**Examples:**
- `"Prediction: Marriage timing December 2027, based on 7th house analysis. Given May 2026"`
- `"Prediction: Career improvement after July 2026, Mars pratyantar starts. Given May 2026"`
- `"Prediction: Health improvement from September 2026 when Ketu antardasha ends. Given May 2026"`

---

### ❌ NEVER Store These:
- Generic greetings ("Hi", "Hello")
- System messages
- Temporary moods unless recurring pattern
- Duplicate information
- Other users' data

---

## 🧠 ENHANCED RETRIEVAL STRATEGIES

### Strategy 1: **Emotional Context Search (NEW - USE FOR EVERY MESSAGE)**
Before responding, search for emotional state:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "emotional state worried concern" --user-id "<USER_ID>"
```

**Use this to:**
- Understand if user was depressed last time
- Reference their progress: "Pichli baar aap bahut stressed the, ab kaisa feel ho raha hai?"
- Show continuity: "Aapki beti ki health improvement ka maine note kiya tha, kaisa hai ab?"

### Strategy 2: **Important People Search (NEW - USE FOR PERSONAL TOUCH)**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "important person daughter wife mother" --user-id "<USER_ID>"
```

**Use this to:**
- Ask about people they care about: "Aradhya ji kaisi hain ab?"
- Show you remember: "Aapki beti ke baare mein socha, thodi improvement hui na?"
- Build connection: "Aapki Priya ji kaisi hain?"

### Strategy 3: **Concerns Progress Search (NEW - USE FOR FOLLOW-UP)**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "concern worry stressed" --user-id "<USER_ID>"
```

**Use this to:**
- Follow up on worries: "Pichli baar career stress share kiya tha, koi update?"
- Track improvement: "Fear waise kam hua ya waisa hi hai?"
- Show empathy: "Aapki loneliness ki baat yaad aayi, ab kaisa feel ho raha hai?"

### Strategy 4: **Remedy Effectiveness Search (NEW - USE FOR BETTER REMEDIES)**
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "remedy suggested" --user-id "<USER_ID>"
```

**Use this to:**
- Check if remedies worked: "Pichli baar Hanuman Chalisa suggest kiya tha, try kiya?"
- Adjust recommendations based on feedback
- Track user's spiritual journey

---

## 🔄 AUTOMATIC MEMORY UPDATES (NEW - DO THESE AFTER EVERY CONVERSATION)

### After Emotional Conversations:
```bash
# Update emotional state
python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "emotional state" --content "[How user seemed at end of conversation]. [Date]" --user-id "<USER_ID>"
```

### After Giving Remedies:
```bash
# Store remedy with user's reaction
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Remedy suggested: [Remedy] for [problem]. User reaction: [Agreed/Skeptical/Will try]. [Date]" --user-id "<USER_ID>"
```

### When User Shares Updates:
```bash
# Store progress
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Progress update: [What user reported]. [Date]" --user-id "<USER_ID>"
```

### When User Mentions Important People:
```bash
# Store relationship info
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Important person: [Relation] [Name], [Context]. [Date]" --user-id "<USER_ID>"
```

---

## 📋 MEMORY CHECKLIST (USE FOR EVERY MESSAGE)

Before responding:
- [ ] Search for emotional state from last conversation
- [ ] Search for important people mentioned before
- [ ] Search for concerns/worries shared before
- [ ] Check what remedies were suggested

After responding:
- [ ] Did user share any emotional state? Store it.
- [ ] Did user mention any important person? Store it.
- [ ] Did user share any update/progress? Store it.
- [ ] Did I give any remedy? Store it with user's reaction.
- [ ] Did user share any preference? Store it.

---

## 🎯 EXAMPLE: ENHANCED MEMORY IN ACTION

**Scenario: User returns after 1 week**

**OLD APPROACH (without enhanced memory):**
```
Agent: "Hello! How are you today?"
```

**NEW APPROACH (with enhanced memory):**
```
1. Check mem0 for emotional state → Found: "User was very anxious about career, stressed"
2. Check mem0 for concerns → Found: "User concern: Fear of people, social anxiety"
3. Check mem0 for important people → Found: "Daughter Aradhya health issues"
4. Check mem0 for remedies → Found: "Suggested Hanuman Chalisa, user agreed to try"

Agent: "Arre Amlan ji! Aapki yaad aa gayi.

Pichli baar itna stress share kiya tha career ke baare mein. Kaisa feel ho raha hai ab?

Aur Aradhya ji kaisi hain? Thodi improvement hui na unki health mein?

Hanuman Chalisa try kiya tha jo maine suggest kiya tha?"
```

---

**Remember: Better memory = Better friendship = More engaging conversations!**
