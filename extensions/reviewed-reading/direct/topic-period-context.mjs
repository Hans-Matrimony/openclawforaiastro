import { sourceHouseRuler } from "./house-evidence.mjs";

// Expose natal relationships for comparison, not invented event scores or dates.
export function topicPeriodEvidence(results, query) {
  const topics = [
    ["marriage", /sha+di|marri|wedding/i, [7]],
    ["relationship", /girlfriend|boyfriend|\bgf\b|\bbf\b|crush|relationship|rishta/i, [5, 7]],
    ["career", /career|job|naukri|promotion/i, [10]],
    ["money", /financ|money|pais|income|salary/i, [2, 11]],
    ["education", /education|stud|exam|padh|parhai/i, [4, 5, 9]],
  ].filter(([, pattern]) => pattern.test(query));
  if (topics.length !== 1) {
    return "";
  }
  const [topic, , houses] = topics[0];
  const rows = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row.engine === "local-sweph-v2" ? [row] : [];
    } catch {
      return [];
    }
  });
  const charts = rows.filter((r) => r.birth_chart).map((r) => r.birth_chart);
  const schedules = rows.filter((r) => r.dasha).map((r) => r.dasha);
  if (
    new Set(charts.map(JSON.stringify)).size !== 1 ||
    new Set(schedules.map(JSON.stringify)).size !== 1
  ) {
    return "";
  }
  const chart = charts[0];
  const signals = rows
    .flatMap((r) => r.verdict_signals ?? [])
    .filter((s) => s.area === (topic === "relationship" ? "marriage" : topic));
  const periods = (schedules[0].upcoming_antardashas ?? []).map((period) => {
    const placement = (chart.planets ?? []).find(
      (p) => typeof p === "string" && p.startsWith(period.lord + ":"),
    );
    const house = Number(placement?.match(/\| house (\d+)\b/)?.[1]);
    return {
      ...period,
      natal_placement: placement ?? null,
      relevant_house_lord: houses.filter((h) => sourceHouseRuler(chart, h) === period.lord),
      occupies_relevant_house: houses.includes(house) ? house : null,
      supportive_factors: [...new Set(signals.flatMap((s) => s.positive ?? []))].filter((f) =>
        new RegExp(`\\b${period.lord}\\b`).test(f),
      ),
      adverse_factors: [...new Set(signals.flatMap((s) => s.negative ?? []))].filter((f) =>
        new RegExp(`\\b${period.lord}\\b`).test(f),
      ),
    };
  });
  if (!periods.length) {
    return "";
  }
  return { topic, houses, periods };
}

export function topicPeriodContext(results, query) {
  const evidence = topicPeriodEvidence(results, query);
  if (!evidence) {
    return "";
  }
  return (
    "\nTopic-specific period comparison (derived natal facts, not future transit calculations): " +
    JSON.stringify(evidence) +
    "\nCompare these candidates before choosing a window. Chronological order is not a ranking. " +
    "A pressure/delay factor does not become positive because its planet's period begins. " +
    "Natal aspects do not start on antardasha boundaries. Do not invent future transits. " +
    "Prefer a candidate with actual supportive topic evidence over one supported only by delay factors; retain contrary evidence. " +
    "House ownership/occupancy establishes relevance, not guaranteed success. If none is supported, do not manufacture a date. " +
    "Do not copy an earlier topic's year, and do not force different years merely for variety. " +
    "Lead with the question's conclusion, explain briefly, and keep the second bubble a short verdict within that same window. " +
    "Use natural Hinglish, not an ISO schedule or repeated disclaimer. One natural qualification is enough."
  );
}

// An unrelated or negative-only natal link cannot justify a positive event window.
export function unsupportedTopicOpportunity(reply, results, query) {
  const evidence = topicPeriodEvidence(results, query);
  if (
    !evidence ||
    !/sambhavn?a|sambhavana|sambhavit|possible|opportunity|mauka|ban sak|ho sak|improv|sudhar|lagegi|lagega|hogi|hoga/i.test(
      reply,
    )
  ) {
    return false;
  }
  return evidence.periods.some((p) => {
    const named = new RegExp("\\b" + p.lord + "\\s+(?:ki\\s+)?antardasha\\b", "i").test(reply);
    const dated =
      reply.includes(String(p.from).slice(0, 4)) && reply.includes(String(p.to).slice(0, 4));
    return (
      named &&
      dated &&
      Boolean(p.natal_placement) &&
      !p.supportive_factors.length &&
      !p.relevant_house_lord.length &&
      !p.occupies_relevant_house
    );
  });
}
