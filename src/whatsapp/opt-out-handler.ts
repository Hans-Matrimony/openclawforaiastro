/**
 * WhatsApp Business API: Opt-Out Handler
 * MANDATORY for compliance - users must be able to opt-out
 *
 * Meta Policy:
 * - When user asks to stop, immediately stop ALL messages
 * - Remove from contact list
 * - Do NOT message again unless they re-opt-in
 *
 * This module handles opt-out detection and enforcement.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("whatsapp/opt-out");

// Keywords that indicate user wants to opt-out
const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "dont message",
  "don't message",
  "do not message",
  "not interested",
  "remove me",
  "never message",
  "no more messages",
  "cancel",
  "please stop",
  // Hinglish keywords
  "कृपया संदेश न भेजें", // "Please don't message"
  "मैसेज ना करो", // "Don't message"
  "बंद करो", // "Stop it"
  "मत भेजो", // "Don't send"
  "बस करो", // "Stop it / enough"
];

// Keywords that indicate user wants to opt-in again
const OPT_IN_KEYWORDS = [
  "start",
  "subscribe",
  "begin messaging",
  "yes i want messages",
  "opt in",
  // Hinglish keywords
  "शुरू करो", // "Start"
  "फिर से भेजो", // "Send again"
  "मैसेज करो", // "Send message"
];

export interface OptOutStore {
  optedOutNumbers: string[]; // E.164 format
  optedOutAt: Record<string, number>; // phoneNumber -> timestamp
  optedInAt: Record<string, number>; // phoneNumber -> timestamp (for re-opt-ins)
}

const OPT_OUT_FILE = ".openclaw/whatsapp-opt-out.json";

/**
 * Normalize phone number to E.164 format for storage
 */
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    // Indian number
    return `+${digits}`;
  }
  if (digits.length === 10) {
    // Assume India if no country code
    return `+91${digits}`;
  }
  return `+${digits}`;
}

/**
 * Load opt-out store from disk
 */
export async function loadOptOutStore(): Promise<OptOutStore> {
  try {
    const filePath = path.join(process.env.HOME || "", OPT_OUT_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - return empty store
    return {
      optedOutNumbers: [],
      optedOutAt: {},
      optedInAt: {},
    };
  }
}

/**
 * Save opt-out store to disk
 */
async function saveOptOutStore(store: OptOutStore): Promise<void> {
  try {
    const dirPath = path.join(process.env.HOME || "", ".openclaw");
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, "whatsapp-opt-out.json");
    await fs.writeFile(filePath, JSON.stringify(store, null, 2));
  } catch (err) {
    log.error("Failed to save opt-out store", { error: String(err) });
  }
}

/**
 * Check if a message contains opt-out keywords
 */
export function isOptOutMessage(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  return OPT_OUT_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

/**
 * Check if a message contains opt-in keywords (re-opting in)
 */
export function isOptInMessage(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  return OPT_IN_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

/**
 * Check if a number has opted out
 */
export async function hasOptedOut(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptOutStore();
  return store.optedOutNumbers.includes(normalized);
}

/**
 * Handle user opt-out request
 */
export async function handleOptOut(
  phoneNumber: string,
): Promise<{ handled: boolean; responseMessage?: string }> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptOutStore();

  // Check if already opted out
  if (store.optedOutNumbers.includes(normalized)) {
    log.info("User already opted out", { phoneNumber: normalized });
    return {
      handled: true,
      responseMessage:
        "Aap already opted out ho. Agar baad mein chahte ho toh zaroor batana.",
    };
  }

  // Add to opted out list
  store.optedOutNumbers.push(normalized);
  store.optedOutAt[normalized] = Date.now();

  await saveOptOutStore(store);

  log.info("User opted out", { phoneNumber: normalized });

  return {
    handled: true,
    responseMessage:
      "Theek hai, main aapko messages nahi karunga.\n\nAgar baad mein chahte ho toh zaroor batana.\n\nNamaste!",
  };
}

/**
 * Handle user opt-in request (re-opting in after opt-out)
 */
export async function handleOptIn(
  phoneNumber: string,
): Promise<{ handled: boolean; responseMessage?: string }> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptOutStore();

  // Check if was opted out
  if (!store.optedOutNumbers.includes(normalized)) {
    log.info("User was not opted out", { phoneNumber: normalized });
    return {
      handled: true,
      responseMessage:
        "Aap already opted in ho. Koi sawaal ho toh zaroor poochiye.",
    };
  }

  // Remove from opted out list
  store.optedOutNumbers = store.optedOutNumbers.filter((n) => n !== normalized);
  store.optedInAt[normalized] = Date.now();
  delete store.optedOutAt[normalized];

  await saveOptOutStore(store);

  log.info("User opted in (re-opted)", { phoneNumber: normalized });

  return {
    handled: true,
    responseMessage:
      "Dhanyavad! Ab main aapko messages kar sakta hoon.\n\nKoi sawaal ho toh zaroor poochiye.",
  };
}

/**
 * Get all opted out numbers (for admin/monitoring)
 */
export async function getOptedOutNumbers(): Promise<string[]> {
  const store = await loadOptOutStore();
  return store.optedOutNumbers;
}

/**
 * Get opt-out statistics
 */
export async function getOptOutStats(): Promise<{
  totalOptedOut: number;
  optedOutThisWeek: number;
  optedOutThisMonth: number;
}> {
  const store = await loadOptOutStore();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const optedOutThisWeek = Object.values(store.optedOutAt).filter(
    (ts) => ts >= weekAgo,
  ).length;

  const optedOutThisMonth = Object.values(store.optedOutAt).filter(
    (ts) => ts >= monthAgo,
  ).length;

  return {
    totalOptedOut: store.optedOutNumbers.length,
    optedOutThisWeek,
    optedOutThisMonth,
  };
}

/**
 * Clear opt-out for a specific number (admin function - use carefully)
 */
export async function clearOptOut(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptOutStore();

  if (!store.optedOutNumbers.includes(normalized)) {
    return false;
  }

  store.optedOutNumbers = store.optedOutNumbers.filter((n) => n !== normalized);
  delete store.optedOutAt[normalized];

  await saveOptOutStore(store);

  log.info("Admin cleared opt-out", { phoneNumber: normalized });

  return true;
}
