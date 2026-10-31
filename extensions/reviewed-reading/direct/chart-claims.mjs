import { sourceHouseRuler } from "./house-evidence.mjs";
// Validate explicit claims only. Do not infer predictions from period boundaries.
const planets = "Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu";

export function chartClaimConflicts(reply, results) {
  // Normalize equivalent house labels for validation only; never rewrite the answer.
  reply = reply.replace(/\b(\d{1,2})(?:ve|ven|va|wa|we|th|st|nd|rd)?\s+ghar\b/gi, "$1th house");
  const data = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row.engine === "local-sweph-v2" ? [row] : [];
    } catch {
      return [];
    }
  });
  if (!data.length) {
    return [];
  }
  const conflicts = [];
  // These tools list selected signals, not an exhaustive ranking of every factor.
  for (const sentence of reply.split(/[.!?\n]+/)) {
    if (/\b(?:only|sole|ekmatra)\s+(?:positive|supportive|favourable|favorable)\s+(?:factor|signal|indicator)\b/i.test(sentence) &&
        !/\b(?:not|isn't|is not|nahi|nahin|cannot|can't)\b/i.test(sentence)) {
      conflicts.push({ type: "unsupported_exclusive_factor", reason: "Selected chart signals do not establish that this is the only supportive factor. Preserve the supported period, describe a relevant factor without an exhaustive claim." });
    }
  }
  const linkedLord = new RegExp(
    "\\b(" +
      planets +
      ")\\s+(?:ek|a|an)\\s+(?:benefic|malefic)\\s+(?:hai|is)?\\s*(?:aur|and)\\s+(\\d{1,2})(?:st|nd|rd|th)\\s+house\\s+(?:ka|ke|ki)\\s+lord",
    "gi",
  );
  for (const match of reply.matchAll(linkedLord)) {
    const expected = [
      ...new Set(
        data.map((d) => sourceHouseRuler(d.birth_chart, Number(match[2]))).filter(Boolean),
      ),
    ];
    if (expected.length === 1 && expected[0] !== match[1]) {
      conflicts.push({
        type: "linked_house_lord",
        expected: expected[0],
        claimed: match[1],
        house: Number(match[2]),
      });
    }
  }
  // These tools expose natal/current positions, not future aspect start dates.
  const futureAspect = new RegExp(
    "\\b(?:jab|when)\\s+(" +
      planets +
      ")\\s+(?:ki\\s+)?(?:drishti|aspect)[^.!?\\n]{0,100}\\b(?:aayeg[ai]|aega|aegi|will|start|begin)\\b",
    "gi",
  );
  for (const match of reply.matchAll(futureAspect)) {
    conflicts.push({
      type: "unsupported_future_aspect",
      planet: match[1],
      reason:
        "A natal aspect does not begin at an antardasha boundary; no future transit evidence was returned.",
    });
  }
  const transits = data.filter((d) => Array.isArray(d.gochara));
  const schedules = data.filter((d) => d.dasha?.upcoming_antardashas);
  // Also recognize reversed Hinglish placement wording from live output.
  const reversedPlacement = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)\\s+house\\s+(?:ke|mein|me)\\s+(?:strong\\s+)?(${planets})\\b(?!\\s+ki\\s+drishti)`,
    "gi",
  );
  for (const match of reply.matchAll(reversedPlacement)) {
    const positions = data.flatMap((d) =>
      (d.birth_chart?.planets ?? []).flatMap((p) => {
        const found = new RegExp(`^${match[2]}:.*?\\| house (\\d+)\\b`, "i").exec(p);
        return found ? [Number(found[1])] : [];
      }),
    );
    const current = transits.flatMap((d) =>
      d.gochara
        .filter((p) => p.planet.toLowerCase() === match[2].toLowerCase())
        .map((p) => p.over_natal_house),
    );
    if (positions.length && ![...positions, ...current].includes(Number(match[1]))) {
      conflicts.push({
        type: "planet_house",
        planet: match[2],
        claimed: Number(match[1]),
        expected: [...new Set([...positions, ...current])],
      });
    }
  }
  // Bind the planet names to the placement clause instead of assigning every
  // planet mentioned anywhere in a paragraph to its first house number.
  const placement = new RegExp(
    `\\b(${planets})(?:\\s+(?:aur|and)\\s+(${planets}))?\\s+(?:dono\\s+|both\\s+|natal\\s+|currently\\s+|is\\s+|are\\s+|in\\s+|the\\s+)*(?:house\\s+(\\d{1,2})|(\\d{1,2})(?:st|nd|rd|th)\\s+house)\\s+(?:mein|me|in|hai|hain|is|are|baitha|placed)\\b`,
    "gi",
  );
  for (const match of reply.matchAll(placement)) {
    const claimed = Number(match[3] || match[4]);
    for (const name of [match[1], match[2]].filter(Boolean)) {
      const natal = data.flatMap((d) =>
        (d.birth_chart?.planets ?? []).flatMap((p) => {
          const parsed = new RegExp(`^${name}:.*?\\| house (\\d+)\\b`, "i").exec(p);
          return parsed ? [Number(parsed[1])] : [];
        }),
      );
      const current = transits.flatMap((d) =>
        d.gochara
          .filter((p) => p.planet.toLowerCase() === name.toLowerCase())
          .map((p) => p.over_natal_house),
      );
      const allowed = /\bnatal\b/i.test(match[0]) ? natal : [...natal, ...current];
      if (natal.length && allowed.length && !allowed.includes(claimed)) {
        conflicts.push({
          type: "planet_house",
          planet: name,
          claimed,
          expected: [...new Set(allowed)],
        });
      }
    }
  }
  for (const sentence of reply.split(/[.!?\n]+/)) {
    // Ambiguous multi-house comparisons and negated claims need semantic review,
    // not a regex verdict assigning every planet to the first house mentioned.
    const housesMentioned = [
      ...sentence.matchAll(/\bhouse\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)\s+house\b/gi),
    ];
    // Aspects and natal placements must not be interpreted as transit claims.
    if (
      /\btransit(?:s|ing)?\b|\bgochar\b|\bja rahe\b/i.test(sentence) &&
      !/\baspect|drishti/i.test(sentence)
    ) {
      const house = /\bhouse\s+(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+house\b/i.exec(sentence);
      const names = [...sentence.matchAll(new RegExp(`\\b(${planets})\\b`, "gi"))].map((m) => m[1]);
      if (house && housesMentioned.length === 1 && !/\b(?:not|nahi|nahin)\b/i.test(sentence)) {
        const claimed = Number(house[1] || house[2]);
        for (const name of new Set(names)) {
          const positions = transits.flatMap((d) =>
            d.gochara.filter((p) => p.planet.toLowerCase() === name.toLowerCase()),
          );
          if (!positions.length || positions.every((p) => p.over_natal_house !== claimed)) {
            conflicts.push({
              type: "transit_house",
              planet: name,
              claimed,
              expected: positions.length
                ? [...new Set(positions.map((p) => p.over_natal_house))]
                : "No current transit tool evidence",
            });
          }
        }
      }
    }
    const sequence = new RegExp(
      `\\b(${planets})\\s+(?:ki\\s+)?antardasha\\s+ke\\s+baad\\s+(${planets})\\s+(?:ka|ki)?\\s*antardasha`,
      "gi",
    );
    for (const match of sentence.matchAll(sequence)) {
      for (const row of schedules) {
        const periods = [row.dasha.current_antardasha, ...row.dasha.upcoming_antardashas].filter(
          Boolean,
        );
        const index = periods.findIndex((p) => p.lord.toLowerCase() === match[1].toLowerCase());
        if (
          index >= 0 &&
          periods[index + 1] &&
          periods[index + 1].lord.toLowerCase() !== match[2].toLowerCase()
        ) {
          conflicts.push({
            type: "period_sequence",
            after: match[1],
            expected: periods[index + 1].lord,
            claimed: match[2],
          });
        }
      }
    }
  }
  return conflicts;
}
