import { hasPredictionGuarantee } from "./prediction-certainty.mjs";

const months =
  "January February March April May June July August September October November December".split(
    " ",
  );

// Admit an explicitly qualified interpretation of a returned period, not a
// calculated event date. Chart-claim validation still runs before this check.
export function isPeriodInterpretation(reply, data) {
  if (
    !/\b(?:interpretation|sambhavit|sambhavna|sambhav|may|could|potential|possible)\b|\bho sak(?:ta|ti|te)\b/i.test(
      reply,
    ) ||
    !/\b(?:because|kyunki|lord|swami|house|ghar|drishti|aspect)\b/i.test(reply) ||
    hasPredictionGuarantee(reply) ||
    /\b(?:zaroor|will (?:happen|marry)|ho(?:gi|ga) hi)\b/i.test(reply)
  ) {
    return false;
  }
  const dates = [
    ...reply.matchAll(new RegExp(`\\b(${months.join("|")})\\s+(20\\d{2})\\b`, "gi")),
  ].map(
    (m) =>
      `${m[2]}-${String(months.findIndex((v) => v.toLowerCase() === m[1].toLowerCase()) + 1).padStart(2, "0")}`,
  );
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
      dates.includes(from) &&
      dates.includes(to) &&
      dates.every((d) => d === from || d === to) &&
      [...reply.matchAll(/\b20\d{2}\b/g)].every((m) =>
        [from.slice(0, 4), to.slice(0, 4)].includes(m[0]),
      )
    );
  });
}
