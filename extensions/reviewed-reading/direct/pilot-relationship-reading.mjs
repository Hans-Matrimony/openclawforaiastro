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

export function readingTopicArea(topic) {
  const areas = {
    relationship: "marriage",
    marriage: "marriage",
    career: "career",
    money: "money",
  };
  return Object.hasOwn(areas, topic) ? areas[topic] : null;
}

export function readingAssessment(trend, language, topic) {
  if (topic === "relationship") {
    return relationshipAssessment(trend, language);
  }
  if (!readingTopicArea(topic) || !["POSITIVE", "NEGATIVE", "MIXED"].includes(trend)) {
    return "";
  }
  if (language === "english") {
    const subject = { marriage: "Marriage", career: "Career", money: "Financial" }[topic];
    return `${subject} indications are ${{ POSITIVE: "supportive", NEGATIVE: "challenging", MIXED: "mixed, with support and obstacles" }[trend]}.`;
  }
  const subject = {
    marriage: "Shaadi ke liye",
    career: "Career mein",
    money: "Paise ke maamle mein",
  }[topic];
  return `${subject} ${{ POSITIVE: "sahyog ke sanket hain", NEGATIVE: "rukawaton ke sanket zyada hain", MIXED: "sahyog bhi hai aur rukawatein bhi" }[trend]}.`;
}

export function readingCompletenessInstruction(topic) {
  const presentation = "\nPresent the answer in this order: first a short direct assessment addressing the exact requested outcome, then one or two decisive checked reasons, then the supported timing if asked. Supportive evidence means a qualified positive outlook; adverse evidence means a qualified difficult outlook; mixed evidence means explicitly explain the support and obstacle without inventing a yes/no. Do not start with a list of planetary periods or raw scores. Use natural language in the requested language, explain technical terms briefly, and keep both years of a cross-year window. A calculated period is not automatically the date of an event. Do not replace a job-outcome answer with career-field advice. Do not add a compulsory question, repeated conclusion, or instruction to wait until the period before taking action.\n";
  if (topic === "relationship") {
    return relationshipAssessmentInstruction + presentation + "A person's return, contact, consent or feelings cannot be established by general relationship indications in the user's natal chart. Answer that specific limitation directly, then explain the general relationship outlook separately. Even a qualified 'may return after this date' needs evidence specific to that event; a general dasha window does not supply it.\n";
  }
  if (!readingTopicArea(topic)) {
    return "";
  }
  return `\nAnswer completeness for ${topic}: answer the user's current question directly using the checked evidence. For an outcome question, state whether indications are supportive, challenging or mixed before the timing, with the relevant checked reasons. Do not force a categorical yes/no from natal indications or turn a period into a guaranteed event. A dasha schedule alone does not answer an outcome question. Preserve supported dates and opposing factors. For a factual chart question, explain the requested facts rather than adding an unsolicited outcome prediction.\n` + presentation;
}

