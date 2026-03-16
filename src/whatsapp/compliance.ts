/**
 * WhatsApp Business API Compliance Module
 *
 * This module exports all compliance-related functionality for WhatsApp
 * Business Cloud API usage. Use these checks before EVERY outbound message
 * to prevent account suspension/banning.
 *
 * Usage:
 * ```typescript
 * import { checkReplyCompliance, checkProactiveCompliance } from "./whatsapp/compliance.js";
 *
 * // For replies to user messages (relaxed checks)
 * const replyCheck = await checkReplyCompliance("+919876543210");
 * if (!replyCheck.allowed) {
 *   console.log("Cannot send:", replyCheck.reason);
 *   return;
 * }
 *
 * // For proactive messages/heartbeats (strict checks)
 * const proactiveCheck = await checkProactiveCompliance("+919876543210");
 * if (!proactiveCheck.allowed) {
 *   console.log("Cannot send:", proactiveCheck.reason);
 *   return;
 * }
 * ```
 */

// 24-hour window check
export {
  check24HourWindow,
  requiresTemplate,
  getWindowStatusMessage,
  logWindowViolation,
  formatTimeRemaining,
  type WindowCheckResult,
} from "./24-hour-check.js";

// Opt-out handling
export {
  hasOptedOut,
  isOptOutMessage,
  isOptInMessage,
  handleOptOut,
  handleOptIn,
  getOptedOutNumbers,
  getOptOutStats,
  clearOptOut,
  loadOptOutStore,
  type OptOutStore,
} from "./opt-out-handler.js";

// Opt-in tracking
export {
  hasOptedIn,
  isOptInValid,
  recordOptIn,
  revokeOptIn,
  reactivateOptIn,
  getOptInRecord,
  getAllOptedInNumbers,
  getOptInStats,
  canMessageUser,
  importOptIns,
  exportOptIns,
  type OptInRecord,
  type OptInSource,
  type OptInStore,
} from "./opt-in-tracker.js";

// Template messages
export {
  sendTemplateMessage,
  sendReEngagementTemplate,
  sendCheckInTemplate,
  validateTemplateConfig,
  getWhatsAppConfigFromEnv,
  ASTROLOGY_TEMPLATES,
  type WhatsAppTemplate,
  type TemplateComponent,
  type TemplateParameter,
  type TemplateButton,
  type TemplateSendResult,
  type WhatsAppBusinessConfig,
} from "./template-messages.js";

// Comprehensive compliance checker
export {
  checkCompliance,
  checkReplyCompliance,
  checkProactiveCompliance,
  checkRequiresTemplate,
  handleOptKeywords,
  getComplianceReport,
  logComplianceFailure,
  type ComplianceCheckResult,
  type ComplianceCheckOptions,
} from "./compliance-checker.js";
