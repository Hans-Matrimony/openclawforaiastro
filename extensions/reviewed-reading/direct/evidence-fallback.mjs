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
    const factors = [...(signal.positive ?? []).slice(0, 1), ...(signal.negative ?? []).slice(0, 1)]
      .filter((s) => typeof s === "string")
      .map((s) => s.replace(/\bbindus?\s*(?:sirf\s*)?\d+(?:\/\d+)?\s*/gi, ""))
      .join(". ");
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
      (timing
        ? english
          ? "The reading shows the present support and challenges, but does not establish when the change will happen."
          : `${{ career: "Career mein badlav", money: "Paise ki sthiti mein sudhaar", marriage: "Rishta aage badhne" }[area]} ka waqt is reading se saaf nahi hai.`
        : english
          ? "These are broad chart factors; the tool does not rank specific career fields or choices."
          : "Yeh broad chart factors hain; tool specific fields ya choices ki ranking nahi deta.")
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
  if (language === "english") {
    return (
      (hasPeriod
        ? `The calculated ${current.lord} sub-period ends on ${current.to}. That is a period boundary, not a calculated date for the event you asked about.`
        : "The reading could not be reconciled with the returned chart evidence.") +
      "\n\nI cannot give a supported event date from these results."
    );
  }
  return (
    (hasPeriod
      ? `Calculation mein ${current.lord} antardasha ${current.to} tak hai. Yeh period ki boundary hai, aapke sawaal wale event ki calculated date nahi.`
      : "Reading ke daave aur chart ke results aapas mein match nahi hue.") +
    "\n\nIn results se event ki date tay nahi hoti."
  );
}
