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

## 🎯 MEMORY ARCHITECTURE - Understand the Separation

| Component | Purpose | Duration | Example |
|-----------|---------|----------|---------|
| **MongoDB (fetch_history.py)** | Short-term conversation log | Last 40 messages | Recent chat flow |
| **mem0 (mem0_client.py)** | Long-term persistent memory | Forever | Birth details, emotional patterns |

**Both are used together** - MongoDB for recent context, mem0 for long-term friendship building.

---

## 📋 What to Remember (Save to Mem0)

### ✅ ALWAYS Save These:

#### 1. **Birth Details** (MANDATORY - First Priority)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Name: [Name], DOB: [DOB], Time: [Time], Place: [Place], Gender: [male/female]" --user-id "<USER_ID>"
```

#### 2. **Emotional State After Conversations** (NEW - Critical for Friendship)
Store how user felt at the end of conversation:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Emotional state: User seemed [depressed/anxious/happy/relieved] about [topic]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Emotional state: User was very anxious about career, stressed about job search. 12 May 2026"`
- `"Emotional state: User shared feeling lonely and overwhelmed. Needed emotional support. 11 May 2026"`
- `"Emotional state: User seemed happy, daughter's health improved. 13 May 2026"`
- `"Emotional state: User feeling hopeful after writing suggestion, said they will try diary. 12 May 2026"`

#### 3. **Important People in User's Life** (NEW - For Personal Touch)
Store relationships user mentions:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Important person: [Relation] named [Name], [Context]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Important person: Daughter named Aradhya, health issues, user very worried. May 2026"`
- `"Important person: Wife named Priya, relationship going through difficult phase. May 2026"`
- `"Important person: Mother, user cares about her health. June 2026"`

#### 4. **Key Concerns & Worries** (NEW - For Follow-up)
Store what's bothering user:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "User concern: [What user is worried about]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"User concern: Fear of people, social anxiety, overthinking, feeling worthless. May 2026"`
- `"User concern: Marriage timing pressure from family. April 2026"`
- `"User concern: Career stuck, no job offers, feeling frustrated. May 2026"`
- `"User concern: Daughter's health issues, very worried. May 2026"`

#### 5. **Remedies Given & Results** (ENHANCED - For Tracking Progress)
Store what remedies were suggested and user's reaction:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Remedy suggested: [Remedy] for [problem]. User reaction: [Agreed/Skeptical/Will try]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Remedy suggested: Hanuman Chalisa for fear and anxiety. User said they will try. 12 May 2026"`
- `"Remedy suggested: Somvar vrat for daughter's health. User agreed. 11 May 2026"`
- `"Remedy suggested: White item donation on Friday for marriage. User seemed open to it. 13 May 2026"`

#### 6. **Progress Updates** (NEW - Track Improvement)
Store when user reports progress:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Progress update: [What changed/improved]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Progress update: User started writing diary for emotional release, said it helps. May 2026"`
- `"Progress update: Daughter's health improved much better now. User relieved. 13 May 2026"`
- `"Progress update: User still struggling with fear, no improvement yet. 12 May 2026"`
- `"Progress update: User got new job offer! Feeling much better. June 2026"`

#### 7. **User Preferences** (For Personalization)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "User preference: [What user likes/dislikes]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"User preference: Likes detailed explanations, not just short answers"`
- `"User preference: Prefers Hinglish, not pure Hindi"`
- `"User preference: Gets overwhelmed with too much technical jargon"`
- `"User preference: Appreciates emotional support before solutions"`

#### 8. **Predictions Given** (For Consistency)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Prediction: [What you predicted] for [topic]. Timing: [when]. [Date]" --user-id "<USER_ID>"
```

**Examples:**
- `"Prediction: Marriage timing December 2027, based on 7th house analysis. Given May 2026"`
- `"Prediction: Career improvement after July 2026, Mars pratyantar starts. Given May 2026"`

---

### ❌ NEVER Store These:
- Generic greetings ("Hi", "Hello")
- System messages or internal notes
- Temporary moods unless they form a pattern
- Duplicate information (use upsert instead)
- Other users' data

---

## 🔍 Enhanced Retrieval Strategies

### Strategy 1: **Emotional Context Search** (Use for Personalized Greetings)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "emotional state worried concerned" --user-id "<USER_ID>"
```

