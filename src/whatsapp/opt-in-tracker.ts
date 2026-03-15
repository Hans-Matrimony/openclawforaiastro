/**
 * WhatsApp Business API: Opt-In Tracking
 * MANDATORY for compliance - only message users who have opted in
 *
 * Meta Policy:
 * - Users must explicitly opt-in to receive messages
 * - Opt-in must be clear and specific
 * - Maintain record of opt-in consent
 * - Honor opt-out requests immediately
 *
 * This module tracks user opt-ins and provides verification.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("whatsapp/opt-in");

export type OptInSource =
  | "website_form"
  | "qr_code"
  | "business_card"
  | "referral"
  | "event"
  | "direct_request"
  | "import"
  | "other";

export interface OptInRecord {
  phoneNumber: string; // E.164 format
  optedInAt: number; // Timestamp
  source: OptInSource;
  sourceDetails?: string; // Additional context
  consentGiven: string; // What user consented to
  ipAddress?: string; // For audit trail
  confirmed?: boolean; // If double opt-in was used
  confirmedAt?: number; // Timestamp of confirmation
  revokedAt?: number; // If opt-in was revoked
}

export interface OptInStore {
  records: Record<string, OptInRecord>; // phoneNumber -> record
  lastUpdated: number;
}

const OPT_IN_FILE = ".openclaw/whatsapp-opt-in.json";

/**
 * Normalize phone number to E.164 format for storage
 */
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

/**
 * Load opt-in store from disk
 */
export async function loadOptInStore(): Promise<OptInStore> {
  try {
    const filePath = path.join(process.env.HOME || "", OPT_IN_FILE);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      records: {},
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Save opt-in store to disk
 */
async function saveOptInStore(store: OptInStore): Promise<void> {
  try {
    const dirPath = path.join(process.env.HOME || "", ".openclaw");
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, "whatsapp-opt-in.json");
    await fs.writeFile(filePath, JSON.stringify(store, null, 2));
  } catch (err) {
    log.error("Failed to save opt-in store", { error: String(err) });
  }
}

/**
 * Check if a user has opted in
 */
export async function hasOptedIn(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();
  const record = store.records[normalized];

  // Must have opted in AND not revoked
  if (!record) return false;
  if (record.revokedAt && record.revokedAt < Date.now()) return false;

  // Check if confirmation is required
  // For now, we accept single opt-in (can be upgraded to double)
  return true;
}

/**
 * Check if opt-in is still valid (not revoked)
 */
export async function isOptInValid(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();
  const record = store.records[normalized];

  if (!record) return false;
  if (record.revokedAt) return false;

  // Opt-in expires after 2 years if no interaction
  const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
  if (Date.now() - record.optedInAt > TWO_YEARS) {
    log.info("Opt-in expired", { phoneNumber: normalized });
    return false;
  }

  return true;
}

/**
 * Record user opt-in
 */
export async function recordOptIn(params: {
  phoneNumber: string;
  source: OptInSource;
  sourceDetails?: string;
  consentGiven: string;
  ipAddress?: string;
  confirmed?: boolean;
}): Promise<boolean> {
  const normalized = normalizePhoneNumber(params.phoneNumber);
  const store = await loadOptInStore();

  const record: OptInRecord = {
    phoneNumber: normalized,
    optedInAt: Date.now(),
    source: params.source,
    sourceDetails: params.sourceDetails,
    consentGiven: params.consentGiven,
    ipAddress: params.ipAddress,
    confirmed: params.confirmed,
    confirmedAt: params.confirmed ? Date.now() : undefined,
  };

  store.records[normalized] = record;
  store.lastUpdated = Date.now();

  await saveOptInStore(store);

  log.info("Opt-in recorded", {
    phoneNumber: normalized,
    source: params.source,
  });

  return true;
}

/**
 * Revoke opt-in (user opt-out)
 */
export async function revokeOptIn(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();

  const record = store.records[normalized];
  if (!record) {
    log.warn("Attempted to revoke non-existent opt-in", { phoneNumber: normalized });
    return false;
  }

  record.revokedAt = Date.now();
  store.lastUpdated = Date.now();

  await saveOptInStore(store);

  log.info("Opt-in revoked", { phoneNumber: normalized });

  return true;
}

/**
 * Re-activate opt-in (user opts back in after opting out)
 */
export async function reactivateOptIn(
  phoneNumber: string,
  newSource?: OptInSource,
): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();

  const record = store.records[normalized];
  if (!record) {
    // No previous opt-in - create new
    return await recordOptIn({
      phoneNumber: normalized,
      source: newSource || "direct_request",
      consentGiven: "User requested to receive messages",
    });
  }

  // Clear revoked flag and update timestamp
  delete record.revokedAt;
  record.optedInAt = Date.now();
  if (newSource) {
    record.source = newSource;
  }
  store.lastUpdated = Date.now();

  await saveOptInStore(store);

  log.info("Opt-in reactivated", { phoneNumber: normalized });

  return true;
}

