// The local natal/transit tools provide periods, not calculated event windows.
// Restrict this check to that explicit contract; do not reinterpret other tools.
export function unsupportedEventTiming(reply, results) {
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
  const eventTopic =
    /\b(?:sha+di|marriage|career|job|financial|finance|income|paise|naukri|education|study)\b/i.test(
      reply,
    );
  return reply
    .split(/[.!?\n]+/)
    .some(
      (sentence) =>
        /\b20\d{2}\b/.test(sentence) &&
        (eventTopic || /\b(?:girlfriend|boyfriend|gf|bf|rishta)\b/i.test(sentence)) &&
        /\b(?:improve|improvement|growth|boost|breakthrough|mauka|yog|chance|stability|relief|opportunity|shaadi|marriage|marry|wait|intezaar|intazaar|behtar|better|progress|window)\b/i.test(
          sentence,
        ) &&
        !/\b(?:not a calculated|not an event|date nahi|tay nahi|establish|cannot|does not|no verified)\b/i.test(
          sentence,
        ),
    );
}
