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
export function formatReadingReply(reply, hasReading) {
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
