import {isPersonalChartQuestion} from './reading-intent.mjs';
import {selectedSelfBirth} from './selected-self-birth.mjs';
import {quotedSelfReading} from './quoted-reading.mjs';
import {correctedReadingSubject} from './personal-query.mjs';

export function generalMatchingQuestion(query) {
  return !/\b(?:my|our|meri|mera|mere|hamara|hum|ham|dono|partner|girlfriend|boyfriend|gf|bf)\b/i.test(query) &&
    /^(?:what\s+(?:is|are|does)|how\s+(?:does|to)|explain|define)\b|\b(?:guna?|gun)\s+milan\s+(?:kya|kaise)\s+(?:hai|hota|karte)\b/i.test(query);
}

export const asksGunaScore = query => !generalMatchingQuestion(query) && /\b(?:guna?|gun|ashtakoota)\b.*\b(?:milan|match|score|kitne|bata|puch|puchha)|\b(?:guna?|gun)\s*(?:batao|bataiye|kitne)\b/iu.test(query);

function singleAbbreviatedReading(query) {
  const text = query.trim().replace(/[?!.।]+$/gu, '').replace(/\s+/gu, ' ');
  if (text.split(/\s+/u).length > 16 ||
      /\b(?:friend|partner|girlfriend|boyfriend|gf|bf|crush|wife|husband|mother|father|sister|brother|behen|bhai|dost|feel|feeling|sad|upset|career|job|money|kundli|chart)\b/iu.test(text)) return false;
  // Only topic-free ellipses may borrow the previous self question. A broad
  // why/how/when prefix also matches greetings and entirely new questions.
  return /^(?:why|how)(?: exactly| so| is that| did you (?:calculate|check|verify)(?: that| this)?| do you (?:say|know) that)?$/iu.test(text) ||
    /^(?:kyu|kyun|kaise)(?: (?:aisa|ye|yeh|pata|calculate|verify|check)(?: (?:kiya|hua|chala|hai|hoga))?)?$/iu.test(text) ||
    /^(?:aisa|ye|yeh) (?:kyu|kyun|kaise)(?: (?:hai|hoga|hua))?$/iu.test(text) ||
    /^(?:kab|kb)(?:\s+(?:tak|tk|hoga|hogi|honge|aayega|aayegi|milegi|milega|se|start|shuru|hona|hone|wala|wali|hai|batao|bataiye|exactly|phir|toh))*$/iu.test(text) ||
    /^(?:when|how soon|how long|which (?:year|month|date)|what (?:year|month|date))(?:\s+(?:will|would|could|can|it|that|this|happen|be|start|end|exactly|then|please|do|you|mean))*$/iu.test(text) ||
    /^(?:kis (?:basis|aadhar|adhar|bunyaad)(?: (?:pe|par))?|on what (?:basis|grounds)|what (?:evidence|proof))$/iu.test(text) ||
    /^(?:(?:why|kyu|kyun)(?: not| only| sirf)?\s+20\d{2}|20\d{2}\s+(?:kyu|kyun))$/iu.test(text) ||
    /^(?:क्यों|कैसे|किस आधार पर|कब(?: तक)?(?: होगा| होगी| होंगे)?)$/u.test(text) ||
    (/\b(?:house\s+\d{1,2}|\d{1,2}(?:ve|va|th|st|nd|rd)?\s+(?:ghar|house))\b/iu.test(text) &&
     /\b(?:strength|score|majbooti|mazbooti|bindus)\b/iu.test(text) && /\b(?:kaise|how|kyu|kyun|why)\b/iu.test(text));
}

function abbreviatedReading(query) {
  if (singleAbbreviatedReading(query)) return true;
  // Keep a burst of short follow-ups together, while any new question in the
  // same burst prevents borrowing the previous reading's subject.
  const parts = query.trim().split(/[?!।]+(?:\s+|$)|\n+/u).map(part=>part.trim()).filter(Boolean);
  return query.trim().split(/\s+/u).length <= 16 && parts.length > 1 && parts.length <= 4 &&
    parts.every(part=>singleAbbreviatedReading(part) || answerRetry(part));
}

function answerRetry(query) {
  // A retry can contain several messages joined by the WhatsApp burst buffer.
  // Match the entire request so a new topic, person or correction stops recovery.
  const text = query.toLowerCase().replace(/[?!.、,।\n]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  return text.length <= 180 && /^(?:(?:please |plz )?(?:response|reply|answer|jawab|jawaab)(?: toh| to)?(?: do| de| dijiye| dijiye na| karo| kar do| please)?(?: na+)?|(?:i |mai |main )?(?:did not understand|didn't understand|dont understand|don't understand)|(?:matlab|mtlb|mtlb)?\s*(?:samajh|samjh|samjha|smjha|samjha? nahi|smjh)(?: nahi| nhi| nahin)(?: aaya| aya)?(?: mai| main| mujhe)?)(?:\s+(?:response|reply|answer|jawab)(?: toh| to)?(?: do| de| dijiye)(?: na+)?)?$/iu.test(text);
}

export function borrowsCompanionTopic(query) {
  return abbreviatedReading(query) || answerRetry(query) ||
    /^(?:by )?20\d{2}(?: tak)?[?!.\s]*$/iu.test(query.trim()) ||
    /^(?:matlab|samjhao|explain|thik se|aur(?: batao)?|or batao|haan|yes|nahi|no|then|what next|what should i do|ab kya(?: karu[n]?)?|kya karu[n]?|tak|summarize)[?!.\s]*$/iu.test(query.trim());
}

export const newCompanionQuestion = query => !borrowsCompanionTopic(query) && !isPersonalChartQuestion(query) &&
  /^(?:why|how|when|which|kaise|kyun|kab)\b/iu.test(query.trim());

export function activeReadingQuestion(value) {
  const correctedSubject=correctedReadingSubject(value.query);
  if (correctedSubject !== value.query) return correctedSubject;
  // Resolve a short quoted follow-up only from the selected quote's own
  // subject. Never substitute a different subject from unquoted history.
  if (value.reply_to) {
    const subject = (abbreviatedReading(value.query) || answerRetry(value.query)) && quotedSelfReading(value);
    return subject ? `${subject}\nFollow-up: ${value.query}` : value.query;
  }
  if (isPersonalChartQuestion(value.query) || asksGunaScore(value.query)) return value.query;
  const retry = answerRetry(value.query);
  if (!abbreviatedReading(value.query) && !retry) return value.query;
  // Only the latest user subject can resolve an abbreviated follow-up. Never
  // skip a changed topic to resurrect an older assistant prediction.
  const previous = [...(value.history ?? [])].reverse().filter(t => t.role === 'user').slice(0, 4);
  for (const turn of previous) {
    if (selectedSelfBirth(turn.text, value.birth)) return `${turn.text}\nFollow-up: ${value.query}`;
    if (!abbreviatedReading(turn.text) && !answerRetry(turn.text)) break;
  }
  return value.query;
}
