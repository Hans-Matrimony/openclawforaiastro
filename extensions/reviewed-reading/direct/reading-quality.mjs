// Validate claims against this request's tool data, never old assistant prose.
import { verifiedFactors } from "./verified-factors.mjs";
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

export function wrongReplyScript(reply, value) {
  if (
    !["hinglish", "english", "en"].includes(value.language?.toLowerCase()) ||
    /reply in hindi|answer in hindi|hindi (?:mein|me)|devanagari|हिंदी/i.test(value.query)
  ) {
    return false;
  }
  const devanagari = (reply.match(/[\u0900-\u097f]/g) ?? []).length;
  const latin = (reply.match(/[A-Za-z]/g) ?? []).length;
  return devanagari > 20 && devanagari > latin;
}

function timingText(text) {
  const words = {
    अगले: "next",
    अगली: "next",
    अगला: "next",
    महीने: "months",
    महीना: "month",
    साल: "year",
    वर्ष: "year",
    जल्द: "soon",
    जल्दी: "soon",
    बाद: "after",
    अंतर्दशा: "antardasha",
    महादशा: "mahadasha",
    दशा: "dasha",
    होगी: "hogi",
    होगा: "hoga",
    होंगे: "honge",
    आएगी: "aayegi",
    आएगा: "aayega",
    शुरू: "shuru",
    सुधरने: "improve",
    सुधार: "improvement",
  };
  return text
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x966))
    .replace(
      /अंतर्दशा|महादशा|महीने|महीना|अगले|अगली|अगला|जल्दी|जल्द|होंगे|होगी|होगा|आएगी|आएगा|सुधरने|सुधार|वर्ष|साल|बाद|दशा|शुरू/g,
      (word) => " " + words[word] + " ",
    );
}

export function verifiedTimingReply(value, periods, today, packets = []) {
  const active = [
    ...new Set(
      periods
        .filter((period) => period.from <= today && period.to >= today)
        .map((period) => period.lord),
    ),
  ];
  const names = {
    Saturn: "Shani",
    Jupiter: "Guru",
    Venus: "Shukra",
    Mercury: "Budh",
    Sun: "Surya",
    Moon: "Chandra",
    Mars: "Mangal",
    Rahu: "Rahu",
    Ketu: "Ketu",
  };
  const language = value.language?.toLowerCase();
  const topic = /sha+di|marri(?:age|ed)|marry|wedding|relationship|partner|शादी|विवाह/i.test(
    value.query,
  )
    ? "marriage"
    : /career|job|naukri|नौकरी|करियर/i.test(value.query)
      ? "career"
      : /pais|money|financ|पैस|धन/i.test(value.query)
        ? "money"
        : null;
  const signal = packets
    .flatMap((packet) => packet?.verdict_signals ?? [])
    .find((row) => row.area === topic && ["POSITIVE", "NEGATIVE", "MIXED"].includes(row.trend));
  const timing = /\b(?:when|kab|kb|timing|date|year|saal|hogi|hoga|tak)\b/i.test(value.query);
  if (language === "hinglish") {
    const fact = active.length
      ? `Abhi ${active.map((name) => names[name] ?? name).join(" aur ")} ka daur chal raha hai.`
      : signal
        ? ""
        : "Is sawaal ke liye abhi saaf timing ka sanket nahi mila.";
    const verdict = /sha+di|marriage|wedding/i.test(value.query)
      ? "Shaadi ka saal abhi saaf nahi hai."
      : /career|job|naukri/i.test(value.query)
        ? "Career ki pakki timing abhi saaf nahi hai."
        : /pais|money|financ/i.test(value.query)
          ? "Paise ki pareshani khatam hone ka samay abhi saaf nahi hai."
          : "Is badlaav ka samay abhi saaf nahi hai.";
    const subject = { marriage: "Shaadi", career: "Career", money: "Paise" }[topic];
    const trend = signal
      ? signal.trend === "MIXED"
        ? `${subject} ke maamle mein sahyog aur rukawat, dono ke sanket hain.`
        : signal.trend === "POSITIVE"
          ? `${subject} ke maamle mein sahyog ke sanket zyada hain.`
          : `${subject} ke maamle mein rukawat ke sanket zyada hain.`
      : "";
    const overview = signal
      ? signal.trend === "MIXED"
        ? `${subject} ke yog milajule hain.`
        : signal.trend === "POSITIVE"
          ? `${subject} ke yog anukool hain.`
          : `${subject} ke yog filhaal anukool nahi hain.`
      : "Is maamle ka saaf natija abhi nahi nikalta.";
    return (
      [trend, ...verifiedFactors(signal), fact].filter(Boolean).join(" ") +
      "\n\n" +
      (signal ? overview : timing ? verdict : overview)
    );
  }
  if (signal) {
    if (["hindi", "hi"].includes(language)) {
      const verdict =
        signal.trend === "POSITIVE"
          ? "योग अनुकूल हैं।"
          : signal.trend === "NEGATIVE"
            ? "योग फिलहाल अनुकूल नहीं हैं।"
            : "योग मिले-जुले हैं।";
      const explanation =
        signal.trend === "POSITIVE"
          ? "इस विषय में सहयोग के संकेत अधिक हैं।"
          : signal.trend === "NEGATIVE"
            ? "इस विषय में रुकावट के संकेत अधिक हैं।"
            : "इस विषय में सहयोग और रुकावट, दोनों के संकेत हैं।";
      return explanation + "\n\n" + verdict;
    }
    const subject = { marriage: "Marriage", career: "Career", money: "Financial" }[topic];
    const assessment =
      signal.trend === "POSITIVE"
        ? "favourable"
        : signal.trend === "NEGATIVE"
          ? "currently unfavourable"
          : "mixed";
    return (
      `${subject} indications are ${assessment}.` +
      (active.length ? ` The current periods are ${active.join(" and ")}.` : "") +
      `\n\n${subject} prospects are ${assessment}.`
    );
  }
  if (["hindi", "hi"].includes(language)) {
    return (
      (active.length
        ? "मौजूदा ग्रह-दौर की जानकारी उपलब्ध है, लेकिन उससे इस घटना का साल तय नहीं होता।"
        : "उपलब्ध जानकारी से इस घटना का समय तय नहीं हो रहा।") + "\n\nइस बदलाव का समय अभी स्पष्ट नहीं है।"
    );
  }
  return (
    (active.length
      ? `The current periods are ${active.join(" and ")}.`
      : "The available reading does not establish an event window.") +
    "\n\nThe timing of this event is not established yet."
  );
}

