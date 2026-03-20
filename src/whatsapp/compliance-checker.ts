/**
 * WhatsApp Business API: Comprehensive Compliance Checker
 *
 * This module combines ALL compliance checks before sending any message:
 * 1. Opt-in verification
 * 2. Opt-out check
 * 3. 24-hour window check
 * 4. Quiet hours check
 *
 * Use this before EVERY outbound WhatsApp message to prevent bans.
 */

import type { OpenClawConfig } from "../config/config.js";
import { check24HourWindow, requiresTemplate } from "./24-hour-check.js";
import { hasOptedOut, handleOptOut as handleUserOptOut } from "./opt-out-handler.js";
import { canMessageUser } from "./opt-in-tracker.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("whatsapp/compliance");

export interface ComplianceCheckResult {
  allowed: boolean;
  reason: string;
  checks: {
    optIn: { allowed: boolean; reason?: string };
    optOut: { allowed: boolean; reason?: string };
    window24h: { allowed: boolean; reason?: string };
    quietHours: { allowed: boolean; reason?: string };
  };
  suggestedAction?: "use-template" | "wait-for-user" | "get-opt-in" | "stop-messaging";
}

export interface ComplianceCheckOptions {
  skipOptInCheck?: boolean; // For replies to user messages (already consented)
  skipWindowCheck?: boolean; // For templates (not constrained by 24h window)
  quietHoursStart?: number; // Hour in 24h format (default: 21 = 9 PM)
  quietHoursEnd?: number; // Hour in 24h format (default: 9 = 9 AM)
  timeZone?: string; // Timezone for quiet hours (default: user timezone or IST)
}

const DEFAULT_QUIET_HOURS_START = 21; // 9 PM IST
const DEFAULT_QUIET_HOURS_END = 9; // 9 AM IST
const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Comprehensive compliance check before sending ANY WhatsApp message
 *
 * CRITICAL: Call this function before EVERY outbound send to prevent ban
 *
 * @param phoneNumber - E.164 format phone number
 * @param options - Optional configuration for checks
 * @param cfg - OpenClaw configuration
 * @returns ComplianceCheckResult with detailed status
 */
export async function checkCompliance(
  phoneNumber: string,
  options: ComplianceCheckOptions = {},
  cfg?: OpenClawConfig,
): Promise<ComplianceCheckResult> {
  const result: ComplianceCheckResult = {
    allowed: false,
    reason: "Checking compliance...",
    checks: {
      optIn: { allowed: true },
      optOut: { allowed: true },
      window24h: { allowed: true },
      quietHours: { allowed: true },
    },
  };

  // Check 1: Opt-In (can be skipped for replies to user messages)
  if (!options.skipOptInCheck) {
    const optInCheck = await canMessageUser(phoneNumber);
    result.checks.optIn = {
      allowed: optInCheck.allowed,
      reason: optInCheck.reason,
    };

    if (!optInCheck.allowed) {
      result.allowed = false;
      result.reason = `Opt-in check failed: ${optInCheck.reason}`;
      result.suggestedAction = "get-opt-in";
      log.warn("Compliance check failed: opt-in", { phoneNumber, reason: optInCheck.reason });
      return result;
    }
  }

  // Check 2: Opt-Out (user has asked to stop)
  const optedOut = await hasOptedOut(phoneNumber);
  result.checks.optOut = {
    allowed: !optedOut,
    reason: optedOut ? "User has opted out" : undefined,
  };

  if (optedOut) {
    result.allowed = false;
    result.reason = "User has opted out of messages";
    result.suggestedAction = "stop-messaging";
    log.warn("Compliance check failed: opt-out", { phoneNumber });
    return result;
  }

  // Check 3: 24-Hour Window (can be skipped for templates)
  if (!options.skipWindowCheck) {
    const windowCheck = await check24HourWindow(phoneNumber, cfg);
    result.checks.window24h = {
      allowed: windowCheck.allowed,
      reason: windowCheck.reason,
    };

    if (!windowCheck.allowed) {
      result.allowed = false;
      result.reason = `Outside 24-hour window (${windowCheck.hoursSinceLastMessage?.toFixed(1)}h since last message)`;
      result.suggestedAction = "use-template";
      log.warn("Compliance check failed: 24-hour window", {
        phoneNumber,
        hoursSince: windowCheck.hoursSinceLastMessage,
      });
      return result;
    }
  }

  // Check 4: Quiet Hours (9 PM - 9 AM IST)
  const quietHoursCheck = isWithinQuietHours(options);
  result.checks.quietHours = quietHoursCheck;

  if (!quietHoursCheck.allowed) {
    result.allowed = false;
    result.reason = "Outside allowed messaging hours (9 PM - 9 AM IST)";
    result.suggestedAction = "wait-for-user";
    log.warn("Compliance check failed: quiet hours", { phoneNumber });
    return result;
  }

  // All checks passed
  result.allowed = true;
  result.reason = "All compliance checks passed";
  log.debug("Compliance check passed", { phoneNumber });

  return result;
}

