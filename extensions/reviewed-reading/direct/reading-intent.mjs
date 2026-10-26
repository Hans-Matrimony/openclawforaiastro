export const CHART_TOOL_NAMES = new Set([
  "get_horoscope_predictions",
  "get_current_transits",
  "get_match_report",
  "get_horary_prediction",
]);

export const bareToolName = (name) => name.replace(/^mcp__VedAstro__/, "");

// Use the same timing intent for tool selection and fallback presentation.
export function asksForTiming(query) {
  return /\b(?:kab|kb|when|timing)\b|\bhow\s+(?:soon|long)\b|\b(?:which|what)\s+(?:year|month|date)\b|\b(?:kis|kaunse|kaun\s+se)\s+(?:saal|mahine|month|year)\b|\bkitn[aei]\s+(?:time|samay|waqt|din|mahine|saal|der)\b|\b20\d{2}\s+tak\b|\bby\s+20\d{2}\b|कब|किस\s+(?:साल|महीने)|कितन[ाीे]\s+(?:समय|दिन|महीने|साल|देर)/iu.test(
    query,
  );
}

export function isOrdinaryConcern(query) {
  return (
    !/[?]|\b(?:kab|when|hoga|hogi|kundli|chart|astrology|predict|horoscope|batao)\b/i.test(query) &&
    /\b(?:pareshan|tension|worried|stressed|upset)\b/i.test(query)
  );
}

export function requiresChartReading(query, profile) {
  return profile.status === "READY" && isPersonalChartQuestion(query);
}

export function isPersonalChartQuestion(query) {
  const text = query.toLowerCase().trim();
  // Keep general explanations, ordinary chat and another person's profile on auto routing.
  if (
    /^(?:what (?:is|are|does)|how does|explain|define|tell me what)\b/.test(text) &&
    !/\b(?:my|meri|mera|mere)\b/.test(text)
  ) {
    return false;
  }
  const subjectText = text
    .replace(/\b(?:girl|boy)\s+friend\b/g, "partner")
    // An address correction is not a request to read a relative's chart.
    .replace(/\b(?:bhai|bhaiya|bro|brother|behen|beta)\s+mat\s+(?:bolo|bulao|kaho)\b/g, "")
    .replace(
      /\b(?:do not|don't|dont)\s+call\s+me\s+(?:bhai|bhaiya|bro|brother|sister|beta)\b/g,
      "",
    );
  if (
    /\b(?:friend|sister|brother|mother|father|daughter|son|behen|bhai|dost)\b/.test(subjectText)
  ) {
    return false;
  }
  if (
    /\b(?:apply|resume|cv|interview tips|budget|bank account|court|lawyer|divorce date)\b/.test(
      text,
    ) &&
    !/\b(?:chart|kundli|horoscope|astrology)\b/.test(text)
  ) {
    return false;
  }
  const topic =
    /\b(?:marry|married|marriage|wedding|shaadi|shadi|girlfriend|boyfriend|gf|bf|crush|crsuh|partner|relationship|rishta|career|job|naukri|promotion|pormotion|education|studies|study|exam|finances?|financial|money|paisa|paise|kundli|horoscope|birth chart)\b/;
  const personal = /\b(?:i|my|me|meri|mera|mere|mujhe|mujhse|main)\b/;
  const timing = /\b(?:when|kab|kb|hogi|hoga|lagegi)\b/;
  const request =
    /\?|\b(?:tell me|batao|bataiye|kaisa|kaisi|kaise|kya|kab|kb|hogi|hoga|lagegi|will|when|should|can|which|how|reading|predict|analy[sz]e|kundli)\b/;
  return (
    topic.test(subjectText) && request.test(text) && (personal.test(text) || timing.test(text))
  );
}
