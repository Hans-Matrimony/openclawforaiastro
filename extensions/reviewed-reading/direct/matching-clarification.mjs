// Explaining a quoted score's limitations is not a request to calculate a new
// pair. The quote stays unverified; this answer never endorses its number.
export function quotedMatchingLimitations(value) {
  const quote = value.reply_to;
  const query = value.query ?? '';
  if (!['english','en','hindi','hi','hinglish'].includes(value.language) ||
      quote?.role !== 'assistant' || typeof quote.text !== 'string' ||
      !/\b(?:guna?|gun|ashtakoota)\b/i.test(quote.text) ||
      !/\b(?:limitations?|limits?|seema)\b|सीमाएँ|सीमाएं|सीमा/u.test(query.toLowerCase()) ||
      /\b(?:limitations?|limits?)\s+(?:mat|nahi|nahin)\b|\b(?:don't|do not)\s+(?:explain|describe)\s+(?:the\s+)?limitations?\b/i.test(query) ||
      /\b(?:recalculate|calculate|dob|recompute|new partner|naye vyakti|factors?|eight|aath)\b|\b(?:score|total)\s+(?:kitna|kitne|batao|bataiye)\b|\b(?:new|updated|current)\s+(?:score|total)\b|\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/i.test(query)) return null;
  const score = /\b(\d{1,2}(?:\.\d+)?)\s*\/\s*36\b/.exec(quote.text);
  if (!score || Number(score[1]) > 36) return null;
  if (value.language === 'hinglish')
    return 'Guna Milan ek paramparik compatibility assessment hai. Sirf is score se rishte ki safalta, dono ki feelings ya shaadi ki guarantee nahi hoti. Calculation janam ki details ki accuracy par nirbhar hai; communication, consent aur aapas ki samajh ko yeh score measure nahi karta.';
  if (['hindi','hi'].includes(value.language))
    return 'गुण मिलान एक पारंपरिक अनुकूलता आकलन है। केवल इस अंक से रिश्ते की सफलता, दोनों की भावनाएँ या शादी की गारंटी नहीं मिलती। गणना जन्म-विवरण की सटीकता पर निर्भर है; बातचीत, सहमति और आपसी समझ को यह अंक नहीं मापता।';
  return 'Guna Milan is a traditional compatibility assessment. A quoted score alone cannot establish relationship success, either person\'s feelings or a guaranteed marriage. The calculation depends on accurate birth details; it does not measure communication, consent or mutual understanding.';
}
