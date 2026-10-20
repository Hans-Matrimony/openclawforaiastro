// Validate claims against this request's tool data, never old assistant prose.
const planets = {
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

export function collectPeriods(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const periods = [];
  function visit(value) {
    if (!value || typeof value !== "object") {
      return;
    }
    if (
      typeof value.lord === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.to)
    ) {
      periods.push({ lord: value.lord, from: value.from, to: value.to });
    }
    for (const child of Object.values(value)) {
      visit(child);
    }
  }
  visit(data);
  return periods;
}

export function hasChartClaims(reply) {
  return /\b(?:dasha|antardasha|mahadasha|transits?|bindus?|ashtakavarga|retrograde|combust|bhav)\b|\b(?:house|ghar)\s*[1-9]|\b(?:saturn|jupiter|rahu|ketu|shani|shukra|mercury|venus)\b/i.test(
    reply,
  );
}

export function unsupportedTiming(reply, periods, today) {
  for (const sentence of reply.split(/[.!?\n]/)) {
    const years = (sentence.match(/\b20\d{2}\b/g) ?? []).map(Number);
    if (
      /\b(?:hogi|hoga|honge|aayega|aayegi|will|upcoming|agla|agli)\b/i.test(sentence) &&
      years.length &&
      years.every((year) => year < Number(today.slice(0, 4)))
    ) {
      return "An elapsed year is presented as an upcoming event. Do not repeat it or shift it forward.";
    }
    const months = {
      january: 1,
      jan: 1,
      february: 2,
      feb: 2,
      march: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };
    const dates = [
      ...sentence.matchAll(
        /\b(january|jan|february|feb|march|april|apr|may|june|july|august|aug|september|sep|october|oct|november|nov|december|dec)\s+(20\d{2})\b/gi,
      ),
    ].map((match) => `${match[2]}-${String(months[match[1].toLowerCase()]).padStart(2, "0")}`);
    if (
      /\b(?:hogi|hoga|honge|aayega|aayegi|will|upcoming|agla|agli)\b/i.test(sentence) &&
      dates.length &&
      dates.every((date) => date < today.slice(0, 7))
    ) {
      return "An elapsed month is presented as an upcoming event. Do not repeat it or shift it forward.";
    }
    if (!periods.length) {
      continue;
    }
    const re =
      /\b(sun|surya|moon|chandra|mars|mangal|mercury|budh|jupiter|guru|brihaspati|venus|shukra|saturn|shani|rahu|ketu)\s+(?:(?:ki|ka|ke)\s+)?(?:(?:maha|antar)\s*)?dasha\b/gi;
    for (const match of sentence.matchAll(re)) {
      const lord = planets[match[1].toLowerCase()];
      const available = periods.filter((period) => period.lord === lord);
      if (!available.length) {
        return `The tool supplied no ${lord} period. Do not assert its dates or effects.`;
      }
      if (/\b(?:shuru|start|begins?|next|agla|agli)\b/i.test(sentence)) {
        const years = sentence.match(/\b20\d{2}\b/g) ?? [];
        if (
          years.some(
            (year) =>
              Number(year) >= Number(today.slice(0, 4)) &&
              !available.some((period) => period.from.startsWith(year)),
          )
        ) {
          return `The claimed start of the ${lord} period does not match the supplied period boundaries.`;
        }
      }
    }
  }
  return null;
}

// An expired target phrased as a future question needs clarification, not today's transits.
export function expiredTargetReply(value, today) {
  if (
    !/\b(?:hogi|hoga|honge|will|by|tak)\b/i.test(value.query) ||
    /\b(?:born|birth|janam|janm|dob|hua|hui|tha|thi|happened)\b/i.test(value.query)
  ) {
    return null;
  }
  const target = value.query.match(/\b(20\d{2})\s*(?:mein|me|tak|by|in)?\b/i)?.[1];
  if (!target || Number(target) >= Number(today.slice(0, 4))) {
    return null;
  }
  const lang = value.language?.toLowerCase();
  if (lang === "hinglish") {
    return `${target} beet chuka hai. Aap us saal ki situation samajhna chahte hain, ya aage ka samay pooch rahe hain?`;
  }
  if (["hindi", "hi"].includes(lang)) {
    return `${target} बीत चुका है। आप उस साल की स्थिति समझना चाहते हैं या आगे का समय पूछ रहे हैं?`;
  }
  return `${target} has already passed. Are you asking about that year's circumstances, or about timing from now onward?`;
}
