import type { SessionEntry } from "../../config/sessions.js";

export type UserReplyLanguageId =
  | "english"
  | "hinglish"
  | "hindi"
  | "telugu"
  | "tamil"
  | "kannada"
  | "malayalam"
  | "bengali"
  | "marathi"
  | "gujarati"
  | "punjabi"
  | "arabic"
  | "mirror";

export const COMPANION_LANGUAGE_LOCK_AGENT_IDS = new Set(["astrologer"]);

const SCRIPT_RANGES: Array<{ id: UserReplyLanguageId; start: number; end: number }> = [
  { id: "telugu", start: 0x0c00, end: 0x0c7f },
  { id: "tamil", start: 0x0b80, end: 0x0bff },
  { id: "kannada", start: 0x0c80, end: 0x0cff },
  { id: "malayalam", start: 0x0d00, end: 0x0d7f },
  { id: "bengali", start: 0x0980, end: 0x09ff },
  { id: "gujarati", start: 0x0a80, end: 0x0aff },
  { id: "punjabi", start: 0x0a00, end: 0x0a7f },
  { id: "hindi", start: 0x0900, end: 0x097f },
  { id: "arabic", start: 0x0600, end: 0x06ff },
];

const LANGUAGE_LABELS: Record<UserReplyLanguageId, string> = {
  english: "English",
  hinglish: "Hinglish",
  hindi: "Hindi",
  telugu: "Telugu",
  tamil: "Tamil",
  kannada: "Kannada",
  malayalam: "Malayalam",
  bengali: "Bengali",
  marathi: "Marathi",
  gujarati: "Gujarati",
  punjabi: "Punjabi",
  arabic: "Arabic",
  mirror: "the exact same language as the user's last message",
};

/** Roman Hindi words only — do NOT include "me" (matches English "tell me"). */
const HINGLISH_WORD =
  /\b(aap|aapka|aapki|aapke|hai|hain|hoon|hun|mera|meri|mere|kya|kaise|kaisa|kaisi|kab|kyun|kyu|nahi|nahin|acha|achha|accha|theek|thik|batao|bata|bataiye|shaadi|shadi|kaam|padhai|mann|dil|raat|din|abhi|pehle|baad|dost|kuch|bhi|jaldi|namaste|pranam|hoga|hogi|honge|raha|rahi|rahe|lagta|lagti|mein|mai|yaad|soch|sochte|sochti|tumhe|tujhe|arre|waise|bohot|bahut|zyada|zyaada)\b/giu;

const ENGLISH_PHRASE =
  /\b(tell me|can you|could you|can u|how are you|hey|hello|hi there|when will|what is|about my|something about|i want to|please tell)\b/iu;

const EXPLICIT_LANGUAGE_LOCKS: Array<{ pattern: RegExp; id: UserReplyLanguageId }> = [
  {
    pattern:
      /\b(?:speak|talk|write|reply|chat|message|communicate).{0,24}\benglish\b|\benglish\s+only\b|\bonly\s+english\b|\b(?:in|use)\s+english\b|\bstick\s+to\s+english\b|\balways\s+(?:speak\s+)?english\b|\bevery\s*time\b.{0,20}\benglish\b|\beverytime\b.{0,30}\benglish\b|\bwhy\b.{0,40}\b(?:hinglish|hindi)\b|\b(?:don'?t|do\s+not|stop)\b.{0,24}\b(?:speak|talk|use|write)\b.{0,24}\b(?:hinglish|hindi)\b/iu,
    id: "english",
  },
  {
    pattern:
      /\b(?:speak|talk|write|reply|chat).{0,24}\bhinglish\b|\bhinglish\s+(?:mein|main|me)\b/iu,
    id: "hinglish",
  },
  {
    pattern:
      /\b(?:speak|talk|write|reply|chat).{0,24}\bhindi\b|\bhindi\s+(?:mein|main|me)\b|\bab\s+hindi\b/iu,
    id: "hindi",
  },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\btelugu\b|\btelugu\s+lo\b/iu, id: "telugu" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\btamil\b|\btamil\s+la\b/iu, id: "tamil" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bkannada\b/iu, id: "kannada" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bmalayalam\b/iu, id: "malayalam" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bbengali\b|\bbangla\b/iu, id: "bengali" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bmarathi\b/iu, id: "marathi" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bgujarati\b/iu, id: "gujarati" },
  { pattern: /\b(?:speak|talk|write|reply).{0,24}\bpunjabi\b/iu, id: "punjabi" },
];

function countScriptChars(text: string, start: number, end: number): number {
  let count = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= start && code <= end) {
      count += 1;
    }
  }
  return count;
}

function detectDominantScriptLanguage(text: string): UserReplyLanguageId | null {
  let best: { id: UserReplyLanguageId; count: number } | null = null;
  for (const range of SCRIPT_RANGES) {
    const count = countScriptChars(text, range.start, range.end);
    if (count === 0) {
      continue;
    }
    if (!best || count > best.count) {
      best = { id: range.id, count };
    }
  }
  return best?.id ?? null;
}

