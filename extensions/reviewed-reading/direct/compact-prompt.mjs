// Runtime-only deduplication: retain the captured source assets for comparison.
// Keep routing, birth resolution, tool evidence and output contracts intact.
export function compactPrompt(source) {
  return source
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
