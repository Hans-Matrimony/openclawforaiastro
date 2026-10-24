// Validate only explicit planet-period claims against structured tool periods.
// This does not infer event windows or judge chart interpretations.
export function unsupportedPeriodClaim(reply, toolResults) {
  const periods = [];
  for (const raw of toolResults) {
    try {
      const data = JSON.parse(raw);
      if (data.dasha?.current_antardasha) {
        periods.push(data.dasha.current_antardasha);
      }
      if (Array.isArray(data.dasha?.antardashas)) {
        periods.push(...data.dasha.antardashas);
      }
      if (Array.isArray(data.dasha?.upcoming_antardashas)) {
        periods.push(...data.dasha.upcoming_antardashas);
      }
    } catch {
      /* Non-JSON tools cannot establish a period schedule. */
    }
  }
  if (!periods.length) {
    return false;
  }
  const claim =
    /\b(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\s+(?:ki\s+)?antardasha\s+(?:shuru|starts?|begins?)\b/gi;
  for (const match of reply.matchAll(claim)) {
    const matching = periods.filter((p) => String(p.lord).toLowerCase() === match[1].toLowerCase());
    if (!matching.length) {
      return true;
    }
    const start =
      Math.max(reply.lastIndexOf(".", match.index), reply.lastIndexOf("\n", match.index)) + 1;
    const tail = reply.slice(match.index).search(/[.\n]/);
    const sentence = reply.slice(start, tail < 0 ? undefined : match.index + tail);
    // Check explicit month/year starts without treating a later event date as
    // the period start ("after the period starts, finances improve in ...").
    const months =
      "January February March April May June July August September October November December".split(
        " ",
      );
    const monthPattern = months.join("|");
    const datedStart =
      sentence.match(
        new RegExp(
          `(?:starts?|begins?|shuru\\s+(?:hogi|hoga))\\s+(?:in\\s+)?(${monthPattern})\\s+(20\\d{2})`,
          "i",
        ),
      ) ||
      sentence.match(
        new RegExp(
          `(${monthPattern})\\s+(20\\d{2})\\s+(?:mein|me|se)\\s+.*antardasha\\s+shuru`,
          "i",
        ),
      );
    if (datedStart) {
      const month = String(
        months.findIndex((m) => m.toLowerCase() === datedStart[1].toLowerCase()) + 1,
      ).padStart(2, "0");
      if (!matching.some((p) => String(p.from ?? "").startsWith(`${datedStart[2]}-${month}`))) {
        return true;
      }
    }
    // A bare "after YEAR" is not an exact start date; validate explicit in-YEAR claims only.
    const year = sentence.match(/\b(20\d{2})\s+(?:mein|me)\b|\bin\s+(20\d{2})\b/i);
    if (year && !matching.some((p) => String(p.from ?? "").startsWith(year[1] || year[2]))) {
      return true;
    }
  }
  return false;
}
