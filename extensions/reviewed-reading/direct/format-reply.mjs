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