/**
 * Get opt-in record for a phone number
 */
export async function getOptInRecord(
  phoneNumber: string,
): Promise<OptInRecord | null> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();
  return store.records[normalized] || null;
}

/**
 * Get all opted-in numbers (for admin/backup)
 */
export async function getAllOptedInNumbers(): Promise<string[]> {
  const store = await loadOptInStore();
  return Object.values(store.records)
    .filter((r) => !r.revokedAt)
    .map((r) => r.phoneNumber);
}

/**
 * Get opt-in statistics
 */
export async function getOptInStats(): Promise<{
  totalOptedIn: number;
  optedInThisWeek: number;
  optedInThisMonth: number;
  optedInThisYear: number;
  bySource: Record<OptInSource, number>;
}> {
  const store = await loadOptInStore();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

  const validRecords = Object.values(store.records).filter((r) => !r.revokedAt);

  const bySource: Record<string, number> = {};
  for (const record of validRecords) {
    bySource[record.source] = (bySource[record.source] || 0) + 1;
  }

  return {
    totalOptedIn: validRecords.length,
    optedInThisWeek: validRecords.filter((r) => r.optedInAt >= weekAgo).length,
    optedInThisMonth: validRecords.filter((r) => r.optedInAt >= monthAgo).length,
    optedInThisYear: validRecords.filter((r) => r.optedInAt >= yearAgo).length,
    bySource: bySource as Record<OptInSource, number>,
  };
}

/**
 * Check if user can be messaged (opted in and valid)
 */
export async function canMessageUser(phoneNumber: string): Promise<{
  allowed: boolean;
  reason?: "opted-in" | "not-opted-in" | "opt-in-expired" | "opt-in-revoked";
}> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const store = await loadOptInStore();
  const record = store.records[normalized];

  if (!record) {
    return { allowed: false, reason: "not-opted-in" };
  }

  if (record.revokedAt) {
    return { allowed: false, reason: "opt-in-revoked" };
  }

  const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
  if (Date.now() - record.optedInAt > TWO_YEARS) {
    return { allowed: false, reason: "opt-in-expired" };
  }

  return { allowed: true, reason: "opted-in" };
}

/**
 * Import opt-ins from a list (for migrating existing users)
 * Use with caution - only import users who have genuinely opted in
 */
export async function importOptIns(entries: {
  phoneNumber: string;
  source: OptInSource;
  consentDate: Date;
  consentGiven: string;
}[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    const normalized = normalizePhoneNumber(entry.phoneNumber);
    const store = await loadOptInStore();

    if (store.records[normalized]) {
      skipped++;
      continue;
    }

    store.records[normalized] = {
      phoneNumber: normalized,
      optedInAt: entry.consentDate.getTime(),
      source: entry.source,
      consentGiven: entry.consentGiven,
    };
    store.lastUpdated = Date.now();

    await saveOptInStore(store);
    imported++;
  }

  log.info("Opt-in import completed", { imported, skipped });

  return { imported, skipped };
}

/**
 * Export all opt-ins (for backup)
 */
export async function exportOptIns(): Promise<OptInRecord[]> {
  const store = await loadOptInStore();
  return Object.values(store.records);
}
