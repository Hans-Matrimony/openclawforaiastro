import {isPersonalChartQuestion, asksForTiming} from './reading-intent.mjs';
import {selectedSelfBirth} from './selected-self-birth.mjs';

export function generalMatchingQuestion(query) {
  return !/\b(?:my|our|meri|mera|mere|hamara|hum|ham|dono|partner|girlfriend|boyfriend|gf|bf)\b/i.test(query) &&
    /^(?:what\s+(?:is|are|does)|how\s+(?:does|to)|explain|define)\b|\b(?:guna?|gun)\s+milan\s+(?:kya|kaise)\s+(?:hai|hota|karte)\b/i.test(query);
}

export const asksGunaScore = query => !generalMatchingQuestion(query) && /\b(?:guna?|gun|ashtakoota)\b.*\b(?:milan|match|score|kitne|bata|puch|puchha)|\b(?:guna?|gun)\s*(?:batao|bataiye|kitne)\b/iu.test(query);

function abbreviatedReading(query) {
  return query.trim().split(/\s+/).length <= 16 &&
    !/\b(?:friend|partner|girlfriend|boyfriend|gf|bf|crush|wife|husband|mother|father|sister|brother|behen|bhai|dost|feel|feeling|sad|upset|career|job|money|kundli|chart)\b/i.test(query) &&
    (/^(?:why|how|kyu|kyun|kaise|kis\s+(?:basis|aadhar)|kab|kb|when)\b/i.test(query) || asksForTiming(query) ||
     /\b(?:house|ghar)\b.*\b(?:strength|score)\b.*\b(?:kaise|how|kyu|why)\b/i.test(query));
}

export function activeReadingQuestion(value) {
  if (isPersonalChartQuestion(value.query) || asksGunaScore(value.query)) return value.query;
  if (!abbreviatedReading(value.query)) return value.query;
  // Only the latest user subject can resolve an abbreviated follow-up. Never
  // skip a changed topic to resurrect an older assistant prediction.
  const previous = [...(value.history ?? [])].reverse().filter(t => t.role === 'user').slice(0, 4);
  for (const turn of previous) {
    if (selectedSelfBirth(turn.text, value.birth)) return `${turn.text}\nFollow-up: ${value.query}`;
    if (!abbreviatedReading(turn.text)) break;
  }
  return value.query;
}
