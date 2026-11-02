// Suggestions and unanswered assistant questions are not completed user actions.
// This guard covers skill/course progress only; it never changes the reading.
const activity = /\b(?:skills?|practi[cs](?:e|es|ing|ed)|practice|coding|programming|course|training)\b/i;
const uncertainty = /[?？]|\b(?:not|never|haven't|haven’t|haven\s+not|nahi|nahin|nhi|want|wants|plan|plans|planning|will|should|could|might|suggested|recommended|chah|chahiye|soch|karunga|karungi|stopped|quit|chhod|chod)\b/i;

export function unsupportedActionProgress(closing, value, facts = []) {
  if (!activity.test(closing)) return false;
  // Asking whether an activity began is different from asking about its progress.
  const progress = /\b(?:progress|kaisa\s+chal|kaisi\s+chal|how\b.{0,35}\bgoing)\b/i.test(closing);
  if (!progress && /^(?:kya\s+aapne|have\s+you|did\s+you)\b/i.test(closing.trim())) return false;
  const assumed = progress || /\b(?:you(?:'ve| have)?\s+(?:started|begun)|aapne\b.{0,60}\bshuru\b|jo\b.{0,45}\bshuru\b|your\s+(?:daily\s+)?practice)\b/i.test(closing);
  if (!assumed) return false;
  const userStatements = [value.query ?? '', ...(value.history ?? [])
    .filter(turn => turn.role === 'user').toReversed().map(turn => turn.text)];
  // The latest relevant user statement wins over old history or saved memory.
  const latest = userStatements.find(text => activity.test(text));
  const established = (text) => !uncertainty.test(text) &&
    /\b(?:I\s+(?:(?:have|am)\s+)?(?:started|began|practice|practise|practicing|practising|learning|taking)|I've\s+started|maine\b.{0,65}\bshuru\s+(?:ki|kiya|kar)|main\b.{0,65}\b(?:kar|seekh)\s+rah[ai]|user\s+(?:has\s+started|started|practices|practises|is\s+(?:practicing|practising|learning|taking)))\b/i.test(text);
  if (latest !== undefined) return !established(latest);
  return !facts.some(fact => typeof fact === 'string' && activity.test(fact) && established(fact));
}
