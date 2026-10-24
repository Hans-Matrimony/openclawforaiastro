import { fallbackFactor } from "./fallback-factors.mjs";

// A failed bounded correction must not become a transport failure or publish
// the rejected prediction. This fallback uses only returned period facts.
export function evidenceFallback(results, language, query = "") {
  const area = /career|job|work|naukri|fields?/i.test(query)
    ? "career"
    : /financ|money|pais|income/i.test(query)
      ? "money"
      : /shaadi|shadi|marriage|partner/i.test(query)
        ? "marriage"
        : null;
  const rows = results.flatMap((raw) => {
    try {
      const d = JSON.parse(raw);
      return d.engine === "local-sweph-v2" ? [d] : [];
    } catch {
      return [];
    }
  });
  const signals = rows.flatMap((d) => d.verdict_signals ?? []).filter((s) => s.area === area);
  // Never combine conflicting readings or different subjects into one verdict.
  const signal = signals.every((s) => JSON.stringify(s) === JSON.stringify(signals[0]))
    ? signals[0]
    : null;
  if (signal && ["POSITIVE", "NEGATIVE", "MIXED"].includes(signal.trend)) {
    const english = language === "english";
    const label = { career: "Career", money: "Finance", marriage: "Relationship" }[area];
    const trend = { POSITIVE: "supportive", NEGATIVE: "challenging", MIXED: "mixed" }[signal.trend];
    const timing = /\b(?:when|kab|year|saal|date|timing)\b/i.test(query);
    const factors = [signal.positive, signal.negative]
      .map((items) =>
        (Array.isArray(items) ? items : []).map((s) => fallbackFactor(s, english)).find(Boolean),
      )
      .filter(Boolean)
      .join(english ? ", while " : ", lekin ");
    const schedule = rows.map((d) => d.dasha).find(Boolean);
    const upcoming = (schedule?.upcoming_antardashas ?? []).find(
      (u) => /^\d{4}-\d{2}-\d{2}$/.test(u.from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(u.to ?? ""),
    );
    const currentEnd = /^\d{4}-\d{2}-\d{2}$/.test(schedule?.current_antardasha?.to ?? "")
      ? schedule.current_antardasha.to
      : null;
    const leadIn = {
      career: english ? "Career timing" : "Career ka waqt",
      money: english ? "Money timing" : "Paise ki sthiti",
      marriage: english ? "Relationship timing" : "Shaadi ka samay",
    }[area];
    const timingLine = upcoming
      ? english
        ? `${leadIn}: the calculated ${upcoming.lord} sub-period runs ${upcoming.from} to ${upcoming.to}.`
        : `${leadIn}: hisaab ke hisaab se ${upcoming.lord} antardasha ${upcoming.from} se ${upcoming.to} tak hai.`
      : currentEnd
        ? english
          ? `${leadIn}: the current sub-period ends ${currentEnd}; the next calculated window follows it.`
          : `${leadIn}: abhi ki antardasha ${currentEnd} tak hai, uske baad agla window aata hai.`
        : english
          ? `${leadIn}: this calculation returned no period data.`
          : `${leadIn}: is calculation me period data nahi aaya.`;
    return (
      (english
        ? `${label} indications in the calculated chart are ${trend}.`
        : `${{ career: "Career", money: "Paise", marriage: "Rishte" }[area]} ko lekar ${
            {
              POSITIVE: "sahyog ke sanket hain",
              NEGATIVE: "rukawaton ke sanket zyada hain",
              MIXED: "sahyog bhi hai aur rukawatein bhi",
            }[signal.trend]
          }.`) +
      (factors ? " " + factors + "." : "") +
      "\n\n" +
      (timing ? timingLine : english
          ? area === "career"
            ? "This reading does not identify one career field as better than the others."
            : `The ${label.toLowerCase()} reading has ${trend} indications.`
          : area === "career"
            ? "Is reading mein kisi ek career field ko baaki se behtar batane ka aadhar nahi mila."
            : `${label} ki reading mein ${trend} sanket hain.`)
    );
  }
  const schedules = results.flatMap((raw) => {
    try {
      const data = JSON.parse(raw);
      return data.engine === "local-sweph-v2" && data.dasha ? [data.dasha] : [];
    } catch {
      return [];
    }
  });
  const current = schedules[0]?.current_antardasha;
  const knownPlanet = /^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/;
  const hasPeriod =
    current &&
    knownPlanet.test(current.lord) &&
    /^\d{4}-\d{2}-\d{2}$/.test(current.to ?? "") &&
    schedules.every((s) => JSON.stringify(s.current_antardasha) === JSON.stringify(current));
  const upcoming = (schedules[0]?.upcoming_antardashas ?? []).find(
    (u) => /^\d{4}-\d{2}-\d{2}$/.test(u.from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(u.to ?? ""),
  );
  const nextWindow = upcoming
    ? english
      ? ` The next calculated ${upcoming.lord} sub-period runs ${upcoming.from} to ${upcoming.to}.`
      : ` Uske baad ${upcoming.lord} antardasha ${upcoming.from} se ${upcoming.to} tak hai.`
    : "";
  if (language === "english") {
    return (
      (hasPeriod
        ? `The calculated ${current.lord} sub-period ends on ${current.to}.` + nextWindow
        : "The reading could not be reconciled with the returned chart evidence.") +
      (upcoming || hasPeriod ? "" : "\n\nThe returned results did not include period data.")
    );
  }
  return (
    (hasPeriod
      ? `Calculation mein ${current.lord} antardasha ${current.to} tak hai.` + nextWindow
      : "Reading ke daave aur chart ke results aapas mein match nahi hue.") +
    (upcoming || hasPeriod ? "" : "\n\nIn results me period data nahi aaya.")
  );
}
