# WhatsApp Business Cloud API Ban Analysis & Fixes

**Date:** March 11, 2026
**Status:** BANNED → Using Baileys (Temporary) → Need Fixes Before Re-applying

---

## 🔴 Most Likely Causes of Your Ban

### 1. CRITICAL: No 24-Hour Window Enforcement in Code

**Problem:** Your `HEARTBEAT.md` documents the 24-hour rule, but the **actual sending code doesn't enforce it**.

**Evidence:**
```typescript
// src/infra/heartbeat-runner.ts - NO 24-hour check before sending!
await deliverOutboundPayloads({
  cfg,
  channel: delivery.channel,
  to: delivery.to,
  accountId: deliveryAccountId,
  payloads: [...],  // ❌ No check if user is within 24h window
  deps: opts.deps,
});
```

**What Meta Saw:**
- Your system sent messages to users who hadn't replied in 24+ hours
- These were free-form messages (not templates)
- **This is a DIRECT VIOLATION** of Meta's Business Messaging Policy

### 2. Heartbeat/Proactive Nudges Outside 24h Window

**Problem:** Your heartbeat system sends proactive follow-ups:

```typescript
// HEARTBEAT.md:186
"Follow-up nudges: Every 30 minutes (while within 24-hour window)"
```

**But the code doesn't actually check the window!**

**What Likely Happened:**
1. User messages your bot at 10:00 AM
2. Bot sends reply (within 24h ✅)
3. Heartbeat sends nudge at 10:30 AM (within 24h ✅)
4. ...user stops responding...
5. **24+ hours pass** (window closes ❌)
6. Heartbeat sends another nudge at 2:00 PM next day (**VIOLATION! ❌**)
7. Meta flags this as unsolicited messaging
8. Repeat for multiple users → **BAN**

### 3. No Template Message System

**Requirement:** After 24-hour window closes, only **pre-approved templates** can be sent.

**Your Project:** Has NO template system implementation.

**Evidence from code search:**
```
grep -r "template" --include="*.ts" src/
→ Only Line-related templates found
→ NO WhatsApp template implementation
```

### 4. No Automatic Opt-Out Handling

**Problem:** When users say "STOP", "UNSUBSCRIBE", "Don't message me", your system may not automatically block them from future messages.

**Meta Policy:** Immediate opt-out honoring is MANDATORY.

---

## ✅ Required Fixes Before Re-applying to Business API

### Fix #1: Add 24-Hour Window Check (CRITICAL)

Create a new file: `src/whatsapp/24-hour-check.ts`

```typescript
/**
 * WhatsApp Business Cloud API: 24-Hour Window Enforcement
 * CRITICAL: Sending messages outside this window will cause BAN
 */

import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import type { OpenClawConfig } from "../config/config.js";

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface WindowCheckResult {
  allowed: boolean;
  reason?: "within-window" | "outside-window" | "no-previous-message" | "user-not-found";
  lastMessageAt?: number;
  hoursSinceLastMessage?: number;
}

/**
 * Check if a WhatsApp recipient is within the 24-hour messaging window.
 * This is MANDATORY for WhatsApp Business Cloud API compliance.
 *
 * @param phoneNumber - E.164 format (e.g., "+919876543210")
 * @param cfg - OpenClaw configuration
 * @returns WindowCheckResult with allowance status and reason
 */
export async function check24HourWindow(
  phoneNumber: string,
  cfg?: OpenClawConfig,
): Promise<WindowCheckResult> {
  const config = cfg ?? (await import("../config/config.js")).loadConfig();
  const storePath = resolveStorePath(config.session?.store);
  const store = loadSessionStore(storePath);

  // Find the session key for this phone number
  // Session keys format: agent:astrologer:whatsapp:+919876543210
  const sessionKey = Object.keys(store).find(key =>
    key.includes("whatsapp") && key.includes(phoneNumber)
  );

  if (!sessionKey) {
    return {
      allowed: false,
      reason: "user-not-found",
    };
  }

  const entry = store[sessionKey];
  if (!entry) {
    return {
      allowed: false,
      reason: "user-not-found",
    };
  }

  const updatedAt = entry.updatedAt;
  if (!updatedAt) {
    return {
      allowed: false,
      reason: "no-previous-message",
    };
  }

  const now = Date.now();
  const timeSinceLastMessage = now - updatedAt;
  const hoursSince = timeSinceLastMessage / (60 * 60 * 1000);

  if (timeSinceLastMessage <= WINDOW_MS) {
    return {
      allowed: true,
      reason: "within-window",
      lastMessageAt: updatedAt,
      hoursSinceLastMessage: hoursSince,
    };
  }

  return {
    allowed: false,
    reason: "outside-window",
    lastMessageAt: updatedAt,
    hoursSinceLastMessage: hoursSince,
  };
}

/**
 * Check if a recipient is outside the 24-hour window and requires a template.
 */
export function requiresTemplate(checkResult: WindowCheckResult): boolean {
  return checkResult.reason === "outside-window";
}

/**
 * Log a 24-hour window violation for monitoring.
 * DO NOT send the message - this prevents bans.
 */
export function logWindowViolation(
  phoneNumber: string,
  checkResult: WindowCheckResult,
): void {
  const logger = (await import("../logging/subsystem.js"))
    .createSubsystemLogger("whatsapp/24-hour-window");

  logger.error("BLOCKED: Message outside 24-hour window", {
    phoneNumber,
    hoursSinceLastMessage: checkResult.hoursSinceLastMessage,
    lastMessageAt: checkResult.lastMessageAt,
    reason: "Sending this message would violate Meta's Business Messaging Policy",
  });
}
```

