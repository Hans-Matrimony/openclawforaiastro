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

const DEATH_WORDS = "death|die|dies|dying|maut|mrityu|marne|lifespan";

// A reply asserts a death date when a calendar year sits next to death or
// lifespan wording, or when a lifespan in years is predicted. Health and
// longevity guidance without those assertions passes through untouched.
function assertsDeathDate(reply) {
  if (typeof reply !== "string") {
    return false;
  }
  const nearYear = new RegExp(
    "(?:(?:" +
      DEATH_WORDS +
      "|umr)[^.!?]{0,80}?\\b(?:19|20)[0-9]{2}\\b)|\\b(?:19|20)[0-9]{2}\\b[^.!?]{0,80}?(?:" +
      DEATH_WORDS +
      ")",
    "i",
  );
  const lifespanAge =
    /\b[0-9]{1,3}\s*(?:saal|sal|years?|varsh)\b[^.!?]{0,40}?(?:jeeyenge|jiyenge| live\b|umr\b|lifespan\b)/i;
  return nearYear.test(reply) || lifespanAge.test(reply);
}

export function deathTimingReply(query, reply, language) {
  if (!isDeathTimingQuestion(query)) {
    return reply;
  }
  // The model's health-and-longevity reading passes through untouched; only a
  // reply that actually asserts a death date or lifespan gets the boundary.
  if (!assertsDeathDate(reply)) {
    return reply;
  }
  if (language === "hinglish") {
    return "Kundli se aapki death kab hogi ya aap kitni umr tak jeeyenge, iska bharosemand jawab nahi milta.";
  }
  if (language === "hindi") {
    return "कुंडली से आपकी मृत्यु की तारीख या आयु का भरोसेमंद अनुमान नहीं लगाया जा सकता।";
  }
  return "A birth chart cannot reliably establish when you will die or how long you will live.";
}
