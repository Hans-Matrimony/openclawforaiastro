const planet = /^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/;

function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

// A period schedule is useful context, not an event prediction. In particular,
// do not pick a date from one of several disagreeing subjects/tool results.
export function periodFallback(rows, language, asOf = new Date()) {
  const english = language === "english";
  const schedules = rows.filter((row) => row.dasha).map((row) => row.dasha);
  const unique = new Set(schedules.map((s) => JSON.stringify(s)));
  const subjects = new Set(
    rows.filter((r) => r.birth_chart).map((r) => JSON.stringify(r.birth_chart)),
  );
  if (unique.size !== 1 || subjects.size > 1 || !Number.isFinite(asOf.valueOf())) {
    return "";
  }
  const today = asOf.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const schedule = schedules[0];
  const upcoming = (
    Array.isArray(schedule.upcoming_antardashas) ? schedule.upcoming_antardashas : []
  )
    .filter(
      (p) =>
        p &&
        planet.test(p.lord) &&
        calendarDate(p.from) &&
        calendarDate(p.to) &&
        p.from >= today &&
        p.to > p.from,
    )
    .toSorted((a, b) => a.from.localeCompare(b.from))[0];
  const current = schedule.current_antardasha;
  const validCurrent =
    current &&
    planet.test(current.lord) &&
    calendarDate(current.to) &&
    current.to >= today &&
    (current.from === undefined ||
      (calendarDate(current.from) && current.from <= today && current.from < current.to));
  if (upcoming) {
    return english
      ? `The calculated ${upcoming.lord} sub-period runs ${upcoming.from} to ${upcoming.to}.`
      : `${upcoming.lord} antardasha ${upcoming.from} se ${upcoming.to} tak hai.`;
  }
  if (validCurrent) {
    return english
      ? `The calculated ${current.lord} sub-period ends on ${current.to}. That boundary alone does not predict the event.`
      : `${current.lord} antardasha ${current.to} tak hai. Sirf dasha badalne se event ka samay tay nahi hota.`;
  }
  return "";
}