**Use this to:**
- Understand if user was depressed/stressed last time
- Reference their progress: "Pichli baar itna stress share kiya tha, ab kaisa feel ho raha hai?"
- Show continuity: "Aapki beti ki health improvement ka maine note kiya tha, kaisa hai ab?"

### Strategy 2: **Important People Search** (Use for Personal Touch)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "important person daughter wife mother" --user-id "<USER_ID>"
```

**Use this to:**
- Ask about people they care about: "Aradhya kaisi hain ab?"
- Show you remember: "Aapki beti ke baare mein socha, thodi improvement hui na?"
- Build connection: "Aapki Priya kaisi hain?"

### Strategy 3: **Concerns Progress Search** (Use for Follow-up)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "concern worry stressed" --user-id "<USER_ID>"
```

**Use this to:**
- Follow up on worries: "Pichli baar career stress share kiya tha, koi update?"
- Track improvement: "Fear waise kam hua ya waisa hi hai?"
- Show empathy: "Aapki loneliness ki baat yaad aayi, ab kaisa feel ho raha hai?"

### Strategy 4: **Remedy Effectiveness Search** (Use for Better Recommendations)
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py search "remedy suggested" --user-id "<USER_ID>"
```

**Use this to:**
- Check if remedies worked: "Pichli baar Hanuman Chalisa suggest kiya tha, try kiya?"
- Adjust recommendations based on feedback
- Track user's spiritual journey

---

## 🔄 Automatic Memory Updates (Do These After EVERY Conversation)

### After Emotional Conversations:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py upsert "emotional state" --content "[How user seemed at end]. [Date]" --user-id "<USER_ID>"
```

### After Giving Remedies:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Remedy suggested: [Remedy] for [problem]. User reaction: [their response]. [Date]" --user-id "<USER_ID>"
```

### When User Shares Updates:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Progress update: [What user reported]. [Date]" --user-id "<USER_ID>"
```

### When User Mentions Important People:
```bash
python3 ~/.openclaw/skills/mem0/mem0_client.py add "Important person: [Relation] [Name], [Context]. [Date]" --user-id "<USER_ID>"
```

---

## 📋 Memory Checklist (Use for EVERY Message)

### Before Responding:
- [ ] Search for emotional state from last conversation
- [ ] Search for important people mentioned before
- [ ] Search for concerns/worries shared before
- [ ] Check what remedies were suggested
- [ ] Use this info to personalize response

### After Responding:
- [ ] Did user share any emotional state? Store it.
- [ ] Did user mention any important person? Store it.
- [ ] Did user share any update/progress? Store it.
- [ ] Did I give any remedy? Store it with user's reaction.
- [ ] Did user share any preference? Store it.

---

## 🎯 Example: Enhanced Memory in Action

**Scenario: User returns after 1 week**

**Step 1: Search Enhanced Memory**
```bash
# Check emotional state
python3 ~/.openclaw/skills/mem0/mem0_client.py search "emotional state worried" --user-id "+919876543210"
# Found: "User was very anxious about career, stressed. 12 May 2026"

# Check important people
python3 ~/.openclaw/skills/mem0/mem0_client.py search "important person" --user-id "+919876543210"
# Found: "Daughter named Aradhya, health issues, user very worried. May 2026"

# Check concerns
python3 ~/.openclaw/skills/mem0/mem0_client.py search "concern" --user-id "+919876543210"
# Found: "User concern: Fear of people, social anxiety. May 2026"

# Check remedies
python3 ~/.openclaw/skills/mem0/mem0_client.py search "remedy suggested" --user-id "+919876543210"
# Found: "Remedy suggested: Hanuman Chalisa for fear. User said they will try. 12 May 2026"
```

**Step 2: Combine with MongoDB (Last 40 Messages)**
```bash
python3 ~/.openclaw/skills/mongo_logger/fetch_history.py --user-id "+919876543210" --limit 40
# Shows recent conversation flow: Last discussed diary writing
```

**Step 3: Personalized Response**
```
Agent: "Aapki yaad aa gayi.

Pichli baar itna stress share kiya tha career ke baare mein. Ab kaisa feel ho raha hai?

Aradhya kaisi hain ab? Thodi improvement hui na unki health mein?

Hanuman Chalisa try kiya tha jo maine suggest kiya tha? Koi farak pad raha hai?"

Pichli baar diary likhne ki baat ki thi, woh start kiya?
```

---

**Remember: MongoDB = Recent conversation flow, mem0 = Long-term friendship. Use both together!**
