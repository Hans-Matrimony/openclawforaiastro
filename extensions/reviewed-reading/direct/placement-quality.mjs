const names = {
  sun: "Sun",
  surya: "Sun",
  moon: "Moon",
  chandra: "Moon",
  mars: "Mars",
  mangal: "Mars",
  mercury: "Mercury",
  budh: "Mercury",
  jupiter: "Jupiter",
  guru: "Jupiter",
  brihaspati: "Jupiter",
  venus: "Venus",
  shukra: "Venus",
  saturn: "Saturn",
  shani: "Saturn",
  rahu: "Rahu",
  ketu: "Ketu",
};
const planet =
  /\b(sun|surya|moon|chandra|mars|mangal|mercury|budh|jupiter|guru|brihaspati|venus|shukra|saturn|shani|rahu|ketu)\b/gi;

// Check direct occupancy claims only. Lords, aspects and uncertain subjects are
// different relationships; this deliberately does not claim full semantic QA.
export function unsupportedHouseClaim(reply, packets) {
  const natal = new Map(),
    transit = new Map();
  const add = (map, name, house) => {
    map.set(name, map.has(name) && map.get(name) !== house ? null : house);
  };
  for (const packet of packets) {
    for (const row of packet?.birth_chart?.planets ?? []) {
      const match = /^(\w+):[^]*?\| house (\d+)\b/.exec(row);
      if (match) {
        add(natal, match[1], Number(match[2]));
      }
    }
    for (const row of packet?.gochara ?? []) {
      if (typeof row.planet === "string" && Number.isInteger(row.over_natal_house)) {
        add(transit, row.planet, row.over_natal_house);
      }
    }
  }
  for (const clause of reply.split(/[.!?\n;।]/)) {
    const match =
      /(?:\b(1[0-2]|[1-9])(?:st|nd|rd|th)?\s+(?:house|ghar)|\b(?:house|ghar)\s+(1[0-2]|[1-9]))\s+(?:(?:mein|me|mein hi|in|are|is|hain|hai)\b)/i.exec(
        clause,
      );
    if (!match) {
      continue;
    }
    const before = clause.slice(0, match.index);
    if (/\b(?:drishti|aspect|nazar|lord|swami|ruler)\b/i.test(before)) {
      continue;
    }
    const allMentioned = [...before.matchAll(planet)].map((m) => names[m[1].toLowerCase()]);
    const mentioned = /\b(?:dono|both)\b/i.test(before) ? allMentioned : allMentioned.slice(-1);
    const house = Number(match[1] ?? match[2]);
    const current = /\b(?:transit|transits|gochar|gochara)\b/i.test(clause);
    const birth = /\b(?:natal|birth|janm|kundli|kundali|chart)\b/i.test(clause);
    for (const name of new Set(mentioned)) {
      const known = current
        ? [transit.get(name)]
        : birth
          ? [natal.get(name)]
          : [natal.get(name), transit.get(name)];
      const available = known.filter(Number.isInteger);
      if (available.length && !available.includes(house)) {
        return `The stated house of ${name} does not match this turn's calculated placements. Keep natal occupancy, current transits, house lords and aspects separate.`;
      }
    }
  }
  return null;
}
