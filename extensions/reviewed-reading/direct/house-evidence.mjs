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

export function sourceHouseRuler(chart, house) {
  return rulers[chart?.ashtakavarga_house_bindus?.[`house_${house}`]?.sign];
}

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
  const planetNames = "Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn";
  const pattern =
    /\b(?:house\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+house|(\d{1,2})(?:ve|we|ven)?\s+ghar)\s+(?:(?:ka|ke|ki)\s+)?(?:lord|swami)\s+(?:(?:is|hai)\s+)?(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn)\b/gi;
  for (const match of reply.matchAll(pattern)) {
    if (
      /^\s+(?:(?:hai|is)\s+)?(?:nahi|nahin|not)\b/i.test(reply.slice(match.index + match[0].length))
    ) {
      continue;
    }
    const house = Number(match[1] || match[2] || match[3]);
    const expected = rulers[charts[0][`house_${house}`]?.sign];
    if (expected && expected.toLowerCase() !== match[4].toLowerCase()) {
      conflicts.push({ house, expected, claimed: match[4] });
    }
  }
  // Adjacent reversed claims stay unambiguous even when another planet
  // appears earlier in the sentence ("Mars ... kyunki Jupiter house 7 ka lord hai").
  const adjacent = new RegExp(
    `\\b(${planetNames})\\s+(?:(?:is|the)\\s+)?(?:house\\s+(\\d{1,2})|(\\d{1,2})(?:st|nd|rd|th)\\s+house|(\\d{1,2})(?:ve|we|ven)?\\s+ghar)\\s+(?:(?:ka|ke|ki)\\s+)?(?:lord|swami)\\b`,
    "gi",
  );
  const lordship = new RegExp(
    `\\b(${planetNames})\\s+(?:(?:ka|ki|ke)\\s+)?(?:lordship|rulership)\\s+(?:of\\s+)?house\\s+(\\d{1,2})\\b`,
    "gi",
  );
  for (const expression of [adjacent, lordship]) {
    for (const match of reply.matchAll(expression)) {
      if (
        /^\s+(?:(?:hai|is)\s+)?(?:nahi|nahin|not)\b/i.test(
          reply.slice(match.index + match[0].length),
        )
      ) {
        continue;
      }
      const house = Number(match[2] || match[3] || match[4]);
      const expected = rulers[charts[0][`house_${house}`]?.sign];
      if (
        expected &&
        expected.toLowerCase() !== match[1].toLowerCase() &&
        !conflicts.some(
          (c) => c.house === house && c.claimed.toLowerCase() === match[1].toLowerCase(),
        )
      ) {
        conflicts.push({ house, expected, claimed: match[1] });
      }
    }
  }
  // Qwen also writes "Mars ... jo 7ve ghar ka lord hai". Bind this only
  // when the clause has exactly one planet; multi-planet comparisons are
  // ambiguous and must not be assigned to the wrong planet by a regex.
  for (const sentence of reply.split(/[.!?\n]+/)) {
    const names = [...sentence.matchAll(new RegExp(`\\b(${planetNames})\\b`, "gi"))];
    const unique = new Set(names.map((m) => m[1].toLowerCase()));
    if (unique.size !== 1 || /\b(?:not|nahi|nahin)\b/i.test(sentence)) {
      continue;
    }
    const claim =
      /\b(?:house\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+house|(\d{1,2})(?:ve|we|ven)?\s+ghar)\s+(?:ka|ke|ki)?\s*(?:lord|swami)\s+(?:hai|hain|is|banta|banti)\b/gi;
    for (const match of sentence.matchAll(claim)) {
      if (names[0].index > match.index) {
        continue;
      }
      const house = Number(match[1] || match[2] || match[3]);
      const expected = rulers[charts[0][`house_${house}`]?.sign];
      if (
        expected &&
        expected.toLowerCase() !== names[0][1].toLowerCase() &&
        !conflicts.some(
          (c) => c.house === house && c.claimed.toLowerCase() === names[0][1].toLowerCase(),
        )
      ) {
        conflicts.push({ house, expected, claimed: names[0][1] });
      }
    }
  }
  return conflicts;
}