export function detectExplicitLanguagePreference(text: string): UserReplyLanguageId | null {
  const sample = text.trim();
  if (!sample) {
    return null;
  }
  for (const { pattern, id } of EXPLICIT_LANGUAGE_LOCKS) {
    if (pattern.test(sample)) {
      return id;
    }
  }
  return null;
}

export function detectMessageLanguage(text: string): UserReplyLanguageId | "neutral" {
  const sample = text.trim();
  if (!sample) {
    return "neutral";
  }

  const scriptLanguage = detectDominantScriptLanguage(sample);
  if (scriptLanguage) {
    if (scriptLanguage === "hindi") {
      const hasLatin = /[a-zA-Z]/.test(sample);
      const hinglishHits = new Set((sample.match(HINGLISH_WORD) ?? []).map((w) => w.toLowerCase()))
        .size;
      if (hasLatin && hinglishHits > 0) {
        return "hinglish";
      }
      return "hindi";
    }
    return scriptLanguage;
  }

  const tokens = sample.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return "neutral";
  }

  if (ENGLISH_PHRASE.test(sample)) {
    const hinglishHits = new Set((sample.match(HINGLISH_WORD) ?? []).map((w) => w.toLowerCase()))
      .size;
    if (hinglishHits === 0) {
      return "english";
    }
  }

  const hinglishMatches = sample.match(HINGLISH_WORD) ?? [];
  const hinglishHits = new Set(hinglishMatches.map((w) => w.toLowerCase())).size;
  if (hinglishHits >= 2 || (hinglishHits > 0 && hinglishHits / tokens.length >= 0.2)) {
    return "hinglish";
  }

  const latinWordCount = tokens.filter((token) => /^[a-zA-Z][a-zA-Z'’-]*$/.test(token)).length;
  if (latinWordCount / tokens.length >= 0.7 && hinglishHits === 0) {
    return "english";
  }

  if (tokens.length >= 2) {
    return "mirror";
  }

  return "neutral";
}

export function buildLanguageLockHint(languageId: UserReplyLanguageId): string {
  const label = LANGUAGE_LABELS[languageId];
  const lines = [
    `[CRITICAL LANGUAGE LOCK: ${label.toUpperCase()}]`,
    `The user's last message is in ${label}. Your FULL reply must be 100% ${label} — every bubble, every sentence, including the final follow-up question.`,
    "Do NOT mix languages in one reply (forbidden: English body + Hindi/Telugu question, or half-English half-Hinglish).",
  ];
  if (languageId === "english") {
    lines.push(
      'Forbidden in this reply unless quoting the user: aap, hai, hain, ke, ki, mein, achha, chart Hindi labels, "kaise ho".',
    );
  }
  if (languageId === "hinglish") {
    lines.push("Use natural Hinglish throughout — do not switch to English mid-reply.");
  }
  if (languageId !== "english" && languageId !== "hinglish" && languageId !== "mirror") {
    lines.push(`Write entirely in ${label} script/words — no English or Hindi unless the user mixed them.`);
  }
  lines.push("Stay in this language until the user clearly switches or asks to change.");
  return lines.join(" ");
}

export function isUserReplyLanguageId(value: string | undefined): value is UserReplyLanguageId {
  return Boolean(value && value in LANGUAGE_LABELS);
}

function isShortNeutralMessage(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length <= 2;
}

function hasStrongLanguageSignal(text: string, detected: UserReplyLanguageId | "neutral"): boolean {
  if (detected === "neutral") {
    return false;
  }
  if (detectDominantScriptLanguage(text)) {
    return true;
  }
  if (ENGLISH_PHRASE.test(text)) {
    return true;
  }
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length >= 3;
}

export type ResolvedCompanionLanguage = {
  mode: UserReplyLanguageId;
  hint: string;
  updatedMode: boolean;
};

export function resolveCompanionLanguageMode(params: {
  messageText: string;
  sessionEntry?: SessionEntry;
}): ResolvedCompanionLanguage {
  const explicit = detectExplicitLanguagePreference(params.messageText);
  const detected = detectMessageLanguage(params.messageText);
  const stored = params.sessionEntry?.companionLanguageMode;
  const previous = isUserReplyLanguageId(stored) ? stored : undefined;

  let mode: UserReplyLanguageId = previous ?? (detected === "neutral" ? "mirror" : detected);

  if (explicit) {
    mode = explicit;
  } else if (detected !== "neutral") {
    if (previous && isShortNeutralMessage(params.messageText) && !hasStrongLanguageSignal(params.messageText, detected)) {
      mode = previous;
    } else {
      mode = detected;
    }
  }

  return {
    mode,
    hint: buildLanguageLockHint(mode),
    updatedMode: previous !== mode,
  };
}
