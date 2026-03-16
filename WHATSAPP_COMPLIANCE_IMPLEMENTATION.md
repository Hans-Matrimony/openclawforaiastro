# WhatsApp Business API Compliance Implementation

**Status:** ✅ IMPLEMENTED
**Date:** March 11, 2026

This document describes the WhatsApp Business API compliance system implemented to prevent account bans and ensure adherence to Meta's messaging policies.

---

## Overview

The compliance system automatically enforces WhatsApp Business policies before ANY outbound message is sent. It consists of five core modules:

1. **24-Hour Window Check** - Ensures messages are sent within Meta's 24-hour conversation window
2. **Opt-Out Handler** - Detects and honors user opt-out requests
3. **Opt-In Tracker** - Verifies users have consented to receive messages
4. **Template Messages** - Provides interface for sending template messages (outside 24h window)
5. **Compliance Checker** - Unified interface combining all checks

---

## Files Created

| File | Purpose |
|------|---------|
| `src/whatsapp/24-hour-check.ts` | 24-hour window enforcement |
| `src/whatsapp/opt-out-handler.ts` | Opt-out keyword detection & handling |
| `src/whatsapp/opt-in-tracker.ts` | Opt-in consent tracking |
| `src/whatsapp/template-messages.ts` | Template message sending |
| `src/whatsapp/compliance-checker.ts` | Unified compliance checker |
| `src/whatsapp/compliance.ts` | Main export file |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/infra/heartbeat-runner.ts` | Added proactive compliance check before heartbeat sends |
| `src/infra/outbound/deliver.ts` | Added compliance check before ALL outbound messages |

---

## Usage

### Basic Compliance Check

```typescript
import { checkReplyCompliance, checkProactiveCompliance } from "./whatsapp/compliance.js";

// For replies to user messages (relaxed checks)
const replyCheck = await checkReplyCompliance("+919876543210");
if (!replyCheck.allowed) {
  console.log("Cannot reply:", replyCheck.reason);
  return;
}

// For proactive messages/heartbeats (strict checks)
const proactiveCheck = await checkProactiveCompliance("+919876543210");
if (!proactiveCheck.allowed) {
  console.log("Cannot send proactive:", proactiveCheck.reason);
  return;
}
```

### Handling Opt-In/Opt-Out Keywords

```typescript
import { handleOptKeywords } from "./whatsapp/compliance.js";

// Call when receiving user messages
const result = await handleOptKeywords(phoneNumber, messageText);
if (result?.handled) {
  // User sent opt-out or opt-in keyword
  // Send the response message
  await sendMessage(phoneNumber, result.responseMessage);
}
```

### Sending Template Messages (Outside 24h Window)

```typescript
import { sendReEngagementTemplate } from "./whatsapp/compliance.js";

// When user is outside 24-hour window
const config = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
};

await sendReEngagementTemplate(phoneNumber, "User Name", config);
```

---

## Compliance Checks Performed

### 1. Opt-In Verification
- Checks if user has explicitly opted in to receive messages
- Required for proactive messages
- Skipped for replies (user's message = consent)

### 2. Opt-Out Check
- Checks if user has previously opted out
- Blocks messages to opted-out users
- Keywords: "stop", "unsubscribe", "don't message", etc.

### 3. 24-Hour Window Check
- Verifies last user message was within 24 hours
- Free-form messages only allowed within window
- Outside window requires template message

### 4. Quiet Hours Check
- Blocks messages 9 PM - 9 AM IST
- Configurable timezone support

---

## Configuration

### Environment Variables

```bash
# WhatsApp Business Cloud API (for templates)
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v19.0
```

### Opt-Out Keywords (Default)

English: "stop", "unsubscribe", "don't message", "do not message", "not interested", "remove me", "never message", "no more messages", "cancel", "please stop"

Hinglish: "कृपया संदेश न भेजें", "मैसेज ना करो", "बंद करो", "मत भेजो", "बस करो"

### Opt-In Keywords (Default)

English: "start", "subscribe", "begin messaging", "yes i want messages", "opt in"

Hinglish: "शुरू करो", "फिर से भेजो", "मैसेज करो"

---

## Storage Files

| File | Purpose |
|------|---------|
| `~/.openclaw/whatsapp-opt-in.json` | Opt-in records |
| `~/.openclaw/whatsapp-opt-out.json` | Opt-out records |

---

## Monitoring and Logging

### Compliance Events Logged

```typescript
// When message is blocked by compliance
logComplianceFailure(phoneNumber, complianceCheck, context);

// Get detailed compliance report
import { getComplianceReport } from "./whatsapp/compliance.js";
console.log(getComplianceReport(result));
```

### Statistics

```typescript
import { getOptInStats, getOptOutStats } from "./whatsapp/compliance.js";

const optInStats = await getOptInStats();
console.log("Opt-in stats:", optInStats);

const optOutStats = await getOptOutStats();
console.log("Opt-out stats:", optOutStats);
```

---

## Testing Compliance

### Test 24-Hour Window Check

```typescript
import { check24HourWindow } from "./whatsapp/compliance.js";

const result = await check24HourWindow("+919876543210");
console.log("Within window:", result.allowed);
console.log("Hours since:", result.hoursSinceLastMessage);
```

### Test Opt-Out Detection

```typescript
import { isOptOutMessage } from "./whatsapp/compliance.js";

console.log(isOptOutMessage("Please stop messaging")); // true
console.log(isOptOutMessage("How are you?")); // false
```

---

## Migration: From Ban to Compliance

If you were previously banned from WhatsApp Business API:

1. **Root cause identified:** Messages sent outside 24-hour window without templates
2. **Fix implemented:** All five compliance modules now active
3. **Action required:**
   - Set up environment variables for template API
   - Create and approve templates in Meta Business Manager
   - Verify allowlist/pairing is properly configured
   - Test with sandbox before going live

---

## Pre-Reapplication Checklist

Before re-applying to WhatsApp Business Cloud API:

- [ ] All compliance modules implemented ✅
- [ ] Heartbeat messages check 24-hour window ✅
- [ ] Outbound delivery checks compliance ✅
- [ ] Opt-out keyword detection working
- [ ] Opt-in tracking functional
- [ ] Template system ready (templates need approval)
- [ ] Environment variables configured
- [ ] Testing completed with sandbox

---

## Important Notes

1. **Backward Compatibility:** The compliance system fails open if checks error out. This means existing functionality continues even if compliance checks have issues.

2. **Quiet Hours:** 9 PM - 9 AM IST is the default quiet period. Messages during this time are blocked for proactive outreach.

3. **24-Hour Window:** The window starts when USER messages YOU. It resets every time the user sends a new message.

4. **Templates:** Templates must be pre-approved in Meta Business Manager before use. You cannot send free-form messages after the 24-hour window closes.

---

## Support

For issues or questions:
- Check logs in: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- Look for subsystem: `whatsapp/24-hour-window`, `whatsapp/opt-out`, `whatsapp/compliance`
- Review compliance failures in log output

---

**Implementation Complete:** March 11, 2026
**Status:** Ready for testing with WhatsApp Business Cloud API sandbox
