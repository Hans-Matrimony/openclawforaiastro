/**
 * Light post-processing for WhatsApp companion (Meera/Aarav) replies.
 * Prompts alone do not stop em-dashes or a few robotic phrases — normalize at send time.
 */

import { parseFenceSpans } from "../../markdown/fences.js";

function transformProse(text: string, transform: (prose: string) => string): string {
  let cursor = 0;
  let result = "";
  for (const span of parseFenceSpans(text)) {
    result += transform(text.slice(cursor, span.start)) + text.slice(span.start, span.end);
    cursor = span.end;
  }
  return result + transform(text.slice(cursor));
}

/** Em-dash, en-dash, and " word - word " punctuation (not hyphenated compounds like Ketu-Venus). */
export function stripCompanionDashPunctuation(text: string): string {
  const out = transformProse(text, (prose) =>
    prose
      .replace(/[\t ]*[\u2014\u2013][\t ]*/g, ", ")
      .replace(/([\p{L}\p{N}])[\t ]+-[\t ]+([\p{L}\p{N}])/gu, "$1, $2")
      .replace(/,[\t ]*,/g, ",")
      // Preserve paragraph breaks, list indentation, and Markdown hard breaks.
      .replace(/(\S)[\t ]{2,}(?=\S)/g, "$1 "),
  );
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
  const out = transformProse(text, (prose) => {
    let softened = prose;
    for (const { pattern, replacement } of BANNED_PHRASE_REPLACEMENTS) {
      softened = softened.replace(pattern, replacement);
    }
    return softened.replace(/^[\t ]*,[\t ]*/gm, "").replace(/(\S)[\t ]{2,}(?=\S)/g, "$1 ");
  });
  return out.trim();
}

export function polishCompanionReplyText(text: string): string {
  if (!text?.trim()) {
    return text;
  }
  return softenBannedCompanionPhrases(stripCompanionDashPunctuation(text));
}
