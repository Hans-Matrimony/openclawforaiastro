import { chartClaimConflicts } from "./chart-claims.mjs";
import { evidenceFallback } from "./evidence-fallback.mjs";
import { houseLordConflicts } from "./house-evidence.mjs";
import { hasPredictionGuarantee } from "./prediction-certainty.mjs";
import { mismatchedQuestionReply } from "./question-scope.mjs";

// A rejected timing sentence must not automatically erase the checked,
// undated explanation. Do not salvage a dated or contradictory paragraph.
export function readingFallback(draft, results, language, query, asOf) {
  const fallback = evidenceFallback(results, language, query, asOf);
  const explanation = typeof draft === "string" ? draft.trim().split(/\n\s*\n/)[0] : "";
  if (
    !explanation ||
    explanation.split(/\s+/).length < 5 ||
    /\b\d{4}\b/.test(explanation) ||
    /\b(?:antardasha|mahadasha|period)\b/i.test(explanation) ||
    hasPredictionGuarantee(explanation) ||
    mismatchedQuestionReply(query, explanation) ||
    chartClaimConflicts(explanation, results).length ||
    houseLordConflicts(explanation, results).length
  ) {
    return fallback;
  }
  const paragraphs = fallback.split(/\n\s*\n/);
  // Without a distinct checked verdict, keep the original conservative result.
  return paragraphs.length === 2 ? explanation + "\n\n" + paragraphs[1] : fallback;
}
