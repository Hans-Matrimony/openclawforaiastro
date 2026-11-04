// Presentation only. Tool choice, evidence and period interpretation remain
// owned by the existing reading contract.
export const readingPresentationInstruction = "\nReading wording: preserve the supplied chart facts, supported dates and uncertainty. State cautions neutrally. Do not turn a difficult placement into a claim of no happiness, emotional burden, suffering or a guaranteed heavy life process. Explain the actual supported limitation without those invented consequences. Describe career outcomes as possibilities, not certainties. Keep natal placements separate from the mahadasha and antardasha: name period lords only as returned by the tools, with clear labels rather than a string of planet names. Use natural, complete Hindi/Hinglish sentences. Do not add false reassurance or change the supported timing window.";

// A clean correction deliberately excludes old assistant predictions. It must
// still retain the existing app delivery contract that those messages carried.
export const readingRewriteInstruction = "\nKeep the app's reading delivery contract during this wording edit: exactly two short paragraphs, a concise explanation (aim at 40 words) and one direct qualified verdict (aim at 15 words, allowing the full checked month-year boundaries). Mention only the one or two relevant supported reasons, retaining mixed or adverse evidence. Do not display internal numeric chart scores, Ashtakavarga points, bindus, retrograde or combust; express the already-supported strength or limitation in plain language. Never turn a score into a new consequence. Distinguish natal placements from period lords and future periods from the current period; a future antardasha is upcoming, not currently active. Do not replace the answer with a schedule or a question, invent a ranking, or call a selected factor the only support. Retain the selected window and natural uncertainty without also denying that any possible window is given. Do not invent or narrow event dates. No recap or extra closing.";

export function unsupportedReadingConsequence(reply) {
  return /\b(?:emotional (?:burden|weight)|heavy[ ,]+slow process|no happiness|koi khushi|khushiyon se bhara samay nahi)\b/iu.test(reply);
}

export function readingPresentationIssue(reply) {
  const issues = [];
  const structured = ['{', '[', '```'].some((prefix) => reply.trimStart().startsWith(prefix));
  if (!structured && /\bashtakavarga\b[^.!?\n]{0,60}\b\d{1,3}\b/iu.test(reply)) {
    issues.push('Keep internal Ashtakavarga numbers out of this conversational reading. Express only the supported strength or limitation in plain language, retaining house numbers, dates, mixed evidence and uncertainty.');
  }
  const datedWindow = (reply.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/giu) || []).length >= 2;
  if (datedWindow && reply.split(/[,;.!?\n]+/u).some((clause) =>
    /\b(?:clear\s+timing|timing\s+clear)\s+(?:nahi|nahin)\b|\bno\s+clear\s+(?:timing|window)\b/iu.test(clause) &&
    !/\b(?:exact|fixed|certain|pakki|tareekh|tarikh|date)\b/iu.test(clause))) {
    issues.push('The draft already gives a possible period. Distinguish that qualified window from an unknown exact event date instead of also saying no clear timing. Preserve the same checked boundaries and obstacles; do not strengthen the likelihood or promise an event.');
  }
  if (reply.split(/[.!?\n]+/u).some((sentence) => {
    const match = /\b(?:ek\s+hi|sirf\s+ek|ekmatra)\s+(?:sahyog|sahayog|sahara)\b/iu.exec(sentence);
    return match && !/\b(?:nahi|nahin|not)\s*$/iu.test(sentence.slice(0, match.index)) &&
      !/^\s*(?:(?:hai|is)\s+)?(?:nahi|nahin|not)\b/iu.test(sentence.slice(match.index + match[0].length));
  })) issues.push('Remove the exhaustive claim that this is the only supporting factor. These results list selected factors, not every possible factor. Keep the stated support, opposing evidence and period without inventing another reason.');
  if (unsupportedReadingConsequence(reply)) issues.push('Remove invented claims of suffering or unhappiness; describe the actual supported chart limitation neutrally.');
  if (/\bkaam\s+kaam\b/iu.test(reply)) issues.push('Remove the accidental adjacent repetition of kaam and write a complete, natural career sentence. Preserve the supported meaning.');
  if (/\b(?:ka|ke)\s+possibility\b/iu.test(reply)) issues.push('Use grammatical Hindi/Hinglish for a possibility, with a clear subject and complete sentence. Keep any supported career options explicit rather than a vague reference to aapki tarah ke kaam.');
  if (/\b(?:results?|progress|process)\s+(?:slow|delayed)\s+(?:aayenge|aayega|rahega|rahegi|hoga|hogi)\b|\b(?:results?|progress|process)\s+will\s+(?:be|remain)\s+(?:slow|delayed)\b/iu.test(reply)) {
    issues.push('Qualify the outcome as a possibility rather than asserting that progress or results will be slow. Preserve the caution and its evidence.');
  }
  if (/\blekin\s*,\s*aur\b|\bpoints?\s+kam\s*\(/iu.test(reply)) {
    issues.push('Use complete natural sentences rather than a dangling contrast or internal point shorthand. Describe the checked support and caution in plain language, without adding a new outcome or changing the dated window.');
  }
  const planet = '(?:Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu|Surya|Chandra|Mangal|Budh|Guru|Shukra|Shani)';
  const period = '\\b' + planet + '\\s+(?:(?:ka|ki)\\s+)?(?:mahadasha|antardasha)';
  const house = '(?:house\\s+\\d+|\\d+(?:ve|ven|th)?\\s+(?:ghar|house))';
  const periodAsPlacement = period + '\\s+(?:mein|me)\\s+(?:' + house + '\\s+(?:mein|me)\\s+)?(?:baith\\w*|placed|situated)\\b|' +
    period + '\\s+' + house + '\\s+(?:mein|me)\\s+(?:hai|hain)\\b';
  if (new RegExp(periodAsPlacement, 'iu').test(reply)) {
    issues.push('A natal house contains a planet, not an antardasha. State the checked natal placement in its own complete clause, then separately label the period and preserve its exact supported month-year boundaries and qualified verdict.');
  }
  if (new RegExp('\\b(?:\\d+(?:ve|ven|th)?|saatve|seventh)\\s+(?:ghar|house)\\s+(?:par|mein|me)\\s+' + planet + '\\s+(?:(?:ka|ki)\\s+)?(?:mahadasha|antardasha)\\b', 'iu').test(reply)) {
    issues.push('A natal house contains a planet, not an antardasha. State the checked natal placement in its own complete clause, then separately label the period and preserve its exact supported month-year boundaries and qualified verdict.');
  }
  if (new RegExp('\\b' + planet + '\\s+' + planet + '\\s+(?:(?:ki|ka)\\s+)?(?:dasha|mahadasha|antardasha)\\b', 'iu').test(reply)) {
    issues.push('Separate the natal planet from the actual mahadasha and antardasha lords. Label each period lord and its level as returned by the tools instead of using adjacent unlabelled planet names. Use the existing tool evidence; do not infer a new period.');
  }
  return issues.length ? issues.join(' ') : null;
}
