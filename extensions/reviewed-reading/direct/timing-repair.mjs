// Explain the validation contract before drafting, rather than only after rejection.
export const timingAnswerInstruction =
  "\n\n# Timing answer\nThe user asks when. Use get_horoscope_predictions for the actual period schedule. Compare the available periods using topic-specific supportive AND adverse factors; the first upcoming period is not automatically the best one. Never treat a delay factor as a reason for improvement. Lead with the direct conclusion, without blanket reassurance, preserving negative readings. Answer with a relevant chart-based interpretation and a short timing verdict, preserving supportive, unfavorable or mixed indications. If interpreting a returned period, include its lord and BOTH start and end month-year boundaries, with a natural qualification such as sambhavna or ho sakti hai. Explain the checked chart reason; a period change alone does not prove an event. Do not substitute a bare dasha schedule for the answer, invent an exact event month, or copy a date from history. If the evidence cannot support a timing interpretation, say that briefly without inventing one. The separate companion stage handles the friendly question.\n";

export const nonTimingAnswerInstruction =
  "\n\n# Non-timing answer\nThis question does not ask when. Answer its subject directly using this turn's chart evidence, with an explanation and a short verdict. Do not add a future year, month or waiting period from an earlier topic or from the dasha schedule. For education or exams, explain the supported strengths and difficulties; do not replace that answer with when results will improve. Preserve unfavorable or mixed indications.\n";

// Provide exact correction targets, not a new interpretation or invented event date.
export function timingRepairEvidence(results) {
  const rows = results.flatMap((raw) => {
    try {
      const value = JSON.parse(raw);
      return value.engine === "local-sweph-v2" && value.dasha ? [value] : [];
    } catch {
      return [];
    }
  });
  const schedules = new Set(rows.map((row) => JSON.stringify(row.dasha)));
  const subjects = new Set(
    rows.filter((row) => row.birth_chart).map((row) => JSON.stringify(row.birth_chart)),
  );
  if (schedules.size !== 1 || subjects.size > 1) {
    return "";
  }
  const month = (date) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
      return null;
    }
    return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  };
  const periods = (
    Array.isArray(rows[0]?.dasha.upcoming_antardashas) ? rows[0].dasha.upcoming_antardashas : []
  ).flatMap((p) => {
    if (!p || !/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(p.lord)) {
      return [];
    }
    const from = month(p.from),
      to = month(p.to);
    return from && to && p.from < p.to ? [{ lord: p.lord, from, to }] : [];
  });
  if (!periods.length) {
    return "";
  }
  return (
    "\nExact returned period boundaries (data, not event predictions): " +
    JSON.stringify(periods) +
    "\nDo not merely replace an open-ended year claim with an ISO start date. A topic-supported period interpretation must include BOTH month-year boundaries, its period lord, a relevant checked chart reason and one natural qualification such as sambhavna. 'Tab yog balwaan hoga' is not a reason: a period change alone does not establish improvement. Preserve unfavorable or mixed factors. Do not copy the rejected rationale unless supported by the tool. If no topic-specific support exists, do not invent it or a narrower event month."
  );
}
