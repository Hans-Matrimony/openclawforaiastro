import { periodFallback } from "./period-fallback.mjs";

// Tool adapters may serialize their error envelope before returning it.
export function isFailedReadingResult(result) {
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return false;
    }
  }
  return result?.isError === true;
}

export const relationshipAssessmentInstruction =
  "\nRelationship answer completeness: answer the current question with a direct qualified assessment before the timing. Explain whether the checked evidence supports progress, indicates difficulty, or is mixed; do not force a yes when indications are mixed or negative. Keep the relevant checked reasons and any supported date window together. A dasha schedule alone is not an answer about whether contact or a relationship is supported. Do not turn general natal signals into certainty about a named person's feelings or actions. If a period lacks topic support, distinguish the calculated schedule from an interpreted opportunity rather than presenting its boundary as the promised event. Preserve dates and contrary evidence.\n";

export function relationshipAssessment(trend, language) {
  if (!["POSITIVE", "NEGATIVE", "MIXED"].includes(trend)) {
    return "";
  }
  return (
    (language === "english"
      ? {
          POSITIVE: "The relationship indications are supportive.",
          NEGATIVE: "The relationship indications are challenging.",
          MIXED: "Relationship indications are mixed, with support and obstacles.",
        }
      : {
          POSITIVE: "Rishte ke aage badhne ka sahyog dikh raha hai.",
          NEGATIVE: "Rishte mein rukawaton ke sanket zyada hain.",
          MIXED: "Rishte mein sahyog bhi hai aur rukawatein bhi.",
        })[trend] ?? ""
  );
}

export function hasOnlyNatalRelationshipEvidence(results) {
  return (
    results.length > 0 &&
    results.every((raw) => {
      try {
        const row = JSON.parse(raw);
        return (
          row?.engine === "local-sweph-v2" &&
          !row.isError &&
          !Object.hasOwn(row, "horary_number") &&
          !row.event_windows?.length
        );
      } catch {
        return false;
      }
    })
  );
}

// Recognize the exact code-owned schedule renderer, not arbitrary prose or dates.
export function isBarePeriodSchedule(reply, results, language, asOf) {
  const rows = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row.engine === "local-sweph-v2" ? [row] : [];
    } catch {
      return [];
    }
  });
  const schedule = periodFallback(rows, language, asOf);
  const normalize = (text) => text.replace(/\s+/gu, " ").trim();
  return Boolean(schedule && normalize(reply) === normalize(schedule));
}

// Mixed natal factors do not establish a categorical answer about another
// person's action. A successful horary/event tool retains its own contract.
export function relationshipVerdictIssue(reply, results) {
  const rows = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row && typeof row === "object" && !Array.isArray(row) ? [row] : [];
    } catch {
      return [];
    }
  });
  if (rows.some((row) => row.horary_number || row.event_windows?.length)) {
    return null;
  }
  const natal = rows.filter((row) => row.engine === "local-sweph-v2");
  const signals = natal
    .flatMap((row) => row.verdict_signals ?? [])
    .filter((row) => row?.area === "marriage");
  if (!signals.length || !signals.every((row) => row.trend === "MIXED")) {
    return null;
  }
  const categorical = reply
    .split(/(?<=[.!?।])\s+|\n+/u)
    .some(
      (part) =>
        /^(?:haan|han|ha|yes|nahi|nahin|naa|na|no)\b/iu.test(part.trim()) &&
        !/\b(?:may|might|could|possible|mixed|sambhav\w*|gunjaish|sak(?:ta|ti|te)|mile.jule|rukawat\w*)\b/iu.test(
          part,
        ),
    );
  if (!categorical) {
    return null;
  }
  return "The checked natal relationship indications are MIXED, not a categorical yes or no about this person. Answer directly with a qualified mixed assessment and the checked reasons; do not append a standalone yes/no or invent a current contact verdict. A successful natal calculation is not a horary result. Preserve any supported timing when timing was requested.";
}
