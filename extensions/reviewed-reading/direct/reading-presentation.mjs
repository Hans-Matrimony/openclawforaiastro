// Presentation only. Tool choice, evidence and period interpretation remain
// owned by the existing reading contract.
export const readingPresentationInstruction = "\nReading wording: preserve the supplied chart facts, supported dates and uncertainty. State cautions neutrally. Do not turn a difficult placement into a claim of no happiness, emotional burden, suffering or a guaranteed heavy life process. Explain the actual supported limitation without those invented consequences. Describe career outcomes as possibilities, not certainties. Keep natal placements separate from the mahadasha and antardasha: name period lords only as returned by the tools, with clear labels rather than a string of planet names. Use natural, complete Hindi/Hinglish sentences. Do not add false reassurance or change the supported timing window.";

export function unsupportedReadingConsequence(reply) {
  return /\b(?:emotional (?:burden|weight)|heavy[ ,]+slow process|no happiness|koi khushi|khushiyon se bhara samay nahi)\b/iu.test(reply);
}

export function readingPresentationIssue(reply) {
  const issues = [];
  if (unsupportedReadingConsequence(reply)) issues.push('Remove invented claims of suffering or unhappiness; describe the actual supported chart limitation neutrally.');
  if (/\bkaam\s+kaam\b/iu.test(reply)) issues.push('Remove the accidental adjacent repetition of kaam and write a complete, natural career sentence. Preserve the supported meaning.');
  if (/\b(?:ka|ke)\s+possibility\b/iu.test(reply)) issues.push('Use grammatical Hindi/Hinglish for a possibility, with a clear subject and complete sentence. Keep any supported career options explicit rather than a vague reference to aapki tarah ke kaam.');
  if (/\b(?:results?|progress)\s+(?:slow|delayed)\s+(?:aayenge|aayega|rahega|rahegi|hoga|hogi)\b|\b(?:results?|progress)\s+will\s+(?:be|remain)\s+(?:slow|delayed)\b/iu.test(reply)) {
    issues.push('Qualify the outcome as a possibility rather than asserting that progress or results will be slow. Preserve the caution and its evidence.');
  }
  const planet = '(?:Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu|Surya|Chandra|Mangal|Budh|Guru|Shukra|Shani)';
  if (new RegExp('\\b' + planet + '\\s+' + planet + '\\s+(?:(?:ki|ka)\\s+)?(?:dasha|mahadasha|antardasha)\\b', 'iu').test(reply)) {
    issues.push('Separate the natal planet from the actual mahadasha and antardasha lords. Label each period lord and its level as returned by the tools instead of using adjacent unlabelled planet names. Use the existing tool evidence; do not infer a new period.');
  }
  return issues.length ? issues.join(' ') : null;
}
