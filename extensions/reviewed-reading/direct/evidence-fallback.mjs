import { fallbackFactor } from "./fallback-factors.mjs";
import { periodFallback } from "./period-fallback.mjs";
import { asksForTiming } from "./reading-intent.mjs";
import { timingCorrection } from "./timing-correction.mjs";
import { chartClarificationFallback } from './chart-grounding.mjs';
import {foreignChartSummary} from './foreign-reading.mjs';

const UNVERIFIED_EN = "I couldn't verify this answer right now. Please try again shortly.";
const UNVERIFIED_HI = "Abhi is jawab ko verify nahi kar paayi. Thodi der baad phir check karte hain.";
export const isUnverifiedReadingReply = reply => reply === UNVERIFIED_EN || reply === UNVERIFIED_HI;

// A failed bounded correction must not become a transport failure or publish
// the rejected prediction. This fallback uses only returned period facts.
export function evidenceFallback(results, language, query = "", asOf = new Date(), {topic} = {}) {
  const foreign=foreignChartSummary(results,language,query);
  if(foreign)return foreign;
  const english = language === "english";
  const area = topic === 'relationship' ? 'marriage' : /career|job|work|naukri|fields?/i.test(query)
    ? "career"
    : /financ|money|pais|income/i.test(query)
      ? "money"
      : /sha+di|vivah|marriage|marry|married|wedding|partner/i.test(query)
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
  if (topic === 'relationship' && !['POSITIVE','NEGATIVE','MIXED'].includes(signal?.trend)) {
    return english ? UNVERIFIED_EN : UNVERIFIED_HI;
  }
  const assessment = topic === 'relationship' && signal ? (english ? {
    POSITIVE:'The calculated relationship indications are supportive.',
    NEGATIVE:'The calculated relationship indications are challenging.',
    MIXED:'The calculated relationship indications are mixed, with support and obstacles.'
  } : {
    POSITIVE:'Rishte ko aage badhne ka sahyog dikh raha hai.',
    NEGATIVE:'Rishte ko aage badhane mein rukawaton ke sanket zyada hain.',
    MIXED:'Rishte ko aage badhne ka sahyog bhi hai aur rukawatein bhi.'
  })[signal.trend] : '';
  if (area && asksForTiming(query)) {
    const checked = timingCorrection(results, query, language, asOf, {topic})?.fallback();
    // Keep a qualified interpretation when available; otherwise the repair
    // preserves calculated dates as schedule context, not an event promise.
    if (checked) return assessment ? assessment+' '+checked : checked;
    if (!signal) return english ? UNVERIFIED_EN : UNVERIFIED_HI;
  }
  const clarification = chartClarificationFallback(results, language, query);
  if (clarification) return clarification;
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
    if (topic === 'relationship' && !timing) return assessment + (factors ? ' '+factors+'.' : '');
    const leadIn = {
      career: english ? "Career timing" : "Career ka waqt",
      money: english ? "Money timing" : "Paise ki sthiti",
      marriage: english ? "Relationship timing" : "Shaadi ka samay",
    }[area];
    const checkedSchedule = periodFallback(rows, language, asOf);
    const timingLine = checkedSchedule
      ? checkedSchedule
      : english
      ? `${leadIn}: this reading does not establish a supported event window.`
      : `${leadIn}: is reading se koi supported samay tay nahi hota.`;
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
  if (checkedSchedule && (!query || asksForTiming(query))) {
    return checkedSchedule;
  }
  return english ? UNVERIFIED_EN : UNVERIFIED_HI;
}
