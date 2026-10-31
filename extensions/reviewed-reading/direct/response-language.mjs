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
