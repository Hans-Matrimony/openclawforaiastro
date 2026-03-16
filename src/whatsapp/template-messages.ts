/**
 * WhatsApp Business Cloud API: Template Messages
 * Required for sending messages OUTSIDE the 24-hour window
 *
 * Meta Policy:
 * - Within 24 hours: Free-form messages allowed ✅
 * - After 24 hours: Only pre-approved templates allowed ❌
 *
 * Templates must be pre-approved in WhatsApp Business Manager before use.
 * This module provides the interface for sending template messages.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("whatsapp/templates");

export interface WhatsAppTemplate {
  name: string; // Template name from WhatsApp Business Manager
  language: string; // e.g., "en", "hi_IN", "en_US"
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "footer" | "buttons";
  text?: string;
  parameters?: TemplateParameter[];
  buttons?: TemplateButton[];
}

export interface TemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: {
    amount: number;
    code: string; // ISO 4217 currency code (e.g., "INR", "USD")
    fallback_value?: string;
  };
  date_time?: {
    unix_epoch: number;
  };
  image?: {
    id: string; // Media ID from uploaded image
  };
  document?: {
    id: string; // Media ID from uploaded document
    filename?: string;
  };
  video?: {
    id: string; // Media ID from uploaded video
  };
}

export interface TemplateButton {
  type: "quick_reply" | "url";
  text?: string;
  url?: string;
  payload?: string; // For quick_reply buttons
}

export interface TemplateSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
}

/**
 * Configuration for WhatsApp Business Cloud API
 */
export interface WhatsAppBusinessConfig {
  accessToken: string; // From Meta Business Suite
  phoneNumberId: string; // From WhatsApp Business App
  apiVersion?: string; // Default: "v19.0"
}

/**
 * Send a template message (required for 24h+ inactive users)
 *
 * NOTE: Templates must be pre-approved in WhatsApp Business Manager
 * Submit templates at: https://business.facebook.com/wa/manage/message-templates/
 *
 * @param to - Phone number in E.164 format (e.g., "+919876543210")
 * @param template - Template object with name, language, and parameters
 * @param config - WhatsApp Business API configuration
 * @returns Send result with message ID or error
 */
export async function sendTemplateMessage(
  to: string,
  template: WhatsAppTemplate,
  config: WhatsAppBusinessConfig,
): Promise<TemplateSendResult> {
  const { accessToken, phoneNumberId, apiVersion = "v19.0" } = config;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Strip to digits only for the API
  const recipientPhone = to.replace(/\D/g, "");

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(template.components ? { components: template.components } : {}),
    },
  };

  log.debug("Sending template message", {
    to: recipientPhone,
    template: template.name,
    language: template.language,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      log.error("Template message failed", {
        to: recipientPhone,
        template: template.name,
        error: data.error?.message || response.statusText,
        errorCode: data.error?.code,
      });

      return {
        success: false,
        error: data.error?.message || response.statusText,
        errorCode: data.error?.code,
      };
    }

    const messageId = data.messages?.[0]?.id;

    log.info("Template message sent", {
      to: recipientPhone,
      template: template.name,
      messageId,
    });

    return {
      success: true,
      messageId,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("Template message request failed", {
      to: recipientPhone,
      template: template.name,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Common template definitions for astrology service
 *
 * IMPORTANT: These templates must be created and approved in
 * WhatsApp Business Manager before they can be used!
 *
 * Template submission guidelines:
 * - Must use specific categories (e.g., "account_update", "appointment_update")
 * - No promotional language
 * - Clear, concise messaging
 * - Include opt-out language for marketing messages
 */
export const ASTROLOGY_TEMPLATES = {
  /**
   * Template: Re-engagement for inactive users
   * Category: MARKETING (requires opt-in)
   *
   * English: "Namaste {{1}}! It's been a while since we last spoke.
   * Need any astrology guidance? Reply to restart the conversation."
   *
   * Hindi: "नमस्ते {{1}}! काफी समय हो गया है। कोई ज्योतिष मार्गदर्शन
   * चाहिए? बात शुरू करने के लिए जवाब दें।"
   */
  RE_ENGAGEMENT_EN: {
    name: "astrology_re_engagement_01",
    language: "en",
    getComponents: (userName: string) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: userName },
        ],
      },
    ],
  },

  /**
   * Template: Appointment reminder
   * Category: APPOINTMENT_UPDATE
   *
   * "Reminder: Your astrology consultation is on {{1}} at {{2}}.
   * Reply to confirm or reschedule."
   */
  APPOINTMENT_REMINDER_EN: {
    name: "astrology_appointment_reminder",
    language: "en",
    getComponents: (date: string, time: string) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: date },
          { type: "text", text: time },
        ],
      },
    ],
  },

  /**
   * Template: Follow-up update
   * Category: ACCOUNT_UPDATE
   *
   * "Update on your consultation about {{1}}: {{2}}.
   * Reply for more details."
   */
  FOLLOW_UP_UPDATE_EN: {
    name: "astrology_follow_up_01",
    language: "en",
    getComponents: (topic: string, update: string) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: topic },
          { type: "text", text: update },
        ],
      },
    ],
  },

  /**
   * Template: Simple check-in
   * Category: UTILITY
   *
   * "Hi {{1}}, just checking in. How are you doing?
   * Reply if you need any guidance."
   */
  CHECK_IN_EN: {
    name: "astrology_check_in",
    language: "en",
    getComponents: (userName: string) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: userName },
        ],
      },
    ],
  },
} as const;

/**
 * Helper function to send re-engagement template
 */
export async function sendReEngagementTemplate(
  to: string,
  userName: string,
  config: WhatsAppBusinessConfig,
): Promise<TemplateSendResult> {
  const template = ASTROLOGY_TEMPLATES.RE_ENGAGEMENT_EN;
  return sendTemplateMessage(
    to,
    {
      name: template.name,
      language: template.language,
      components: template.getComponents(userName),
    },
    config,
  );
}

/**
 * Helper function to send check-in template
 */
export async function sendCheckInTemplate(
  to: string,
  userName: string,
  config: WhatsAppBusinessConfig,
): Promise<TemplateSendResult> {
  const template = ASTROLOGY_TEMPLATES.CHECK_IN_EN;
  return sendTemplateMessage(
    to,
    {
      name: template.name,
      language: template.language,
      components: template.getComponents(userName),
    },
    config,
  );
}

/**
 * Validate template configuration before sending
 */
export function validateTemplateConfig(
  config: Partial<WhatsAppBusinessConfig>,
): { valid: boolean; error?: string } {
  if (!config.accessToken) {
    return { valid: false, error: "Missing access token" };
  }
  if (!config.phoneNumberId) {
    return { valid: false, error: "Missing phone number ID" };
  }
  return { valid: true };
}

/**
 * Get WhatsApp Business API configuration from environment variables
 *
 * Required env vars:
 * - WHATSAPP_ACCESS_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 */
export function getWhatsAppConfigFromEnv(): WhatsAppBusinessConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    log.warn("WhatsApp Business API credentials not found in environment");
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || "v19.0",
  };
}
