import { fallbackFactor } from "./fallback-factors.mjs";
import { periodFallback } from "./period-fallback.mjs";
import { asksForTiming } from "./reading-intent.mjs";

// A failed bounded correction must not become a transport failure or publish
// the rejected prediction. This fallback uses only returned period facts.
export function evidenceFallback(results, language, query = "", asOf = new Date()) {
  const english = language === "english";
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
  const signals = rows
    .flatMap((d) => (Array.isArray(d.verdict_signals) ? d.verdict_signals : []))
    .filter((s) => s?.area === area);
  const subjects = new Set(
    rows.filter((r) => r.birth_chart).map((r) => JSON.stringify(r.birth_chart)),
  );
  // Never combine conflicting readings or different subjects into one verdict.
  const signal =
    subjects.size <= 1 && signals.every((s) => JSON.stringify(s) === JSON.stringify(signals[0]))
      ? signals[0]
      : null;
  if (signal && ["POSITIVE", "NEGATIVE", "MIXED"].includes(signal.trend)) {
    const label = { career: "Career", money: "Finance", marriage: "Relationship" }[area];
    const trend = { POSITIVE: "supportive", NEGATIVE: "challenging", MIXED: "mixed" }[signal.trend];
    const timing = asksForTiming(query);
    const factors = [signal.positive, signal.negative]
      .map((items) =>
        (Array.isArray(items) ? items : []).map((s) => fallbackFactor(s, english)).find(Boolean),
      )
      .filter(Boolean)
      .join(english ? ", while " : ", lekin ");
    const leadIn = {
      career: english ? "Career timing" : "Career ka waqt",
      money: english ? "Money timing" : "Paise ki sthiti",
      marriage: english ? "Relationship timing" : "Shaadi ka samay",
    }[area];
    const checkedSchedule = periodFallback(rows, language, asOf);
    const timingLine = checkedSchedule
      ? `${leadIn}: ${checkedSchedule}`
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
      (timing
        ? timingLine
        : english
          ? area === "career"
            ? "This reading does not identify one career field as better than the others."
            : `The ${label.toLowerCase()} reading has ${trend} indications.`
          : area === "career"
            ? "Is reading mein kisi ek career field ko baaki se behtar batane ka aadhar nahi mila."
            : `${label} ki reading mein ${trend} sanket hain.`)
    );
  }
  const checkedSchedule = periodFallback(rows, language, asOf);
  if (checkedSchedule) {
    return checkedSchedule;
  }
  return english
    ? "The reading could not be reconciled with the returned chart evidence."
    : "Reading ke daave aur chart ke results aapas mein match nahi hue.";
}
