import { fallbackFactor } from "./fallback-factors.mjs";
import { sourceHouseRuler } from "./house-evidence.mjs";
import { partnerFallback } from "./partner-fallback.mjs";

// A bounded repair of an existing reading, never another calculation tool.
// Keep dates in code-owned slots so the model cannot replace a whole period
// with its start date, an invented month, or a promise about the event.
export function timingCorrection(results, query, language, asOf) {
  const subject = /sha+di|marriage|marry|married/i.test(query)
    ? ["shaadi", "marriage"]
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
  const periods = (
    Array.isArray(schedule?.upcoming_antardashas) ? schedule.upcoming_antardashas : []
  ).flatMap((p) => {
    if (!p || !/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(p.lord)) {
      return [];
    }
    const from = date(p.from),
      to = date(p.to);
    return from && to && p.from < p.to && p.from >= today ? [{ lord: p.lord, from, to }] : [];
  });
  if (!periods.length) {
    return null;
  }
  const area = subject[0] === "shaadi" ? "marriage" : subject[0] === "career" ? "career" : "money";
  const signals = rows
    .flatMap((r) => (Array.isArray(r.verdict_signals) ? r.verdict_signals : []))
    .filter((s) => s?.area === area);
  if (!signals.length || new Set(signals.map((s) => JSON.stringify(s))).size !== 1) {
    return null;
  }
  const english = language === "english";
  const factors = ["positive", "negative"].flatMap((polarity) =>
    (Array.isArray(signals[0][polarity]) ? signals[0][polarity] : []).flatMap((source) => {
      const text = fallbackFactor(source, english);
      return text ? [{ source, text, polarity }] : [];
    }),
  );
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
    render(message) {
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
      const partner = area === "marriage" ? partnerFallback(rows, language, query) : "";
      const first = explanation + (partner ? " " + partner : "");
      if (data.period_id === "none") {
        if (data.outlook !== "undetermined") {
          return null;
        }
        return (
          first +
          "\n\n" +
          (english
            ? "These factors do not establish an event year."
            : "In sanketon se abhi ek saal tay nahi hota.")
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
        ? `${period.from} to ${period.to} (${period.lord} antardasha): ${verdict}.`
        : `${period.lord} ki antardasha mein ${period.from} se ${period.to} ke beech ${verdict}.`;
      return `${first}\n\n${timing}`;
    },
  };
}
