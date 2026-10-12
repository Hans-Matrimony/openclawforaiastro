// HANS Reading Output Contract — reply validators.
// Pure functions, no I/O. Each check returns {id, pass, warn?, note}.
// Contract source: hans-astro-workspace/SOUL.md ("Reading Output Contract").

const PLANET_WORDS =
  /\b(ghar|house|bhav|grah|shukra|shani|guru|mangal|budh|surya|chandra|rahu|ketu|venus|saturn|jupiter|mars|mercury|sun|moon|nakshatra|dasha|dasa|lagna)\b/i;

const LEAK_WORDS = [
  [/\bshadbala\b/i, "Shadbala leak"],
  [/\bvedastro\b/i, "VedAstro name leak"],
  [/assessment\s+mein/i, "assessment-speak"],
  [/\bconditional\b/i, "hedge: conditional"],
  [/\bpakki\s+date\b/i, "hedge: pakki date nahi"],
  [/\brelatedbody\b|\bpayload\b/i, "tool field leak"],
  [/\btags?\b\s*:/i, "Tags field leak"],
  [/\bweight\b/i, "Weight field leak"],
  [/\bdrivers?\b/i, "Drivers field leak"],
  [/horoscopepredictions|allplanetdata|dasaatrange|matchreport/i, "tool name leak"],
];

const SUMMARY_LABELS = /\b(in summary|summary|overall|bottom line|to sum up|conclusion)\b/i;
const MONTH_YEAR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi;

const STOP = new Set([
  "kya",
  "meri",
  "mera",
  "mere",
  "ki",
  "ka",
  "ke",
  "hai",
  "hain",
  "mein",
  "se",
  "aur",
  "koi",
  "jo",
  "batao",
  "kab",
  "hogi",
  "hoga",
  "the",
  "a",
  "an",
  "is",
  "of",
]);

export function words(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function sentences(s) {
  return s
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function tokens(s) {
  return s.split(/[^\p{L}\d]+/u).filter(Boolean);
}

function repetitionScore(a, b) {
  const A = new Set(
    tokens(a)
      .map((t) => t.toLowerCase())
      .filter((t) => !STOP.has(t)),
  );
  const B = new Set(
    tokens(b)
      .map((t) => t.toLowerCase())
      .filter((t) => !STOP.has(t)),
  );
  if (!A.size || !B.size) {
    return 0;
  }
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) {
      inter++;
    }
  }
  return inter / Math.max(A.size, B.size);
}

// Splits a reply into reading / verdict / follow-up using the contract's shape:
// reading paragraph(s) first, then a short verdict line, then one final question line.
export function splitReply(text) {
  const lines = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  let followUp = null;
  const rest = [...lines];
  if (rest.length && rest[rest.length - 1].endsWith("?")) {
    followUp = rest.pop();
  }
  let verdict = null;
  if (rest.length >= 2) {
    const last = rest[rest.length - 1];
    if (!last.includes("?") && words(last) <= 12) {
      verdict = rest.pop();
    }
  }
  return { reading: rest.join("\n"), verdict, followUp, all: lines };
}

export function checkScenario(sc, reply) {
  const results = [];
  const { reading, verdict, followUp } = splitReply(reply);
  const isReading = sc.expect === "reading";

  if (isReading) {
    results.push({
      id: "shape",
      pass: Boolean(reading && verdict && followUp),
      note: `reading:${Boolean(reading)} verdict:${Boolean(verdict)} followUp:${Boolean(followUp)}`,
    });
  }

  if (isReading && reading) {
    const w = words(reading);
    const s = sentences(reading).length;
    results.push({
      id: "reading-words",
      pass: w >= 40 && w <= 130,
      warn: w < 60 || w > 105,
      note: `${w} words (target 60-105)`,
    });
    results.push({ id: "reading-sentences", pass: s >= 2 && s <= 5, note: `${s} sentences (2-4)` });
    const first = sentences(reading)[0] || "";
    const direct =
      /\b(haan|nahi|nahin|yes|no|unlikely|likely|sambhavana|kam\s+hai|zyada|window|delay|der|hogi|hoga|honge|milega|aayega|banega|rahega)\b/i.test(
        first,
      ) || /\b(19|20)\d{2}\b/.test(first);
    results.push({ id: "first-sentence-direct", pass: direct, note: first.slice(0, 60) });
  }

  if (isReading) {
    if (!verdict) {
      results.push({ id: "verdict", pass: false, note: "missing" });
    } else {
      const w = words(verdict);
      const labelled = /^(verdict|reading|follow-?up|answer)\s*:/i.test(verdict);
      results.push({
        id: "verdict",
        pass: w >= 2 && w <= 10 && !verdict.includes("?") && !labelled,
        note: `${w} words${labelled ? " (labelled!)" : ""}`,
      });
    }
  }

  if (isReading) {
    if (!followUp) {
      results.push({ id: "follow-up", pass: false, note: "missing" });
    } else {
      const w = words(followUp);
      const rep = repetitionScore(followUp, sc.question) >= 0.55;
      results.push({
        id: "follow-up",
        pass: followUp.endsWith("?") && w <= 16 && !rep,
        note: `${w} words, repeat:${rep}`,
      });
    }
  }

  if (!isReading) {
    const w = words(reply);
    results.push({ id: "routine-short", pass: w <= 40, note: `${w} words (<=40)` });
    const placements = PLANET_WORDS.test(reply);
    results.push({
      id: "no-placements",
      pass: !placements,
      note: placements ? "placement/tool words present" : "clean",
    });
  }

  const leaks = LEAK_WORDS.filter(([re]) => re.test(reply)).map(([, n]) => n);
  results.push({ id: "no-leaks", pass: leaks.length === 0, note: leaks.join(", ") || "clean" });
  results.push({
    id: "no-summary-label",
    pass: !SUMMARY_LABELS.test(reply),
    note: SUMMARY_LABELS.test(reply) ? "label found" : "clean",
  });

  const notPlain = /^#{1,6}\s|\*\*|^\s*[-*]\s|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/mu.test(reply);
  results.push({
    id: "plain-text",
    pass: !notPlain,
    note: notPlain ? "markdown/emoji found" : "clean",
  });

  if (sc.timing) {
    // One window = a contiguous year range; the same window repeated in the verdict
    // line is still one window. Count distinct years instead of raw tokens.
    const years = new Set(
      [...reply.matchAll(MONTH_YEAR)].map((m) => m[2] || m[0].replace(/\D/g, "")),
    );
    results.push({
      id: "one-window",
      pass: years.size <= 3,
      warn: years.size === 0,
      note: `${years.size} distinct years (one window <=3): ${[...years].join(", ") || "none"}`,
    });
  }

  if (isReading && reading) {
    const fav =
      /\b(haan|zaroor|achh[ai]|strong|lucky|balwan|shubh|yog|positive|safal|best)\b/i.test(reading);
    const cau =
      /\b(lekin|\bpar\b|tension|delay|der|kam\s+hai|challenge|mushkil|rukawat|savdhan|dhyan|risk)\b/i.test(
        reading,
      );
    results.push({
      id: "mixed-balance",
      pass: true,
      warn: !(fav && cau),
      note: `favorable:${fav} caution:${cau}`,
    });
  }

  return results;
}
