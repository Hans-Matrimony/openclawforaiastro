// Check explicit house-lord claims against the source chart, not prior replies.
// This does not score predictions or change the calculation engine.
const rulers = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

export function houseLordConflicts(reply, results) {
  const charts = results.flatMap((text) => {
    try {
      const data = JSON.parse(text);
      const houses = data.birth_chart?.ashtakavarga_house_bindus;
      return houses && data.engine === "local-sweph-v2" ? [houses] : [];
    } catch {
      return [];
    }
  });
  // Do not conflate charts belonging to different people in a comparison.
  if (
    !charts.length ||
    charts.some((chart) => JSON.stringify(chart) !== JSON.stringify(charts[0]))
  ) {
    return [];
  }
  const conflicts = [];
  const pattern =
    /\b(?:house\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+house)\s+(?:(?:ka|ke|ki)\s+)?(?:lord|swami)\s+(?:(?:is|hai)\s+)?(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn)\b/gi;
  for (const match of reply.matchAll(pattern)) {
    const house = Number(match[1] || match[2]);
    const expected = rulers[charts[0][`house_${house}`]?.sign];
    if (expected && expected.toLowerCase() !== match[3].toLowerCase()) {
      conflicts.push({ house, expected, claimed: match[3] });
    }
  }
  return conflicts;
}
