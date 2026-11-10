export const CHART_TOOL_NAMES = new Set([
  "get_horoscope_predictions",
  "get_current_transits",
  "get_match_report",
  "get_horary_prediction",
]);

export const bareToolName = (name) => name.replace(/^mcp__VedAstro__/, "");

// Use the same timing intent for tool selection and fallback presentation.
export function asksForTiming(query) {
  // Natural Hindi/Hinglish timing requests need not contain kab/when. Keep
  // definitions outside this rule; reading scope still decides tool use.
  if (!/\b(?:define|definition|meaning|matlab)\b/iu.test(query) &&
      /\b(?:kaun(?:sa|si|se|\s+s[aei])|kis|which|what)\s+(?:(?:exact|supported|sambhavit|favourable|favorable)\s+)?(?:samay|waqt|period|window)\b|(?:कौन\s*सा|किस)\s+(?:समय|वक्त|अवधि)/iu.test(query)) {
    return true;
  }
  // A personal event-window request is timing even without kab/when. Keep
  // definitions and ordinary requests for time outside this additional rule.
  if (/\b(?:time|timing)[ -]+window\b/iu.test(query) &&
      !/\b(?:define|definition|mean|meaning|matlab)\b/iu.test(query) &&
      /\b(?:sha+di|marriage|marry|wedding|career|job|naukri|promotion)\b/iu.test(query) &&
      /\?|\b(?:batao|bataiye|tell|show|give|which|what|expected|sambhavit)\b/iu.test(query)) {
    return true;
  }
  return /\b(?:agla|agle|agli|sambhavit|next)\s+(?:(?:supported|sambhavit|favourable|favorable)\s+)?(?:(?:dasha|antardasha)\s+)?(?:samay|waqt|period|window)\b|\b(?:samay|waqt)\s+(?:kya|kab)\b|\b(?:kab|kb|when|timing)\b|\bhow\s+(?:soon|long)\b|\b(?:which|what)\s+(?:year|month|date)\b|\b(?:kis|kaunse|kaun\s+se)\s+(?:saal|mahine|month|year)\b|\bkitn[aei]\s+(?:time|samay|waqt|din|mahine|saal|der)\b|\b20\d{2}\s+tak\b|\bby\s+20\d{2}\b|कब|किस\s+(?:साल|महीने)|कितन[ाीे]\s+(?:समय|दिन|महीने|साल|देर)/iu.test(
    query,
  );
}

// Practical actions are not a request for a new prediction. Explicit timing or
// chart requests retain their existing route, including mixed-intent questions.
export function isPracticalFollowup(query) {
  return !asksForTiming(query) &&
    !/\b(?:kundli|horoscope|predict|prediction|dasha|transit|chart)\b/i.test(query) &&
    /\b(?:practical\s+(?:kadam|steps?|advice)|action\s+plan|next\s+steps?|kya\s+(?:karu|karun|karna chahiye)|what should i do)\b/i.test(query);
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
  if (isPracticalFollowup(query)) return false;
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
    /\b(?:marry|married|marriage|wedding|shaadi|shadi|girlfriend|boyfriend|gf|bf|crush|crsuh|partner|relationship|rishta|career|job|naukri|promotion|pormotion|education|studies|study|exams?|padhai|padhaai|padhayi|parhai|finances?|financial|money|paisa|paise|kundli|horoscope|chart|birth chart)\b/;
  const personal = /\b(?:i|my|me|meri|mera|mere|mujhe|mujhse|main)\b/;
  const timing = /\b(?:when|kab|kb|hogi|hoga|lagegi)\b/;
  const request =
    /\?|\b(?:tell me|batao|bataiye|kaisa|kaisi|kaise|kya|kab|kb|hogi|hoga|lagegi|will|when|should|can|which|how|reading|predict|analy[sz]e|kundli)\b/;
  return (
    topic.test(subjectText) && request.test(text) && (personal.test(text) || timing.test(text))
  );
}