export function unsupportedTiming(reply, periods, today, { periodBoundariesOnly = false } = {}) {
  reply = timingText(reply);
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
  if (periodBoundariesOnly) {
    for (const sentence of reply.split(/[.!?\n]/)) {
      if (
        /\b(?:soon|shortly|jaldi|jald)\b/i.test(sentence) &&
        /khatam|door|sudhar|improv|hogi|hoga|will|baneg|mileg/i.test(sentence) &&
        !/\b(?:not|nahi|nahin)\b/i.test(sentence)
      ) {
        return "No near-term event window was calculated. Do not promise the event or improvement will happen soon.";
      }
      const dated =
        /\b20\d{2}\b|\b(?:next|agle|agli|agla)\s+(?:[\d-]+\s*)?(?:months?|mahine|saal|years?)\b|\baane wale (?:mahine|saal)\b/i.test(
          sentence,
        );
      const periodExplanation = /\b(?:dasha|antardasha|mahadasha|period|daur)\b/i.test(sentence);
      if (
        periodExplanation &&
        /badlegi|badlega|shuru\s+(?:hogi|hoga)|will\s+(?:start|begin|change)/i.test(sentence)
      ) {
        return "No future period sequence was calculated. Do not promise an outcome when another planetary period begins or changes.";
      }
      const eventClaim =
        /\b(?:hogi|hoga|honge|aayega|aayegi|will|anukool|favourable|favorable|result|results|theek|thik)\b/i.test(
          sentence,
        );
      const dateVerdict =
        sentence.trim().length <= 100 && /\b(?:ke baad|by|after|tak)\b/i.test(sentence);
      const relativeFuture =
        /\b(?:(?:next|agle|agli|agla)\s+(?:\d+(?:\s*[-–]\s*\d+)?\s+)?(?:months?|years?|saal|mahine|mahina)|aane wale (?:mahine|saal))\b/i.test(
          sentence,
        );
      if (
        periodExplanation &&
        /\b(?:ke baad|after|next|agla|agli)\b/i.test(sentence) &&
        /sambhavn|badh|improv|chance|favour|anukool|hogi|hoga/i.test(sentence)
      ) {
        return "A future event improvement is being inferred from an uncalculated next period. Keep the explanation to the current evidence; no projected next-period outcomes were calculated.";
      }
      if (dated && !periodExplanation && (eventClaim || dateVerdict || relativeFuture)) {
        return "This local tool calculated current period boundaries, not an event window. Do not turn those boundaries into a marriage, career, financial or other event date. Give the supported present indication without an invented year or countdown.";
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
    return `${target} beet chuka hai. Aapka sawaal us saal ki situation ke baare mein hai, ya aage ke samay ke baare mein?`;
  }
  if (["hindi", "hi"].includes(lang)) {
    return `${target} बीत चुका है। आप उस साल की स्थिति समझना चाहते हैं या आगे का समय पूछ रहे हैं?`;
  }
  return `${target} has already passed. Are you asking about that year's circumstances, or about timing from now onward?`;
}
