/**
 * WhatsApp Business Cloud API: 24-Hour Window Enforcement
 * CRITICAL: Sending messages outside this window will cause BAN
 *
 * Meta Policy:
 * - Within 24 hours of user's last message → Free-form messages allowed ✅
 * - After 24 hours → Only pre-approved templates allowed ❌
 *
 * This module enforces the 24-hour window check before ANY outbound message.
 */

import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import type { OpenClawConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const log = createSubsystemLogger("whatsapp/24-hour-window");

export interface WindowCheckResult {
  allowed: boolean;
  reason?: "within-window" | "outside-window" | "no-previous-message" | "user-not-found";
  lastMessageAt?: number;
  hoursSinceLastMessage?: number;
  windowClosesAt?: number;
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
  const sessionKey = Object.keys(store).find((key) =>
    key.includes("whatsapp") && key.includes(phoneNumber),
  );

  if (!sessionKey) {
    log.debug("Window check: user not found", { phoneNumber });
    return {
      allowed: false,
      reason: "user-not-found",
    };
  }

  const entry = store[sessionKey];
  if (!entry) {
    log.debug("Window check: no session entry", { phoneNumber, sessionKey });
    return {
      allowed: false,
      reason: "user-not-found",
    };
  }

  const updatedAt = entry.updatedAt;
  if (!updatedAt) {
    log.debug("Window check: no previous message timestamp", { phoneNumber });
    return {
      allowed: false,
      reason: "no-previous-message",
    };
  }

  const now = Date.now();
  const timeSinceLastMessage = now - updatedAt;
  const hoursSince = timeSinceLastMessage / (60 * 60 * 1000);

  if (timeSinceLastMessage <= WINDOW_MS) {
    const windowClosesAt = updatedAt + WINDOW_MS;
    log.debug("Window check: within 24-hour window", {
      phoneNumber,
      hoursSince: hoursSince.toFixed(2),
      windowClosesAt: new Date(windowClosesAt).toISOString(),
    });
    return {
      allowed: true,
      reason: "within-window",
      lastMessageAt: updatedAt,
      hoursSinceLastMessage: hoursSince,
      windowClosesAt,
    };
  }

  log.warn("Window check: OUTSIDE 24-hour window", {
    phoneNumber,
    hoursSince: hoursSince.toFixed(2),
    lastMessageAt: new Date(updatedAt).toISOString(),
  });
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
 * Get human-readable status message for window check result.
 */
export function getWindowStatusMessage(checkResult: WindowCheckResult): string {
  switch (checkResult.reason) {
    case "within-window":
      const hoursLeft = checkResult.windowClosesAt
        ? ((checkResult.windowClosesAt - Date.now()) / (60 * 60 * 1000)).toFixed(1)
        : "unknown";
      return `Within 24-hour window (${hoursLeft}h remaining)`;
    case "outside-window":
      return `Outside 24-hour window (${checkResult.hoursSinceLastMessage?.toFixed(1)}h since last message)`;
    case "no-previous-message":
      return "No previous message from user";
    case "user-not-found":
      return "User not found in session store";
    default:
      return "Unknown status";
  }
}

/**
 * Log a 24-hour window violation for monitoring.
 * DO NOT send the message - this prevents bans.
 */
export function logWindowViolation(
  phoneNumber: string,
  checkResult: WindowCheckResult,
  context?: string,
): void {
  log.error("BLOCKED: Message outside 24-hour window", {
    phoneNumber,
    hoursSinceLastMessage: checkResult.hoursSinceLastMessage?.toFixed(2),
    lastMessageAt: checkResult.lastMessageAt
      ? new Date(checkResult.lastMessageAt).toISOString()
      : undefined,
    reason: "Sending this message would violate Meta's Business Messaging Policy",
    context,
  });
}

/**
 * Format time remaining in window as human-readable string.
 */
export function formatTimeRemaining(windowClosesAt: number): string {
  const now = Date.now();
  const remaining = windowClosesAt - now;

  if (remaining <= 0) {
    return "Window closed";
  }

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}
