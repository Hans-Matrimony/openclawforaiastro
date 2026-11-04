// Bind only unambiguous self questions. Corrections, other people and ambiguous
// continuations retain the existing conversational birth-detail workflow.
export function selectedSelfBirth(query, birth) {
  const ready = [birth?.date, birth?.time, birth?.location_name || birth?.place]
    .every((field) => typeof field === "string" && field.trim() && field.trim().toLowerCase() !== "unknown");
  if (!ready || typeof query !== "string") return null;
  // In a self-chart clarification, "7ve ghar ... uski strength" refers to
  // that house, not a second person's birth profile. Keep all other-person
  // and explicit birth-correction exclusions below intact.
  const text = query.toLowerCase().replace(/\bmy\s+(?:saved|existing|stored)\s+birth\s+details\b/gu, 'my chart').replace(
    /(\b(?:house\s+\d{1,2}|\d{1,2}(?:ve|ven|va|wa|we|th|st|nd|rd)?\s+(?:ghar|house))\b[^.!?\n]{0,80}?)\buski\s+(strength|majbooti|mazbooti)\b/gu,
    '$1is ghar ki $2',
  );
  if (/\b(?:correct|change|update|save|select|switch|replace)\b/iu.test(text)) return null;
  if (/\b(?:friend|girlfriend|boyfriend|gf|bf|wife|husband|partner|spouse|sister|brother|mother|father|daughter|son|dost|behen|bhai|mummy|papa|uski|uska|unki|unka|his|her|their)\b|(?:उसकी|उसका|उनकी|उनका|दोस्त|पत्नी|पति|बहन|भाई|माँ|पिता|बेटी|बेटा)/u.test(text) ||
      /\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b\d{1,2}:\d{2}\b|\b\d{4}\b|\b\d{1,2}\s*(?:am|pm)\b|\b(?:born|dob|tob|birthplace|janam|janm|correction|corrected|actually|instead|galat)\b|\bbirth\s+(?:date|time|place|details)\b|\b(?:birth|date|time|place)\s+(?:is|was|actually|galat|sahi|of birth)\b|\b[a-z]+['’]s\b|\b(?:for|about)\s+[a-z]+|जन्म|सुधार/u.test(text)) return null;
  const own = /\b(?:meri|mera|mere|my)\s+(?:sha+di|marriage|wedding|career|job|naukri|promotion|education|studies|study|exam|exams|padhai|finances?|money|income|salary|kundli|horoscope|chart|birth chart)\b|\b(?:when|will|can)\s+(?:will\s+)?i\s+(?:marry|get married|get a job)\b|(?:मेरी|मेरा|मेरे)\s*(?:शादी|विवाह|नौकरी|करियर|कुंडली|पढ़ाई)/u.test(text);
  return own ? { ...birth } : null;
}

export function selectedSelfArguments(name, args, birth) {
  if (!birth) return args;
  if (name === "get_horoscope_predictions" || name === "get_current_transits") {
    return { ...args, birth_date: birth.date, birth_time: birth.time,
      location_name: birth.location_name || birth.place };
  }
  // Horary uses the question's current time, not a natal date. Match reports
  // retain both explicit people. Neither may borrow another person's values.
  return args;
}
