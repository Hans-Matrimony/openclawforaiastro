# ERROR ANALYSIS & FIXES

## Summary of Issues

### Issue 1: JavaScript Heap Out of Memory (CRITICAL)
**Error:** `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`

**Root Cause:** Node.js default memory limit is ~512MB-2GB. The application is exceeding this limit.

**Fix Options:**

#### Option A: Increase Node.js Memory Limit (Quick Fix)
```bash
# For development
export NODE_OPTIONS="--max-old-space-size=4096"

# For specific command
node --max-old-space-size=4096 scripts/run-node.mjs

# Update package.json scripts:
"start": "node --max-old-space-size=4096 scripts/run-node.mjs"
"gateway:dev": "OPENCLAW_SKIP_CHANNELS=1 CLAWDBOT_SKIP_CHANNELS=1 node --max-old-space-size=4096 scripts/run-node.mjs --dev gateway"
```

#### Option B: Add to .env file
```bash
# Create or update .env
NODE_OPTIONS=--max-old-space-size=4096
```

#### Option C: System-wide (Linux/Mac)
```bash
# ~/.bashrc or ~/.zshrc
export NODE_OPTIONS="--max-old-space-size=4096"
```

---

### Issue 2: Brave Search API Token Invalid
**Error:** `Brave Search API error (422): {"error":{"code":"SUBSCRIPTION_TOKEN_INVALID","detail":"The provided subscription token is invalid."`

**Root Cause:** The `BRAVE_SEARCH_API_KEY` environment variable is either:
- Not set
- Expired
- Invalid

**Fix Options:**

#### Option A: Set Valid API Key
```bash
# Get a valid key from https://brave.com/search/api/
export BRAVE_SEARCH_API_KEY="your_valid_key_here"

# Or add to .env file
echo "BRAVE_SEARCH_API_KEY=your_valid_key_here" >> .env
```

#### Option B: Disable Web Search Temporarily
```bash
# Disable web_search in openclaw.json
# Remove "web_search" from skills array
```

#### Option C: Switch to Perplexity Search
The code already supports Perplexity as fallback:
```bash
export PERPLEXITY_API_KEY="your_perplexity_key"
```

**File to check:** `src/agents/tools/web-search.ts` (lines 20-30)

---

### Issue 3: Drik Panchang Server 404 Errors
**Error:** `Drik Panchang Server 404 Error!`

**Root Cause:** This appears to be from an external API call to `drikpanchang.com` that is either:
- Down
- API endpoint changed
- Invalid URL being used

**Fix Options:**

#### Step 1: Find where Drik Panchang is being called
```bash
# Search for drikpanchang in the codebase
grep -r "drikpanchang" --include="*.ts" --include="*.js" --include="*.py"
```

#### Step 2: Update API endpoint if changed
If the API endpoint has changed, update it in the relevant file.

#### Step 3: Add error handling/fallback
Add try-catch around the API call to handle 404 gracefully.

#### Step 4: Consider switching to alternative panchang API
Use local calculation (which you already have in kundli/calculate.py using pyswisseph) instead of external API.

---

### Issue 4: DeepSeek Agent Termination
**Error:** `embedded run agent end: ... isError=true model=deepseek-v4-flash provider=deepseek error=terminated rawError=terminated`

**Root Cause:** The DeepSeek agent process is being terminated, likely due to:
- Memory issues (heap limit)
- Timeout
- Process crash

**Fix:**
- Fix Issue 1 (memory limit) which is likely causing this
- Check DeepSeek API key is valid
- Add retry logic for failed requests

---

## Priority Order for Fixes

1. **CRITICAL - Fix Memory Limit** (Issue 1)
   - This is causing cascading failures
   - Set `NODE_OPTIONS=--max-old-space-size=4096`

2. **HIGH - Fix Brave Search API** (Issue 2)
   - Set valid `BRAVE_SEARCH_API_KEY` or disable web_search
   - Location: Environment variable or .env file

3. **MEDIUM - Fix Drik Panchang 404** (Issue 3)
   - Find the API call location
   - Update endpoint or add fallback

4. **LOW - DeepSeek Agent** (Issue 4)
   - Should be resolved by fixing Issue 1

---

## Quick Start - Apply All Fixes

```bash
# 1. Create/update .env file
cat >> .env << 'EOF'
# Increase Node.js memory
NODE_OPTIONS=--max-old-space-size=4096

# Brave Search API (get from https://brave.com/search/api/)
BRAVE_SEARCH_API_KEY=your_valid_key_here

# Alternative: Perplexity Search
# PERPLEXITY_API_KEY=your_perplexity_key
EOF

# 2. Source the .env file
source .env

# 3. Restart the application
pnpm start
```

---

## Verification Steps

After applying fixes:

1. Check memory usage:
```bash
# Monitor Node process
ps aux | grep node
```

2. Test web search:
```bash
# Trigger a web search query
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "search for latest news"}'
```

3. Check logs for remaining errors
