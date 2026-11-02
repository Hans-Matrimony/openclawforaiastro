import { isPeriodInterpretation } from "./period-interpretation.mjs";
import { asksForTiming } from "./reading-intent.mjs";

// The local natal/transit tools provide periods, not calculated event windows.
// Restrict this check to that explicit contract; do not reinterpret other tools.
export function unsupportedEventTiming(reply, results, query = "") {
  const data = results.flatMap((raw) => {
    try {
      return [JSON.parse(raw)];
    } catch {
      return [];
    }
  });
  if (
    !data.some((d) =>
      d.evidence_scope?.timing?.includes("does not calculate event-specific windows"),
    )
  ) {
    return false;
  }
  if (data.some((d) => d.horary_number || d.event_windows?.length)) {
    return false;
  }
  // A period schedule cannot justify a blanket instruction to stop pursuing work.
  // Catch the observed Hinglish forms before accepting a qualified interpretation.
  if (/\b20\d{2}\b/.test(reply) &&
      /\b(?:solid\s+move\s+nahi\s+hoga|job\s+change\s+(?:mat|nahi)|(?:do not|don't)\s+(?:apply|change jobs))\b/i.test(reply)) {
    return true;
  }
  if ((!query || asksForTiming(query)) && isPeriodInterpretation(reply, data)) {
    return false;
  }
  const eventTopic =
    /\b(?:sha+di|marriage|career|job|financial|finance|income|paise|naukri|education|studies|study|padhai|padhaai|padhayi|exams?|results?)\b/i.test(
      reply,
    );
  return reply
    .split(/\n\s*\n/)
    .flatMap((paragraph) =>
      paragraph.split(/[.!?\n]+/).map((sentence) => ({
        sentence,
        dated: /\b20\d{2}\b/.test(paragraph),
      })),
    )
    .some(
      ({ sentence, dated }) =>
        dated &&
        (eventTopic || /\b(?:girlfriend|boyfriend|gf|bf|rishta)\b/i.test(sentence)) &&
        /\b(?:improve|improvement|growth|boost|breakthrough|mauka|yog|chance|stability|relief|opportunity|sha+di|marriage|marry|wait|intezaar|intazaar|behtar|better|progress|window)\b|\b(?:girlfriend|boyfriend|gf|bf|rishta|job|naukri|education|studies|study|padhai|padhaai|padhayi|exams?|results?)\b.{0,80}\b(?:banegi|banega|lagegi|lagega|milegi|milega|mil jayegi|mil jayega|will|hogi|hoga|honge|hongi|clear|pass|sambhavna|sambhavana|sambhavit|possible|likely)\b|\b(?:sahyog|support|income|flow|paise|paisa|salary|pareshani)\b.{0,80}\b(?:kam|badh\w*|ghat\w*|aayeg\w*|mile\w*|slow|tez|increase\w*|decrease\w*)\b/i.test(
          sentence,
        ) &&
        !/\b(?:not a calculated|not an event|date nahi|tay nahi|establish|cannot|does not|no verified)\b/i.test(
          sentence,
        ),
    );
}
