import { hasPredictionGuarantee } from "./prediction-certainty.mjs";

const months =
  "January February March April May June July August September October November December".split(
    " ",
  );
const monthNames = months
  .flatMap((name) => [name, name.slice(0, 3), ...(name === "September" ? ["Sept"] : [])])
  .join("|");

// Admit an explicitly qualified interpretation of a returned period, not a
// calculated event date. Chart-claim validation still runs before this check.
export function isPeriodInterpretation(reply, data) {
  if (
    !/\b(?:interpretation|sambhavit|sambhavna|sambhavana|sambhav|may|could|potential|possible)\b|\b(?:ho|ban) sak(?:ta|ti|te)\b/i.test(
      reply,
    ) ||
    !/\b(?:because|kyunki|lord|swami|house|ghar|drishti|aspect)\b/i.test(reply) ||
    hasPredictionGuarantee(reply) ||
    /\b(?:zaroor|will (?:happen|marry)|ho(?:gi|ga) hi)\b/i.test(reply)
  ) {
    return false;
  }
  const dates = [
    ...reply.matchAll(
      new RegExp(
        `\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+)?(${monthNames})\\.?\\s+(?:(\\d{1,2})(?:st|nd|rd|th)?,?\\s+)?(20\\d{2})\\b`,
        "gi",
      ),
    ),
  ].map((m) => ({
    month: `${m[4]}-${String(months.findIndex((v) => v.slice(0, 3).toLowerCase() === m[2].slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}`,
    day: m[1] || m[3] ? (m[1] ?? m[3]).padStart(2, "0") : null,
    invalid: Boolean(m[1] && m[3]),
  }));
  if (dates.length < 2 || /\b20\d{2}-\d{2}-\d{2}\b/.test(reply)) {
    return false;
  }
  const periods = data.flatMap((d) => d.dasha?.upcoming_antardashas ?? []);
  return periods.some((p) => {
    if (!/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(p.lord ?? "")) {
      return false;
    }
    const from = String(p.from ?? "").slice(0, 7),
      to = String(p.to ?? "").slice(0, 7);
    return (
      new RegExp(`\\b${p.lord}\\b`, "i").test(reply) &&
      dates.some((d) => d.month === from) &&
      dates.some((d) => d.month === to) &&
      // Abbreviations and full dates represent the same period. When a day is
      // supplied, it must match the actual boundary, not merely its month.
      dates.every(
        (d) =>
          !d.invalid &&
          [p.from, p.to].some(
            (boundary) =>
              String(boundary).slice(0, 7) === d.month &&
              (!d.day || String(boundary).slice(8, 10) === d.day),
          ),
      ) &&
      [...reply.matchAll(/\b20\d{2}\b/g)].every((m) =>
        [from.slice(0, 4), to.slice(0, 4)].includes(m[0]),
      )
    );
  });
}

// Keep a shortened verdict inside the window the model already selected in
// its explanation. This never chooses a period or adds an event prediction.
export function alignPeriodVerdict(reply, results) {
  const parts = reply.split(/\n\s*\n/);
  if (parts.length !== 2 || /```|https?:\/\//.test(reply)) {
    return reply;
  }
  const data = results.flatMap((text) => {
    try {
      const row = JSON.parse(text);
      return row?.engine === "local-sweph-v2" ? [row] : [];
    } catch {
      return [];
    }
  });
  if (!isPeriodInterpretation(reply, data)) {
    return reply;
  }
  const schedules = data.filter((row) => row.dasha);
  if (
    new Set(schedules.map((row) => JSON.stringify(row.dasha))).size !== 1 ||
    new Set(data.filter((row) => row.birth_chart).map((row) => JSON.stringify(row.birth_chart)))
      .size > 1
  ) {
    return reply;
  }
  const label = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      return null;
    }
    const parsed = new Date(date + "T00:00:00Z");
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
      ? `${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
      : null;
  };
  const matches = (schedules[0]?.dasha.upcoming_antardashas ?? []).flatMap((period) => {
    const from = label(period.from),
      to = label(period.to);
    if (
      !from ||
      !to ||
      period.from >= period.to ||
      !/^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)$/.test(period.lord ?? "") ||
      !parts[0].includes(from) ||
      !parts[0].includes(to) ||
      !new RegExp(`\\b${period.lord}\\b`).test(parts[0])
    ) {
      return [];
    }
    const prefix = new RegExp(
      `^${period.from.slice(0, 4)} ke baad ${period.lord} antardasha mein `,
      "i",
    );
    return prefix.test(parts[1]) &&
      /\bsambhavna|\bsambhavana|\bsambhavit|\b(?:ho|ban) sak(?:ta|ti|te)\b/i.test(parts[1])
      ? [{ prefix, from, to, lord: period.lord }]
      : [];
  });
  if (matches.length !== 1) {
    return reply;
  }
  const period = matches[0];
  parts[1] = parts[1].replace(
    period.prefix,
    `${period.from} se ${period.to} ke beech ${period.lord} antardasha mein `,
  );
  return parts.join("\n\n");
}
