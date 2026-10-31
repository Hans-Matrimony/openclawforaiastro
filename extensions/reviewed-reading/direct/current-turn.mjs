import { listeningOnly } from "./companion-continuity.mjs";
import { isPersonalChartQuestion, isPracticalFollowup } from "./reading-intent.mjs";

// Only guard ordinary tiredness/venting here; sensitive and chart turns keep
// their existing handling even when the user also asks us to listen.
export function listeningConcern(query) {
  return listeningOnly(query) &&
    !isPersonalChartQuestion(query) && !isPracticalFollowup(query) &&
    !/\b(?:suicid\w*|self.harm|kill|die|death|hurt|abuse|unsafe|emergency|pain|medical|medicine|overdose|marna|marne)\b/i.test(query) &&
    !/\b(?:chart|kundli|horoscope|prediction|dasha)\b/i.test(query) &&
    /\b(?:thak|tired|exhausted|vent|pareshan|stressed|upset)\b/i.test(query);
}

export const listeningInstruction = "\n# Current listening request\nThe user wants to be heard, without advice or questions. Briefly acknowledge only what they said. Do not suggest sleep, rest, exercises, plans or next steps. Do not ask a follow-up. Earlier topics and instructions are historical; answer this turn.\n";

export function unwantedListeningAdvice(reply) {
  return /[?？]|\b(?:so jao|so jaiye|so jaaye|aaram karo|rest kar|try|should|must|go to sleep|get some rest|take a break|kijiye|karo|kar lo|chahiye)\b/i.test(reply);
}

export function stalePracticalReply(query, reply) {
  // Reject the observed tiredness carry-over only for a current career request.
  // A relevant work step accompanied by an acknowledgement remains valid.
  return /\b(?:job|career|naukri)\b/i.test(query) &&
    /\b(?:thak|tired|so jao|sleep|kal phir|no advice|koi advice nahi)\b/i.test(reply) &&
    !/\b(?:cv|resume|portfolio|apply|applications?|openings?|linkedin|vacanc\w*|interview|recruiter|requirements?|projects?|networking)\b/i.test(reply);
}
