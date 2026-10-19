export function isDeathTimingQuestion(query) {
  const text = query
    .toLowerCase()
    .trim()
    .replace(/[?.!]+$/, "")
    .trim();
  return /^(?:(?:meri|mera) (?:death|maut|mrityu) (?:kab|kb)(?: tak)? (?:hogi|hoga)|when (?:will|do) i die|when will my death (?:happen|occur)|how long will i live|what (?:is|will be) my lifespan|at what age will i die)$/.test(
    text,
  );
}

export function deathTimingReply(query, reply, language) {
  if (!isDeathTimingQuestion(query)) {
    return reply;
  }
  // A death-date answer must not grow into an unsupported personal health assessment.
  const first = [
    ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(reply),
  ][0]?.segment.trim();
  if (
    first &&
    (language !== "hinglish" || /\b(?:nahi|nahin|bata|kundli|aapki)\b/i.test(first)) &&
    !/\d|health|healthy|risk|disease|illness|safe|khatra/i.test(first) &&
    /(?:astrology|kundli|chart).{0,80}(?:nahi bata|nahin bata|cannot (?:reliably )?(?:predict|establish|determine)|can't (?:predict|establish|determine)|does(?:n't| not) predict)/i.test(
      first,
    ) &&
    /death|lifespan|maut|mrityu|marne/i.test(first)
  ) {
    return first;
  }
  if (language === "hinglish") {
    return "Kundli se aapki death kab hogi ya aap kitni umr tak jeeyenge, iska bharosemand jawab nahi milta.";
  }
  if (language === "hindi") {
    return "कुंडली से आपकी मृत्यु की तारीख या आयु का भरोसेमंद अनुमान नहीं लगाया जा सकता।";
  }
  return "A birth chart cannot reliably establish when you will die or how long you will live.";
}
