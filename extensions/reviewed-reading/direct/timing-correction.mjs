import { fallbackFactor } from "./fallback-factors.mjs";
import { sourceHouseRuler } from "./house-evidence.mjs";
import { partnerFallback } from "./partner-fallback.mjs";
import { upcomingPeriods } from './returned-periods.mjs';
import { topicPeriodEvidence } from './topic-period-context.mjs';

// A bounded repair of an existing reading, never another calculation tool.
// Keep dates in code-owned slots so the model cannot replace a whole period
// with its start date, an invented month, or a promise about the event.
export function timingCorrection(results, query, language, asOf) {
  const subject = /sha+di|marriage|marry|married/i.test(query)
    ? ["shaadi", "marriage"]
    : /girlfriend|boyfriend|\bgf\b|\bbf\b|relationship|rishta/i.test(query)
      ? ["naya rishta", "a new relationship"]
      : /career|job|naukri/i.test(query)
        ? ["career", "career"]
        : /financ|money|pais|income/i.test(query)
          ? ["aarthik sudhaar", "financial improvement"]
          : null;
  if (!subject || !Number.isFinite(asOf.valueOf())) {
    return null;
  }
  const rows = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row.engine === "local-sweph-v2" ? [row] : [];
    } catch {
      return [];
    }
  });
  if (
    new Set(rows.filter((r) => r.dasha).map((r) => JSON.stringify(r.dasha))).size !== 1 ||
    new Set(rows.filter((r) => r.birth_chart).map((r) => JSON.stringify(r.birth_chart))).size > 1
  ) {
    return null;
  }
  const today = asOf.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const date = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
      ? parsed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      : null;
  };
  const schedule = rows.find((r) => r.dasha)?.dasha;
  const periods = upcomingPeriods(schedule).flatMap((p) => {
    if (!p || !/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(p.lord)) {
      return [];
    }
    const from = date(p.from),
      to = date(p.to);
    return from && to && p.from < p.to && p.from >= today ? [{ lord: p.lord, kind:p.kind, from, to }] : [];
  });
  if (!periods.length) {
    return null;
  }
  const area = ["shaadi", "naya rishta"].includes(subject[0])
    ? "marriage"
    : subject[0] === "career"
      ? "career"
      : "money";
  const signals = rows
    .flatMap((r) => (Array.isArray(r.verdict_signals) ? r.verdict_signals : []))
    .filter((s) => s?.area === area);
  if (!signals.length || new Set(signals.map((s) => JSON.stringify(s))).size !== 1) {
    return null;
  }
  const english = language === "english";
  const factors = ["positive", "negative"].flatMap((polarity) =>
    (Array.isArray(signals[0][polarity]) ? signals[0][polarity] : []).flatMap((source) => {
      const text = fallbackFactor(source, english, area);
      return text ? [{ source, text, polarity }] : [];
    }),
  );
  // A checked house ruler establishes topic relevance even when the current
  // period's signal list does not mention that future period lord. Keep it
  // distinct from a positive forecast and retain the existing contrary factors.
  const periodEvidence = topicPeriodEvidence(results, query);
  for (const period of periodEvidence?.periods ?? []) {
    for (const house of period.relevant_house_lord) {
      const source = `${period.lord} is the natal lord of house ${house}`;
      if (!factors.some(f => f.source === source)) factors.push({source, polarity:'relevance',
        text:english ? `${period.lord} rules natal house ${house}`
          : `${period.lord} ${house}ve ghar ke swami hain`});
    }
  }
  if (!factors.length) {
    return null;
  }
  const name = "submit_timing_reading";
  const keys = ["period_id", "outlook", "factor_ids"];
  return {
    name,
    evidence: rows,
    instruction:
      "Submit the corrected reading with submit_timing_reading. This replaces the free-text correction, not the chart calculation. " +
      "Choose a period ONLY if its lord has a checked, topic-specific chart reason; do not select the first period merely because it is next. " +
      "Current verdict signals are not future-period scores. Preserve adverse factors. An outlook is an interpretation, not a calculated event prediction. " +
      "Review relevant unfavorable periods too, retaining their exact boundaries and unfavorable outlook; do not select none solely because the checked relationship is adverse. " +
      "Do not reuse an earlier assistant date or rationale. A period lord is not automatically the house lord. " +
      "If the evidence cannot support a period interpretation, select none and undetermined. " +
      "Select one to three factor_ids from the list; at least one must mention the selected period lord and its relevant chart relationship. " +
      "Do not write new chart prose. The application renders the selected checked factors, retains opposing factors and requested partner nature, and inserts the exact period boundaries and qualification. Available periods: " +
      JSON.stringify(periods.map((p, i) => ({ id: `p${i}`, ...p }))) +
      "\nChecked topic factors: " +
      JSON.stringify(
        factors.map((f, i) => ({ id: `f${i}`, source: f.source, polarity: f.polarity })),
      ) +
      "\nHouse lords derived from the returned house signs (not a forecast): " +
      JSON.stringify(
        Array.from({ length: 12 }, (_, i) => ({
          house: i + 1,
          lord: sourceHouseRuler(rows.find((r) => r.birth_chart)?.birth_chart, i + 1),
        })).filter((r) => r.lord),
      ),
    tool: {
      type: "function",
      function: {
        name,
        description: "Return a checked interpretation of the existing chart and period evidence.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: keys,
          properties: {
            period_id: { type: "string", enum: ["none", ...periods.map((_, i) => `p${i}`)] },
            outlook: { type: "string", enum: ["possible", "unfavorable", "mixed", "undetermined"] },
            factor_ids: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", enum: factors.map((_, i) => `f${i}`) },
            },
          },
        },
      },
    },
    fallback() {
      // Never choose the next period just because its boundary is known. A
      // unique period linked to a returned positive topic factor can retain a
      // qualified interpretation; multiple candidates remain undetermined.
      const candidates = periods.flatMap((period, index) => {
        const factor = factors.findIndex(f => f.polarity === 'positive' &&
          new RegExp(`\\b${period.lord}\\b`, 'i').test(f.source));
        return factor < 0 ? [] : [{index, factor}];
      });
      const selected = candidates.length === 1 ? candidates[0] : null;
      const outlook = signals[0].trend === 'NEGATIVE' ? 'unfavorable'
        : factors.some(f=>f.polarity==='negative') ? 'mixed' : 'possible';
      const data = selected
        ? {period_id:`p${selected.index}`,outlook,factor_ids:[`f${selected.factor}`]}
        : {period_id:'none',outlook:'undetermined',factor_ids:['f0']};
      return this.render({tool_calls:[{function:{name,arguments:JSON.stringify(data)}}]}, {includePartner:false});
    },
    render(message, {includePartner = true} = {}) {
      const calls = message?.tool_calls;
      if (!Array.isArray(calls) || calls.length !== 1 || calls[0].function?.name !== name) {
        return null;
      }
      let data;
      try {
        data = JSON.parse(calls[0].function.arguments);
      } catch {
        return null;
      }
      if (
        !data ||
        Array.isArray(data) ||
        Object.keys(data).some((k) => !keys.includes(k)) ||
        typeof data.period_id !== "string" ||
        typeof data.outlook !== "string" ||
        !Array.isArray(data.factor_ids) ||
        data.factor_ids.length < 1 ||
        data.factor_ids.length > 3 ||
        new Set(data.factor_ids).size !== data.factor_ids.length ||
        data.factor_ids.some(
          (id) => typeof id !== "string" || !/^f\d+$/.test(id) || !factors[Number(id.slice(1))],
        )
      ) {
        return null;
      }
      const selected = data.factor_ids.map((id) => factors[Number(id.slice(1))]);
      // Do not silently erase contrary evidence to produce a more positive or
      // negative reading. These are existing tool factors, not new scores.
      for (const polarity of ["positive", "negative"]) {
        const missing = factors.find((f) => f.polarity === polarity);
        if (missing && !selected.some((f) => f.polarity === polarity)) {
          selected.push(missing);
        }
      }
      const explanation = selected.map((f) => f.text.replace(/[.!?]+$/, "") + ".").join(" ");
      const partner = includePartner && area === "marriage" ? partnerFallback(rows, language, query) : "";
      const first = explanation + (partner ? " " + partner : "");
      if (data.period_id === "none") {
        if (data.outlook !== "undetermined") {
          return null;
        }
        return (
          first +
          "\n\n" +
          (area === 'career'
            ? english ? "I can't identify a clear career-settling date from these indications."
              : 'Career settle hone ka exact waqt abhi saaf nahi hai.'
            : english
            ? `This reading does not establish a supported period for ${subject[1]}; that does not mean it cannot happen.`
            : `${/job|naukri/i.test(query) ? "Naukri" : subject[0]} ke liye is reading se koi supported samay tay nahi hota; iska matlab yeh nahi ki yeh hoga hi nahi.`)
        );
      }
      if (!/^p\d+$/.test(data.period_id)) {
        return null;
      }
      const period = periods[Number(data.period_id.slice(1))];
      if (
        !period ||
        !data.factor_ids.some((id) =>
          new RegExp(`\\b${period.lord}\\b`, "i").test(factors[Number(id.slice(1))].source),
        ) ||
        (data.outlook === "possible" && !factors.some((f) => f.polarity === "positive")) ||
        (data.outlook === "unfavorable" && !factors.some((f) => f.polarity === "negative"))
      ) {
        return null;
      }
      const verdict = english
        ? {
            possible: `${subject[1]} may be supported`,
            unfavorable: `prospects for ${subject[1]} may be limited`,
            mixed: `${subject[1]} may be possible, with obstacles`,
          }[data.outlook]
        : {
            possible: `${subject[0]}${area === "marriage" ? " hone" : ""} ki sambhavna hai`,
            unfavorable: `${subject[0]}${area === "marriage" ? " hone" : ""} ki sambhavna kam hai`,
            mixed: `${subject[0]} sambhavit hai, lekin rukawatein bhi hain`,
          }[data.outlook];
      if (!verdict) {
        return null;
      }
      const timing = english
        ? `${period.from} to ${period.to} (${period.lord} ${period.kind}): ${verdict}.`
        : `${period.lord} ki ${period.kind} mein ${period.from} se ${period.to} ke beech ${verdict}.`;
      if (period.kind === 'mahadasha') {
        const interpretation = english
          ? {possible:`${subject[1]} may receive support`,mixed:`${subject[1]} may have support and obstacles`,unfavorable:`support for ${subject[1]} may be limited`}[data.outlook]
          : {possible:`${subject[0]} ko sahyog mil sakta hai`,mixed:`${subject[0]} mein sahyog aur rukawat dono sambhav hain`,unfavorable:`${subject[0]} mein sahyog kam reh sakta hai`}[data.outlook];
        return `${first}\n\n${period.lord} mahadasha, ${period.from} ${english?'to':'se'} ${period.to}: ${interpretation}. ${english?'This does not require waiting.':'Tab tak rukna zaroori nahi.'}`;
      }
      return `${first}\n\n${timing}`;
    },
  };
}