### Fix #2: Update heartbeat-runner.ts

**Add the 24-hour check BEFORE sending any heartbeat message:**

```typescript
// In runHeartbeatOnce function, before deliverOutboundPayloads:

import { check24HourWindow, logWindowViolation } from "../whatsapp/24-hour-check.js";

// ... existing code ...

if (delivery.channel === "whatsapp") {
  // CRITICAL: Check 24-hour window for WhatsApp Business API
  const windowCheck = await check24HourWindow(delivery.to, cfg);

  if (!windowCheck.allowed) {
    emitHeartbeatEvent({
      status: "skipped",
      reason: "outside-24h-window",
      durationMs: Date.now() - startedAt,
      channel: "whatsapp",
    });

    logWindowViolation(delivery.to, windowCheck);
    return { status: "skipped", reason: "outside-24h-window" };
  }
}

// Now safe to deliver
await deliverOutboundPayloads({...});
```

### Fix #3: Add Template Message System

Create: `src/whatsapp/template-messages.ts`

```typescript
/**
 * WhatsApp Business Cloud API: Template Messages
 * Required for sending messages OUTSIDE the 24-hour window
 */

export interface WhatsAppTemplate {
  name: string;           // Template name from WhatsApp Business Manager
  language: string;        // e.g., "en", "hi_IN"
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "footer";
  text?: string;
  parameters?: TemplateParameter[];
}

export interface TemplateParameter {
  type: "text" | "currency" | "date_time";
  text?: string;
  currency?: { amount: number; code: string };
  date_time?: { unix_epoch: number };
}

/**
 * Send a template message (required for 24h+ inactive users)
 * NOTE: Templates must be pre-approved in WhatsApp Business Manager
 */
export async function sendTemplateMessage(
  to: string,
  template: WhatsAppTemplate,
  accessToken: string,
  phoneNumberId: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to.replace(/\D/g, ""), // Strip everything except digits
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: template.components,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Example approved templates for astrology service:
 *
 * 1. "re_engagement_astrology_01":
 *    "Namaste {{1}}! It's been a while. Need guidance? Reply to restart."
 *
 * 2. "consultation_reminder":
 *    "Reminder: Your astrology consultation is scheduled for {{1}}. Reply to confirm."
 *
 * 3. "follow_up_update":
 *    "Update on your last question about {{1}}: {{2}}. Reply for more details."
 */
```

### Fix #4: Add Opt-Out Keyword Detection

Create: `src/whatsapp/opt-out-handler.ts`

