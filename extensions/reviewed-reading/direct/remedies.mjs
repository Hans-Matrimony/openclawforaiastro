import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

export function asksForRemedy(query, history = []) {
  if (
    /\b(?:no|without|skip)\s+(?:any\s+)?remed|\b(?:don't|do not)\s+(?:give|suggest|include)\s+(?:me\s+)?(?:any\s+)?remed|\b(?:upaa?y\w*|remed\w*)\s+(?:mat|nahi|nahin)\b|उपाय\s+(?:मत|नहीं)/i.test(
      query,
    )
  ) {
    return false;
  }
  const remedy =
    /\b(remed(?:y|ies)|upay|upaay|upaye|upaya|totka|totke|mantra|puja|pooja)\b|उपाय|उपायों|मंत्र|पूजा/i;
  if (remedy.test(query)) {
    return true;
  }
  // A short acceptance of the immediately preceding remedy offer is a request too.
  const previous = history.at(-1);
  const lastQuestion =
    previous?.role === "assistant"
      ? previous.text
          .trim()
          .split(/[.!।]\s|\n/)
          .at(-1)
      : "";
  return (
    /^(?:haan|han|ha|yes|sure|okay|ok|batao|हाँ|हां|बताओ)(?:[ ,]+(?:please|batao|bataiye|ji|बताओ))*[.!]*$/i.test(
      query.trim(),
    ) && Boolean(lastQuestion?.endsWith("?") && remedy.test(lastQuestion))
  );
}

// Send topic labels only to the embedding service, never birth data or raw history.
export function remedySearchQuery(value) {
  const labels = [
    [
      /\b(?:marry|married|marriage|shaadi|shadi|crush|relationships?|girlfriend)\b|शादी|विवाह/i,
      "relationships marriage",
    ],
    [/\b(?:career|jobs?|work|naukri)\b|काम|नौकरी/i, "career work"],
    [/\b(?:money|finances?|financial|paisa|paise|debt|karz)\b|धन|पैस|कर्ज/i, "finances"],
    [/\b(?:study|studies|education|exams?|padhai)\b|पढ़ाई/i, "education"],
    [/\b(?:vastu|vaastu|home)\b|वास्तु/i, "Vastu home"],
    [/\b(?:saturn|shani)\b|शनि/i, "Saturn"],
    [/\brahu\b|राहु/i, "Rahu"],
    [/\bketu\b|केतु/i, "Ketu"],
    [/\b(?:venus|shukra)\b|शुक्र/i, "Venus"],
    [/\b(?:jupiter|guru|brihaspati)\b|गुरु|बृहस्पति/i, "Jupiter"],
    [/\b(?:mars|mangal)\b|मंगल/i, "Mars"],
    [/\b(?:mercury|budh)\b|बुध/i, "Mercury"],
    [/\b(?:sun|surya)\b|सूर्य/i, "Sun"],
    [/\b(?:moon|chandra)\b|चंद्र/i, "Moon"],
    [/\b(?:health|sehat|swasth)\b|स्वास्थ्य|सेहत/i, "wellbeing"],
  ];
  const extract = (text) =>
    labels.filter(([pattern]) => pattern.test(text)).map(([, topic]) => topic);
  let topics = extract(value.query);
  // Explicit current topics take precedence over unrelated older readings.
  if (!topics.length) {
    for (const turn of (value.history || []).toReversed()) {
      if (turn.role !== "user") {
        continue;
      }
      topics = extract(turn.text);
      if (topics.length) {
        break;
      }
    }
  }
  return `Traditional astrology remedies ${topics.join(" ") || "general wellbeing"}`;
}

// The imported corpus mixes simple practices with gemstone purchases. Keep the
// former as remedy evidence; do not send purchase advice to the writer.
function simpleRemedyReference(row) {
  const gemstone =
    /\b(?:diamonds?|sapphires?|rub(?:y|ies)|emeralds?|pearls?|coral|hessonite|gemstones?|cat'?s eye|neelam|pukhraj|panna|manikya|moonga|gomed|lahsuniya)\b/i;
  const result = {};
  for (const key of [
    "text",
    "content",
    "page_content",
    "category",
    "topic",
    "type",
    "planet",
    "name",
    "source",
  ]) {
    if (typeof row[key] !== "string") {
      continue;
    }
    result[key] = row[key]
      .split(/(?<=[.!।])\s+|\n+/u)
      .filter((part) => !gemstone.test(part))
      .join(" ");
  }
  if (Array.isArray(row.remedies)) {
    result.remedies = row.remedies.filter(
      (item) => typeof item === "string" && !gemstone.test(item),
    );
  }
  return result;
}

export function normalizeRemedies(value) {
  if (value?.status === "empty" && Array.isArray(value.sources) && !value.sources.length) {
    return { status: "empty", sources: [] };
  }
  if (value?.status !== "available" || !Array.isArray(value.sources)) {
    return { status: "unavailable", sources: [] };
  }
  const sources = [];
  let size = 0;
  for (const input of value.sources.slice(0, 5)) {
    if (!input || typeof input !== "object" || Array.isArray(input) || !Object.keys(input).length) {
      continue;
    }
    const row = simpleRemedyReference(input);
    if (
      ![row.text, row.content, row.page_content, ...(row.remedies ?? [])].some(
        (part) => typeof part === "string" && part.trim(),
      )
    ) {
      continue;
    }
    const text = [
      row.text,
      row.content,
      row.page_content,
      row.category,
      row.topic,
      row.type,
      ...(Array.isArray(row.remedies) ? row.remedies : []),
    ]
      .filter((part) => typeof part === "string")
      .join(" ");
    if (
      !(
        Array.isArray(row.remedies) &&
        row.remedies.some((item) => typeof item === "string" && item.trim())
      ) &&
      !/\b(?:remed(?:y|ies)|mantra|prayer|chant\w*|worship|puja|pooja|donat\w*|upaa?y\w*)\b|उपाय|मंत्र|जाप|पूजा/i.test(
        text,
      )
    ) {
      continue;
    }
    const bytes = Buffer.byteLength(
      JSON.stringify(row).replace(/</g, "\\u003c").replace(/>/g, "\\u003e"),
    );
    if (size + bytes > 12000) {
      continue;
    }
    sources.push(row);
    size += bytes;
  }
  return { status: sources.length ? "available" : "empty", sources };
}

export function retrieveRemedies(query, { env = process.env, signal, run = execFile } = {}) {
  if (!env.QDRANT_URL || !env.QDRANT_API_KEY || !env.OPENAI_API_KEY || signal?.aborted) {
    return Promise.resolve({ status: "unavailable", sources: [] });
  }
  return new Promise((resolve) => {
    const localScript = fileURLToPath(
      new URL("../../../skills/qdrant/qdrant_client.py", import.meta.url),
    );
    const script = existsSync(localScript)
      ? localScript
      : "/app/bootstrap/skills/qdrant/qdrant_client.py";
    run(
      env.VEDASTRO_DIRECT_PYTHON || "python3",
      [script, "search", query, "--limit", "5"],
      {
        env: {
          ...env,
          QDRANT_COLLECTION: env.VEDASTRO_DIRECT_QDRANT_COLLECTION || "astrology_remedies",
        },
        signal,
        timeout: 25000,
        maxBuffer: 65536,
        windowsHide: true,
      },
      (error, stdout) => {
        try {
          const rows = error ? null : JSON.parse(stdout);
          resolve(normalizeRemedies({ status: "available", sources: rows }));
        } catch {
          resolve({ status: "unavailable", sources: [] });
        }
      },
    );
  });
}