// An explicitly requested calculation schedule is itself a complete answer.
export function requestsPeriodSchedule(query) {
  return /\b(?:dasha|antardasha|mahadasha|period)\s+(?:schedule|dates?|timeline|boundaries)\b/iu.test(
    query,
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
  return readingVerdictIssue(reply, results, "relationship", { mixedOnly: true });
}

// Failure of an optional calculation does not erase a successful natal result.
// Only reject blanket failure claims, not an honest limit on a particular tool.
export function readingUnavailableIssue(reply, results, topic) {
  const area = readingTopicArea(topic);
  if (!area || !hasOnlyNatalRelationshipEvidence(results)) {
    return null;
  }
  const natal = results.map((raw) => JSON.parse(raw));
  const signals = natal
    .flatMap((row) => row.verdict_signals ?? [])
    .filter((row) => row?.area === area);
  if (
    !signals.length ||
    !["POSITIVE", "NEGATIVE", "MIXED"].includes(signals[0].trend) ||
    !signals.every((row) => JSON.stringify(row) === JSON.stringify(signals[0])) ||
    new Set(natal.filter((row) => row.birth_chart).map((row) => JSON.stringify(row.birth_chart)))
      .size > 1
  ) {
    return null;
  }
  if (
    !/\b(?:all\s+(?:the\s+)?tools?\s+(?:have\s+)?failed|tools\s+(?:are\s+)?fail(?:ed|ing)?\b|tools\s+fail\s+ho|kuchh?\s+bhi\s+nahi\s+mil\s+raha|no\s+(?:checked\s+)?(?:chart|reading)\s+(?:data|evidence)\s+(?:is\s+)?available)\b/iu.test(
      reply,
    )
  ) {
    return null;
  }
  return `The checked natal ${topic} assessment is available. A failed supplementary tool does not invalidate it. Explain the existing checked indications and reasons, distinguishing the unavailable supplementary calculation without claiming all tools or evidence failed.`;
}

// Validate each claim independently; a later qualification cannot excuse a
// categorical event prediction earlier in the answer or in its companion.
export function categoricalOutcomeClaim(reply, { expandedWaitCheck = false } = {}) {
  return reply.split(/[.!?;।\n]|\b(?:but|lekin|magar|par)\b/iu).some((clause) => {
    // A natal period is not an instruction to stop pursuing the outcome.
    // This also catches relative waits, which contain no calendar year.
    const waiting =
      /\b(?:wait|intezaar|intazaar)\b[^.!?;।\n]{0,25}\b(?:hoga|hogi|zaroori|zaruri|required|necessary)\b|\b(?:must|have to|need to)\s+wait\b/iu.test(
        clause,
      );
    const optionalWait =
      /\b(?:(?:do not|don't)(?:\s+have to)?|no need to|not necessary to)\s+wait\b|\b(?:wait|intezaar|intazaar)\s+(?:karna\s+)?(?:zaroori\s+|zaruri\s+)?(?:nahi|nahin)\b/iu.test(
        clause,
      );
    if ((waiting || (expandedWaitCheck && /\b(?:wait|intezaar|intazaar)\b[^.!?;\n]{0,25}\b(?:padega|padegi)\b/iu.test(clause))) && !optionalWait) {
      return true;
    }
    if (
      /\b(?:may|might|could|possible|possibly|likely|unlikely|mixed|sambhav\w*|gunjaish|sak(?:ta|ti|te)|mile.jule|sanket|indications?)\b/iu.test(
        clause,
      )
    ) {
      return false;
    }
    return (
      /\b(?:job|naukri|career|sha+di|vivah|marriage|relationship|rishta|paise|paisa|income|financ\w*)\b[^.!?;।\n]{0,65}\b(?:mile(?:ga|gi|nge|ngi)|mil\s+jaye(?:ga|gi)|ho(?:ga|gi|nge|ngi)|aaye(?:ga|gi|nge)|(?:will|won['’]t)\s+(?:not\s+)?(?:get|happen|improve|settle|grow|come|increase))\b/iu.test(
        clause,
      ) ||
      /\b(?:will|won['’]t)\s+(?:not\s+)?(?:get|find|land|have|earn|receive)\b[^.!?;।\n]{0,45}\b(?:job|naukri|career|sha+di|vivah|marriage|relationship|rishta|paise|paisa|income|financ\w*)\b/iu.test(
        clause,
      ) ||
      /\b(?:job|naukri|career|sha+di|vivah|marriage|relationship|rishta|paise|paisa|income|financ\w*)\b[^.!?;।\n]{0,25}\b(?:yog|chances?)\s+(?:nahi|nahin|not|never)\b/iu.test(
        clause,
      )
    );
  });
}

export function readingVerdictIssue(reply, results, topic, { mixedOnly = false, query = "" } = {}) {
  const area = readingTopicArea(topic);
  if (!area) {
    return null;
  }
  const rows = results.flatMap((raw) => {
    try {
      const row = JSON.parse(raw);
      return row && typeof row === "object" && !Array.isArray(row) ? [row] : [];
    } catch {
      return [];
    }
  });
  if (rows.some((row) => Object.hasOwn(row, "horary_number") || row.event_windows?.length)) {
    return null;
  }
  const natal = rows.filter((row) => row.engine === "local-sweph-v2");
  if (!natal.length) {
    return null;
  }
  // A period beginning in a future year does not move a natal planet to a
  // house. Keep this check on natal-only results, never verified transit tools.
  if (hasOnlyNatalRelationshipEvidence(results) &&
      /\b(?:Jupiter|Saturn|Venus|Mars|Mercury|Moon|Sun|Guru|Shani|Mangal)\b[^.!?\n]{0,55}\b(?:house\s*\d|\d+(?:ve|th)?\s*(?:ghar|house))\b[^.!?\n]{0,35}\b(?:aana|enter|enters|entering|move|moves|moving)\b[^.!?\n]{0,50}\b20\d{2}\b/iu.test(reply)) {
    return "Do not describe a natal house placement as a planet entering that house in a future year. The checked dates belong to a dasha period, not a calculated future transit. Preserve the supported period and explain the natal placement separately.";
  }
  // Reject a technical opening when the user asked an outcome question. This
  // uses the existing bounded repair and checked fallback, not another model.
  if (query && /\b(?:kya|will|milegi|milega|hogi|hoga)\b/iu.test(query) &&
      /^(?:Venus|Moon|Sun|Mars|Mercury|Jupiter|Saturn|Rahu|Ketu|Guru|Shani)\b[^.!?\n]{0,50}\b(?:mahadasha|antardasha|dasha)\b/iu.test(reply.trim())) {
    return "Start with a direct qualified assessment of the requested outcome in its own first bubble. Put planetary periods and chart reasons in the next bubble. Preserve mixed evidence; do not force yes/no or add timing when the user only asked whether the outcome is supported.";
  }
  // A general natal relationship period cannot date another person's return,
  // even when the draft uses "possible" rather than making a guarantee.
  const asksReturn = /\b(?:girlfriend|boyfriend|gf|bf|ex|partner)\b/iu.test(query) &&
    /\b(?:wapas|vaapas|return|come back)\b/iu.test(query);
  if (topic === "relationship" && asksReturn && reply.split(/[.!?\n]/u).some(part =>
    /\b(?:wapas|vaapas|return|come back)\b/iu.test(part) &&
    /\b(?:20\d{2}|antardasha|mahadasha|after|before|baad|mahine|months?|years?)\b/iu.test(part) &&
    !/\b(?:cannot|can't|unable|nahi|nahin|not|unverified)\b/iu.test(part))) {
    return "The available natal chart does not establish when this specific person will return. Remove the return-date inference, state that specific limit directly, and discuss checked general relationship indications separately without assigning them to that person's actions.";
  }
  const signals = natal
    .flatMap((row) => row.verdict_signals ?? [])
    .filter((row) => row?.area === area);
  const categorical = reply
    .split(/(?<=[.!?।])\s+|\n+/u)
    .some(
      (part) =>
        /^(?:haan|han|ha|yes|nahi|nahin|naa|na|no)\b/iu.test(part.trim()) &&
        !/\b(?:may|might|could|possible|mixed|sambhav\w*|gunjaish|sak(?:ta|ti|te)|mile.jule|rukawat\w*)\b/iu.test(
          part,
        ),
    );
  if (!categorical && !categoricalOutcomeClaim(reply, { expandedWaitCheck: true })) {
    return null;
  }
  if (
    !signals.length ||
    !["POSITIVE", "NEGATIVE", "MIXED"].includes(signals[0].trend) ||
    !signals.every((row) => JSON.stringify(row) === JSON.stringify(signals[0])) ||
    new Set(natal.filter((row) => row.birth_chart).map((row) => JSON.stringify(row.birth_chart)))
      .size > 1
  ) {
    return mixedOnly
      ? null
      : `No unique checked ${topic} assessment is available from these natal results. Do not infer a categorical yes/no from missing or conflicting evidence. Verify the current subject or explain the missing verification without making a negative prediction.`;
  }
  if (mixedOnly && signals[0].trend !== "MIXED") {
    return null;
  }
  return `The checked natal ${topic} indications are ${signals[0].trend}, not a categorical event verdict. Answer directly with a qualified assessment and the checked reasons; do not append a standalone yes/no. A successful natal calculation is not a horary result. Preserve any supported timing when timing was requested.`;
}
