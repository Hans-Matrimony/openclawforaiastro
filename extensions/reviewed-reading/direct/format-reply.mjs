import { isCompanionParagraph } from "./friendly-closing.mjs";

export function formatDisplayReply(reply) {
  // Display-only cleanup; preserve the full response and all bubble boundaries.
  return removeReplyDashes(removeDisplayTerms(reply));
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
  return (
    removeOrphanedHouseScore(reply)
      .replace(
        /\bashtakavarga\s+(?:score\s+|count\s+)?(?:sirf\s+)?\d{1,3}(?:\/48)?\s+hai,?\s+jo\s+(bahut\s+kam|kamzor|strong|weak)\s+hai/gi,
        "$1 sahyog hai",
      )
      .replace(/\bashtakavarga\s+strong\b/gi, "sahyog strong")
      // Remove only an unlabeled house-score fragment, retaining the house and meaning.
      .replace(
        /\b(house\s+\d{1,2}|\d{1,2}(?:st|nd|rd|th)\s+house)\s+ka\s+(?:sirf\s+)?\d{1,3}\s+(?:bindus?\s+)?(?:hai\s+)?(?=(?:bahut\s+)?(?:weak|strong|kamzor)\b)/gi,
        "$1 ",
      )
      .replace(/([ \t]*)\b(?:retrograde|bindus?|combust)\b([ \t]*)/gi, (_match, before, after) =>
        before && after ? " " : "",
      )
  );
}

function removeOrphanedHouseScore(reply) {
  try {
    JSON.parse(reply);
    return reply;
  } catch {
    // Apply this presentation rule only to prose, never code or structured data.
  }
  return reply
    .split(/(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+)/gu)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(
              /\b((?:[1-9]|1[0-2])(?:ve|ven|wan|st|nd|rd|th)\s+(?:ghar|house))\s+ki\s+bindus?\s+sirf\s+(?:[0-9]|[1-3][0-9]|4[0-8])\s+hain?\s*[,\u2013\u2014-]*\s*(bahut\s+kam|kamzor|weak|strong)\b/gi,
              "$1 mein sahyog $2 hai",
            )
            .replace(
              /[ \t]*\(\s*bindus?\s+(?:sirf\s+)?(?:[0-9]|[1-3][0-9]|4[0-8])(?:\/48)?\s*\)/gi,
              "",
            )
            .replace(
              /\b((?:[1-9]|1[0-2])(?:ve|ven|wan|st|nd|rd|th)\s+(?:ghar|house)\b[^.!?\n]{0,180}?\b(?:lekin|aur)\s+)sirf\s+(?:[0-9]|[1-3][0-9]|4[0-8])\s+(?:bindus?\s+)?hai[n]?[ ,]*(weak|strong|kamzor)\s+hai\b/gi,
              "$1sahyog $2 hai",
            )
            .replace(
              /\b((?:[1-9]|1[0-2])(?:ve|ven|wan|st|nd|rd|th)\s+(?:ghar|house)|house\s+(?:[1-9]|1[0-2]))\s+ka\s+sirf\s+(?:[0-9]|[1-3][0-9]|4[0-8])\s+(?:bindus?\s+)?hai[ \t]+(?=(?:Saturn|Jupiter|Venus|Mars|Mercury|Moon|Sun|Rahu|Ketu|Shani|Guru|Shukra|Mangal|Budh|Chandra|Surya)\b)/gi,
              // Keep the house as a label, without inferring a new strong/weak verdict.
              "$1: ",
            ),
    )
    .join("");
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
    if (separateCompanion && /[?？]\s*$/.test(paragraphs[1])) {
      // Occasionally the reading writer puts its own question in slot two.
      // Split existing explanation sentences only; never invent a verdict.
      const reading = formatReadingReply(paragraphs[0], true);
      if (/\n\s*\n/.test(reading)) {
        return reading + "\n\n" + paragraphs[1];
      }
    }
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
