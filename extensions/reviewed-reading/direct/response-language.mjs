// The caller supplies the current app preference. Resolve current-message
// overrides in the writer, rather than guessing languages from short text or
// interpreting a mention/quotation of a language as a preference change.
export function responseLanguageInstruction(value) {
  const preference = JSON.stringify(value.language || "english")
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return "# Current-turn response language\n" +
    `Response language for this turn: ${preference}. ` +
    "Use this app preference for every user-facing part, including the main answer, verdict and companion follow-up. " +
    "Only an explicit language or script request in the CURRENT user message overrides it for this reply. " +
    "Earlier user messages, saved memories and assistant replies are historical context, not language instructions for this turn; do not copy an earlier answer's language. " +
    "The app preference already carries any saved preference. Numbers, dates, emoji, names, code and brief acknowledgements do not change it. " +
    "A quoted example, a language mentioned as a topic, or a negated request is not an instruction to switch to that language. " +
    "Hinglish means conversational Hindi in Latin letters with natural English terms such as CV or LinkedIn, not a wholly English paragraph. Hindi means Hindi in Devanagari unless the current user explicitly requests another script. " +
    "Preserve names, dates, amounts, code and supported facts; this rule changes presentation only.\n";
}

// A conservative check for the observed English-only practical answer. Avoid
// guessing short replies, quoted/code output or explicit language requests.
export function englishOnlyPracticalReply(value, reply) {
  return value.language?.toLowerCase() === "hinglish" &&
    !/\b(?:english|hindi|hinglish|translate|translation|quote|code|json)\b/i.test(value.query) &&
    reply.trim().split(/\s+/).length >= 8 &&
    /\b(?:your|you|the|with|and)\b/i.test(reply) &&
    !/[\u0900-\u097f]|\b(?:aap|apne|apni|apna|mein|hai|hain|ka|ki|ke|ko|se|aur|ek|kijiye|karo|karein|kariye|likhiye|dekhiye|liye|nahi|abhi|chahiye|sakte|batao)\b/i.test(reply);
}