```typescript
/**
 * WhatsApp Business API: Opt-Out Handler
 * MANDATORY for compliance - users must be able to opt-out
 */

const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "don't message",
  "do not message",
  "not interested",
  "remove me",
  "never message",
  "कृपया संदेश न भेजें",  // Hinglish: "Please don't message"
  "मैसेज ना करो",        // Hinglish: "Don't message"
  "बंद करो",             // Hinglish: "Stop it"
];

export function isOptOutMessage(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return OPT_OUT_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export interface OptOutStore {
  optedOutNumbers: string[];  // E.164 format
  optedOutAt: Record<string, number>;  // phoneNumber -> timestamp
}

/**
 * Handle user opt-out request
 */
export async function handleOptOut(
  phoneNumber: string,
  cfg?: any,
): Promise<{ handled: boolean; responseMessage?: string }> {
  // Store opt-out in your database/config
  // Send confirmation message
  // NEVER message this user again (unless they opt-in again)

  return {
    handled: true,
    responseMessage: "Theek hai, main aapko messages nahi karunga. Agar baad mein chahte ho toh zaroor batana. Namaste!"
  };
}

/**
 * Check if a number has opted out
 */
export function hasOptedOut(phoneNumber: string, optOutStore: OptOutStore): boolean {
  return optOutStore.optedOutNumbers.includes(phoneNumber);
}
```

### Fix #5: Update Message Sending Pipeline

Modify: `src/infra/outbound/deliver.ts`

```typescript
// Add BEFORE every WhatsApp send:

import { check24HourWindow } from "../whatsapp/24-hour-check.js";
import { hasOptedOut } from "../whatsapp/opt-out-handler.js";

export async function deliverOutboundPayloads(params: {
  // ... existing params ...
}): Promise<void> {
  const { channel, to, cfg } = params;

  // OPT-OUT CHECK
  if (channel === "whatsapp") {
    const optOutStore = loadOptOutStore(cfg);
    if (hasOptedOut(to, optOutStore)) {
      logOptOutBlocked(to);
      return; // DO NOT SEND
    }

    // 24-HOUR WINDOW CHECK
    const windowCheck = await check24HourWindow(to, cfg);
    if (!windowCheck.allowed) {
      logWindowViolation(to, windowCheck);

      // Option 1: Skip the message entirely
      return;

      // Option 2: Use a template instead (if template is available)
      // await sendTemplateMessage(...);
      return;
    }
  }

  // ... proceed with normal send ...
}
```

---

## 📋 Pre-Reapplication Checklist

Before re-applying to WhatsApp Business Cloud API, ensure:

- [ ] **24-hour window check** added to ALL outbound WhatsApp sends
- [ ] **Opt-out handling** implemented for common keywords
- [ ] **Template message system** ready (even if not immediately used)
- [ ] **Logging** for all blocked sends (for audit trail)
- [ ] **Test with sandbox** before going to production
- [ ] **Business verification** completed on Meta Business Suite
- [ ] **Phone number** verified (not VoIP/virtual)
- [ ] **Opt-in mechanism** clearly documented
- [ ] **Privacy policy** URL added to WhatsApp Business Profile
- [ ] **Contact info** updated (real phone, email, website)

---

## 🚨 What NOT To Do (Avoid Another Ban)

1. **NEVER** send free-form messages outside 24-hour window
2. **NEVER** ignore user opt-out requests
3. **NEVER** send to purchased/scrapped phone lists
4. **NEVER** use automated bulk messaging without templates
5. **NEVER** send marketing/promotional content without explicit opt-in
6. **NEVER** send messages 9 PM - 9 AM IST (quiet hours)

---

## 📝 Recommended Meta Business Manager Setup

1. **Create Message Templates** (submit for approval):
   - `re_engagement_astrology` - for re-engaging inactive users
   - `consultation_reminder` - for appointment reminders
   - `follow_up_update` - for providing updates

2. **Webhook Setup**:
   - Configure webhook URL to receive message status
   - Handle delivery failures gracefully
   - Track blocked numbers

3. **Phone Number**:
   - Use a legitimate business phone number
   - Display name: Your business name (e.g., "Hans Astro")
   - Category: "Professional Services"

---

**Generated:** 2026-03-11
**Priority:** CRITICAL - Implement before re-applying to WhatsApp Business Cloud API
