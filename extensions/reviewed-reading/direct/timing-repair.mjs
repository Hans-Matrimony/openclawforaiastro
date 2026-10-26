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
    "\nDo not merely replace '2027 ke baad' with an ISO start date. A topic-supported period interpretation must include BOTH month-year boundaries, its period lord, a relevant checked chart reason and one natural qualification such as sambhavna. 'Tab yog balwaan hoga' is not a reason: a period change alone does not establish improvement. Preserve unfavorable or mixed factors. Do not copy the rejected rationale unless supported by the tool. If no topic-specific support exists, do not invent it or a narrower event month."
  );
}
