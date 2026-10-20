// Runtime-only deduplication: retain the captured source assets for comparison.
// Keep routing, birth resolution, tool evidence and output contracts intact.
export function compactPrompt(source) {
  return source
    .replace(
      /# Completed Reading Output Contract[^]*?(?=# Language \(highest priority\))/,
      "# Completed Reading Output Contract\n\n" +
        "After a successful reading, return exactly two paragraphs: a useful explanation, then one short direct verdict. " +
        "Explain the 2-3 strongest relevant factors in 2-4 natural sentences. Address the actual question and acknowledge relevant user context; avoid a placement inventory. " +
        "The verdict must match the evidence and answer the current intent. A mixed indication stays mixed; missing timing evidence is not a negative verdict. " +
        "Only give an event window when the tool explicitly calculated an event window for this topic. Current period boundaries, natal placements and transits alone are not event windows. " +
        "If no event window was calculated, describe the relevant present indications and briefly say the exact timing is not established. Never invent a year, countdown, age threshold, next period or definite yes/no. " +
        "For an overview question, give an overview verdict rather than an unnecessary timing limitation. No labels, repeated disclaimers, fixed-year examples or service menus. " +
        "Keep the second paragraph to one short sentence. A separate companion stage owns the friendly third paragraph when enabled.\n\n",
    )
    .replace(/# Examples of correct behavior[^]*?(?=# Sensitive Questions Policy)/, "")
    .replace(
      /# Voice[^]*?(?=# Persistent Memory)/,
      "# Voice\nUse concise, warm conversational language. Routine clarification/errors: 1-2 sentences. Follow the Completed Reading Output Contract for readings. No filler, report headings, service menus, repeated verdicts or unsolicited advice.\n\n",
    )
    .replace(
      /# Language \(highest priority\)[^]*?(?=# Sensitive Questions Policy)/,
      "# Language (highest priority)\nAn explicit current response-language/script request wins; otherwise use the app language preference. Preserve mixed language and romanized script. Bare numbers, dates, places, codes and other language-neutral replies inherit the established language. Only user-authored text establishes language, never tools, profile names or assistant messages. A temporary language request applies only to that turn.\n\n",
    );
}

export function uniqueMemory(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (typeof row !== "string" || !row.trim()) {
      return false;
    }
    // Exact whitespace-equivalent duplicates only: keep corrections and different subjects.
    const key = row.trim().replace(/\s+/g, " ");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