/**
 * Check if current time is within quiet hours
 */
function isWithinQuietHours(options: ComplianceCheckOptions): {
  allowed: boolean;
  reason?: string;
} {
  const startHour = options.quietHoursStart ?? DEFAULT_QUIET_HOURS_START;
  const endHour = options.quietHoursEnd ?? DEFAULT_QUIET_HOURS_END;

  try {
    const timeZone = options.timeZone ?? DEFAULT_TIMEZONE;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    });

    const currentHour = Number.parseInt(formatter.format(new Date()), 10);

    // Quiet hours: 9 PM (21) to 9 AM (9)
  // Handle wrap-around (e.g., 22 is > 9, so it's in quiet hours)
    const inQuietHours = currentHour >= startHour || currentHour < endHour;

    return {
      allowed: !inQuietHours,
      reason: inQuietHours
        ? `Current hour (${currentHour}) is in quiet hours (${startHour}:00 - ${endHour}:00)`
        : undefined,
    };
  } catch {
    // If timezone check fails, allow the message
    return { allowed: true };
  }
}

/**
 * Check if message requires a template (outside 24-hour window)
 */
export async function checkRequiresTemplate(
  phoneNumber: string,
  cfg?: OpenClawConfig,
): Promise<{ requiresTemplate: boolean; reason?: string }> {
  const windowCheck = await check24HourWindow(phoneNumber, cfg);

  if (requiresTemplate(windowCheck)) {
    return {
      requiresTemplate: true,
      reason: `Outside 24-hour window (${windowCheck.hoursSinceLastMessage?.toFixed(1)}h since last message)`,
    };
  }

  return { requiresTemplate: false };
}

/**
 * Handle incoming message for opt-out/opt-in keywords
 * Returns response message if keywords detected, null otherwise
 */
export async function handleOptKeywords(
  phoneNumber: string,
  messageText: string,
): Promise<{ handled: boolean; responseMessage?: string } | null> {
  const text = messageText.toLowerCase().trim();

  // Import to avoid circular dependency
  const { isOptOutMessage, isOptInMessage } = await import("./opt-out-handler.js");
  const { reactivateOptIn } = await import("./opt-in-tracker.js");

  // Check for opt-out
  if (isOptOutMessage(text)) {
    return await handleUserOptOut(phoneNumber);
  }

  // Check for opt-in (re-opting)
  if (isOptInMessage(text)) {
    await reactivateOptIn(phoneNumber);
    return {
      handled: true,
      responseMessage:
        "Dhanyavad! Ab main aapko messages kar sakta hoon.\n\nKoi sawaal ho toh zaroor poochiye.",
    };
  }

  return null;
}

/**
 * Get human-readable compliance report
 */
export function getComplianceReport(result: ComplianceCheckResult): string {
  const lines = [
    `Compliance Check Result: ${result.allowed ? "✅ PASSED" : "❌ FAILED"}`,
    "",
    `Reason: ${result.reason}`,
    "",
    "Checks:",
    `  Opt-In: ${result.checks.optIn.allowed ? "✅" : "❌"} ${result.checks.optIn.reason || ""}`,
    `  Opt-Out: ${result.checks.optOut.allowed ? "✅" : "❌"} ${result.checks.optOut.reason || ""}`,
    `  24-Hour Window: ${result.checks.window24h.allowed ? "✅" : "❌"} ${result.checks.window24h.reason || ""}`,
    `  Quiet Hours: ${result.checks.quietHours.allowed ? "✅" : "❌"} ${result.checks.quietHours.reason || ""}`,
  ];

  if (result.suggestedAction) {
    lines.push("");
    lines.push(`Suggested Action: ${result.suggestedAction}`);
  }

  return lines.join("\n");
}

/**
 * Log compliance failure for monitoring
 */
export function logComplianceFailure(
  phoneNumber: string,
  result: ComplianceCheckResult,
  context?: string,
): void {
  log.error("COMPLIANCE CHECK FAILED - MESSAGE BLOCKED", {
    phoneNumber,
    reason: result.reason,
    checks: result.checks,
    suggestedAction: result.suggestedAction,
    context,
  });
}

/**
 * Quick check for replies to user messages (relaxed checks)
 * Use this when replying to a user who just messaged you
 */
export async function checkReplyCompliance(
  phoneNumber: string,
  cfg?: OpenClawConfig,
): Promise<ComplianceCheckResult> {
  return checkCompliance(phoneNumber, { skipOptInCheck: true }, cfg);
}

/**
 * Full check for proactive messages (strict checks)
 * Use this for heartbeat nudges and proactive outreach
 */
export async function checkProactiveCompliance(
  phoneNumber: string,
  cfg?: OpenClawConfig,
): Promise<ComplianceCheckResult> {
  return checkCompliance(phoneNumber, { skipOptInCheck: false }, cfg);
}
