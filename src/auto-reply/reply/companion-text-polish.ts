/**
 * Light post-processing for WhatsApp companion (Meera/Aarav) replies.
 * Prompts alone do not stop em-dashes or a few robotic phrases — normalize at send time.
 */

/** Em-dash, en-dash, and " word - word " punctuation (not hyphenated compounds like Ketu-Venus). */
export function stripCompanionDashPunctuation(text: string): string {
  let out = text.replace(/\s*[\u2014\u2013]\s*/g, ", ");
  out = out.replace(/([\p{L}\p{N}])\s+-\s+([\p{L}\p{N}])/gu, "$1, $2");
  out = out.replace(/,\s*,/g, ",");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

const BANNED_PHRASE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bjaisa\s+pehle\s+bataaya\s+tha\b/gi, replacement: "jaise chart mein dikhta hai" },
  { pattern: /\bjaise\s+pehle\s+bataaya\s+tha\b/gi, replacement: "jaise chart mein dikhta hai" },
  { pattern: /\bmaine\s+pehle\s+bataaya\b/gi, replacement: "" },
  { pattern: /\bmain\s+hoon\s+na\b/gi, replacement: "main yahin hoon" },
  { pattern: /\bphir\s+wahi\s+sawaal\b/gi, replacement: "shaadi ka sawaal" },
  { pattern: /\bwapas\s+aa\s+gaye\b/gi, replacement: "phir message kiya" },
];

export function softenBannedCompanionPhrases(text: string): string {
  let out = text;
  for (const { pattern, replacement } of BANNED_PHRASE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/^\s*,\s*/gm, "");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

export function polishCompanionReplyText(text: string): string {
  if (!text?.trim()) {
    return text;
  }
  return softenBannedCompanionPhrases(stripCompanionDashPunctuation(text));
}
