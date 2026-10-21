import { isCompanionParagraph } from "./friendly-closing.mjs";

export const MAX_BUBBLE_WORDS = 90;

export function limitBubbleWords(reply) {
  if (reply.includes("```") || /(?:^|\n)\s*\|[^\n]+\|/.test(reply)) {
    return reply;
  }
  try {
    JSON.parse(reply);
    return reply;
  } catch {
    // Raw structured responses must remain valid; ordinary prose follows.
  }
  return reply
    .split(/(\r?\n\s*\r?\n)/u)
    .map((bubble, index) => {
      if (index % 2) {
        return bubble;
      }
      const words = [...bubble.matchAll(/\S+/gu)];
      if (words.length <= MAX_BUBBLE_WORDS) {
        return bubble;
      }
      const boundary = words[MAX_BUBBLE_WORDS].index;
      let sentenceEnd = 0;
      for (const sentence of bubble.matchAll(/[.!?\u0964\u0965]["'”’»)]*(?=\s|$)/gu)) {
        const end = sentence.index + sentence[0].length;
        if (end > boundary) {
          break;
        }
        sentenceEnd = end;
      }
      // Keep complete sentences where possible, never cut a word or move the
      // verdict/follow-up into another bubble. Mark an overlong single sentence.
      return sentenceEnd
        ? bubble.slice(0, sentenceEnd)
        : bubble
            .slice(0, boundary)
            .trimEnd()
            .replace(/[,;:]$/u, "") + "…";
    })
    .join("");
}

export function formatDisplayReply(reply) {
  // The final count includes words introduced by display cleanup, such as "to"
  // replacing a date-range dash. Cached completions use this same boundary.
  return limitBubbleWords(removeReplyDashes(removeDisplayTerms(reply)));
}

export function removeReplyDashes(reply) {
  try {
    JSON.parse(reply);
    return reply;
  } catch {
    // Keep structured output, dates, negative values, links and code intact.
  }
  return reply
    .split(
      /(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+|\b(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\b|(?<![\p{L}\p{N}])-\d+(?:\.\d+)?)/gu,
    )
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(/[ \t]*\p{Pd}+[ \t]*/gu, (dash, offset) =>
            /\d[ \t]*$/u.test(part.slice(0, offset)) &&
            /^[ \t]*\d/u.test(part.slice(offset + dash.length))
              ? " to "
              : " ",
          ),
    )
    .join("");
}

// Display-only cleanup, after generation and follow-up assembly. Keep chart
// evidence, prompts, numbers, dates, and paragraph boundaries unchanged.
export function removeDisplayTerms(reply) {
  return reply.replace(
    /([ \t]*)\b(?:retrograde|bindus|combust)\b([ \t]*)/gi,
    (_match, before, after) => (before && after ? " " : ""),
  );
}

// Bindu totals (ashtakavarga point counts like 31/48) are internal judgment
// signals; a user reply states the meaning (strong/weak) instead of numbers.
export function sanitizeBindus(reply) {
  if (typeof reply !== "string") {
    return reply;
  }
  const parts = reply.split("/");
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const numMatch = out.match(/([0-9]{1,2}) *$/);
    const denMatch = parts[i].match(/^ *48([^0-9]|$)/);
    if (numMatch && denMatch) {
      out = out.slice(0, out.length - numMatch[0].length);
      out += Number(numMatch[1]) >= 25 ? "strong" : "kamzor";
      out += parts[i].slice(denMatch[0].length - (denMatch[1] === "" ? 0 : 1));
    } else {
      out += "/" + parts[i];
    }
  }
  return out;
}

// Preserve model wording; repair whitespace boundaries only for completed chart readings.
export function formatReadingReply(
  reply,
  hasReading,
  { friendlyClosing = false, separateCompanion = false } = {},
) {
  if (!hasReading) {
    return reply;
  }
  if (reply.includes("```") || /(?:^|\n)\s*\|[^\n]+\|/.test(reply)) {
    return reply;
  }
  try {
    JSON.parse(reply);
    return reply; // Explicitly requested raw structured output must stay parseable.
  } catch {
    // Normal prose follows the reading bubble contract below.
  }
  const paragraphs = reply.trim().split(/\r?\n\s*\r?\n/);
  if (separateCompanion && paragraphs.length === 3 && isCompanionParagraph(paragraphs[2])) {
    return reply; // Preserve both reading bubbles; the companion stage owns the third.
  }
  if (
    friendlyClosing &&
    paragraphs.length === 3 &&
    paragraphs[2].trim().endsWith("?") &&
    paragraphs[2].length <= 240
  ) {
    return paragraphs.join("\n\n");
  }
  if (paragraphs.length === 2) {
    return reply;
  }
  if (paragraphs.length > 2) {
    return paragraphs.slice(0, -1).join(" ") + "\n\n" + paragraphs.at(-1);
  }
  const lines = reply
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length > 1) {
    return (
      lines
        .slice(0, -1)
        .map((line) => line.trim())
        .join(" ") +
      "\n\n" +
      lines.at(-1).trim()
    );
  }
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(reply)];
  if (sentences.length < 2) {
    return reply; // Never split a sentence or manufacture a second part.
  }
  return (
    sentences
      .slice(0, -1)
      .map((part) => part.segment)
      .join("")
      .trimEnd() +
    "\n\n" +
    sentences.at(-1).segment.trimStart()
  );
}
