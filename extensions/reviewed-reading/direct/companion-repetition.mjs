// Compare question intent, not just exact wording. Only companion questions are
// examined; chart paragraphs and user disclosures are never rewritten.
export function companionQuestionIntent(text) {
  if (!/[?？]/u.test(text ?? "")) {
    return null;
  }
  const question = text.split(/\n\s*\n/).at(-1);
  if (
    /\b(?:apni (?:baat|feelings)|dil ki baat|your feelings)\b|अपनी (?:बात|फीलिंग)|दिल की बात/iu.test(
      question,
    ) &&
    /\b(?:share|keh|kah|kahi|kehi|bol|boli|told|tell|express)\w*\b|बताई|कही|कह दी|शेयर/iu.test(
      question,
    )
  ) {
    return "feelings_disclosed";
  }
  if (
    /\b(?:expense|expenses|kharch\w*)\b|खर्च/iu.test(question) &&
    /\b(?:track\w*|likh\w*|written|record\w*)\b|लिख|हिसाब/iu.test(question)
  ) {
    return "expenses_recorded";
  }
  return null;
}

export function recentCompanionIntents(history = []) {
  return [
    ...new Set(
      history
        .filter((turn) => turn.role === "assistant")
        .slice(-6)
        .map((turn) => companionQuestionIntent(turn.text))
        .filter(Boolean),
    ),
  ];
}

export function repeatsCompanionIntent(text, history = []) {
  const intent = companionQuestionIntent(text);
  return Boolean(intent && recentCompanionIntents(history).includes(intent));
}
