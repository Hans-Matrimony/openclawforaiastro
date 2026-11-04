// Validate only explicit planet-period claims against structured tool periods.
// This does not infer event windows or judge chart interpretations.
export function unsupportedPeriodClaim(reply, toolResults) {
  const periods = [];
  const mahadashas = [];
  const currentMajor = [];
  const currentMinor = [];
  for (const raw of toolResults) {
    try {
      const data = JSON.parse(raw);
      if (data.dasha?.current_mahadasha?.lord) currentMajor.push(String(data.dasha.current_mahadasha.lord).toLowerCase());
      if (data.dasha?.current_antardasha?.lord) currentMinor.push(String(data.dasha.current_antardasha.lord).toLowerCase());
      for (const period of [data.dasha?.current_mahadasha, data.dasha?.next_mahadasha]) {
        if (period?.lord && period.from && period.to) mahadashas.push(period);
      }
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
  // A period mentioned as currently active must agree with the returned
  // current period, not an older conversation or another person's chart.
  if (new Set(currentMajor).size === 1 || new Set(currentMinor).size === 1) {
    const prose = reply.replace(/[“"][^”"]*[”"]/gu, '');
    for (const clause of prose.split(/[.!?\n]+/u)) {
      if (/\b(?:earlier|previously|said|not|nahi|nahin)\b/i.test(clause)) continue;
      for (const claim of clause.matchAll(/\bcurrent\s+(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\s+mahadasha\b/gi))
        if (new Set(currentMajor).size === 1 && claim[1].toLowerCase() !== currentMajor[0]) return true;
      if (new Set(currentMinor).size === 1) {
        const minorClaims = [
          ...clause.matchAll(/\bcurrent\s+(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\s+antardasha\b/gi),
          ...clause.matchAll(/\bcurrent\s+(?:Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\s+mahadasha\s+(?:and|with)\s+(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\s+antardasha\b/gi),
        ];
        if (minorClaims.some(claim => claim[1].toLowerCase() !== currentMinor[0])) return true;
      }
    }
  }
  if (!periods.length) {
    return false;
  }
  const planet = '(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)';
  const afterMajor = [
    new RegExp('\\b' + planet + '\\s+(?:ki\\s+)?mahadasha\\s+ke\\s+baad\\s+' + planet + '\\s+(?:ki\\s+)?antardasha\\b', 'gi'),
    new RegExp('\\bafter\\s+' + planet + '\\s+mahadasha[, ]+\\s*' + planet + '\\s+antardasha\\b', 'gi'),
  ];
  for (const pattern of afterMajor) for (const match of reply.matchAll(pattern)) {
    const major = mahadashas.filter(p => String(p.lord).toLowerCase() === match[1].toLowerCase());
    const minor = periods.filter(p => String(p.lord).toLowerCase() === match[2].toLowerCase());
    // A subperiod inside this mahadasha cannot be described as following it.
    if (major.length && minor.length && minor.every(p => major.some(m => p.from < m.to && p.from >= m.from))) return true;
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
    const afterYear = sentence.match(/\b(20\d{2})\s+ke\s+baad\b|\bafter\s+(20\d{2})\b/i);
    if (
      afterYear &&
      !matching.some(
        (p) =>
          !p.from || Number(String(p.from).slice(0, 4)) >= Number(afterYear[1] || afterYear[2]),
      )
    ) {
      return true;
    }
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
