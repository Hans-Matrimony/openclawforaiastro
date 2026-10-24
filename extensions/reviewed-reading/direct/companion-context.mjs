// Companion-only topic hints. These never select chart tools or alter readings.
const TOPICS = {
  education:
    /\beduc[a-z]*\b|\b(?:study|studies|studying|exam|course|college|MBA|BTech|BCA|MCA|BBA|MBBS|padhai)\b|पढ़ाई|शिक्षा|परीक्षा/i,
  career:
    /\b(?:career|job|work|naukri|office|boss|promotion|night shifts?|software developer|software engineer|sales|marketing|interviews?|applications?)\b|नौकरी|करियर|काम|इंटरव्यू/i,
  finance:
    /\b(?:pais[aeo]*|money|financ[a-z]*|income|salary|debt|loan|fees?|EMI|rent|savings)\b|पैस|धन|कर्ज/i,
  relationship:
    /\b(?:gf|bf|sha+di|marriage|married|partner|crush|relationship|rishte?|family|parents|girlfriend|boyfriend|mummy|papa|mom|dad|mother|father)\b|ghar wal|शादी|रिश्त|परिवार|घरवाल|मम्मी|पापा/i,
  wellbeing: /\b(?:stress|tension|sad|udaas|lonely|pareshan|health|sleep)\b|तनाव|परेशान|सेहत|नींद/i,
  relocation: /\b(?:relocat[a-z]*|moving|abroad|ghar badal|shift house)\b|घर बदल/i,
};

export const companionTopics = (text) =>
  Object.entries(TOPICS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([topic]) => topic);

export function companionFocus(value) {
  const query = value.query ?? "";
  // A correction such as "job nahi, padhai" changes the active subject.
  const current = query.replace(/^.*(?:nahi|nahin|not|instead)[,;]\s*/i, "");
  if (/mere ba+re|about (?:me|myself)|sabhi|sab kuch|everything|मेरे बारे/i.test(current)) {
    return { topics: [], user_topic: query };
  }
  const topics = companionTopics(current);
  if (topics.length) {
    return { topics, user_topic: query };
  }
  if (
    /\b(?:why|kyu|kyun|kaise|matlab|samjhao|explain|thik se|aur|or|haan|yes|nahi|then|what next|ab kya|tak|kab|summarize)\b|क्यों|कैसे|बताओ/i.test(
      query,
    )
  ) {
    for (const turn of (value.history ?? []).toReversed()) {
      if (turn.role !== "user") {
        continue;
      }
      const topics = companionTopics(turn.text);
      if (topics.length) {
        return { topics, user_topic: turn.text };
      }
    }
  }
  return { topics: [], user_topic: query };
}

function rejectedDetail(text, value) {
  const statements = [
    value.query,
    ...(value.history ?? [])
      .filter((t) => t.role === "user")
      .toReversed()
      .map((t) => t.text),
  ];
  const detail = /\bMBA\b/i;
  const latest = statements.find((statement) => detail.test(statement));
  // Acknowledge a stopped course without treating it as an ongoing activity.
  // Keep this narrow: the question must move to work, not back to study.
  const acknowledgesChange =
    /\bMBA\s+(?:chhod|chod|quit|cancel)|(?:quit|stopped|left)\s+(?:my\s+|your\s+)?MBA/i.test(
      text,
    ) &&
    /(?:ab|now|then).{0,35}(?:job|work|career)|(?:job|work|career).{0,35}\?/i.test(text) &&
    !/padhai|stud(?:y|ies|ying)|course|degree/i.test(text);
  return (
    detail.test(text) &&
    !acknowledgesChange &&
    /\bMBA\s+(?:filhaal\s+|abhi\s+)?(?:nahi|nahin|cancel|chhod|chod)|\b(?:quit|stopped)\s+(?:my\s+)?MBA|\b(?:not|no longer)\s+(?:doing|pursuing|planning)\s+(?:an?\s+)?MBA/i.test(
      latest ?? "",
    )
  );
}

export function companionNotes(facts, focus, value) {
  return facts
    .filter((fact) => typeof fact === "string" && !/^\s*\[birth\]/i.test(fact))
    .filter((fact) => !rejectedDetail(fact, value))
    .map((text, index) => {
      const topics = companionTopics(text);
      const related = topics.some((topic) => focus.topics.includes(topic));
      // Work/study facts may be useful together; never borrow unrelated romance
      // or finance details merely because they were first in the memory response.
      const workStudy =
        focus.topics.some((t) => ["education", "career"].includes(t)) &&
        topics.some((t) => ["education", "career"].includes(t));
      return { text, index, score: related ? 2 : workStudy ? 1 : 0, topics };
    })
    .filter((row) => !focus.topics.length || !row.topics.length || row.score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 15)
    .map((row) => row.text);
}

export function closingDrifts(question, focus, value, facts) {
  const topics = companionTopics(question);
  if (!focus.topics.length || !topics.length) {
    return false;
  }
  const additionalTopics = topics.filter((topic) => !focus.topics.includes(topic));
  if (!additionalTopics.length) {
    return false;
  }
  const userEvidence = [
    value.query,
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
    ...facts,
  ];
  // A user-established bridge (night shifts alongside MBA, for example) is valid.
  return additionalTopics.some(
    (topic) =>
      !userEvidence.some((text) => {
        const known = companionTopics(text);
        const workStudy =
          ["career", "education"].includes(topic) &&
          focus.topics.some((current) => ["career", "education"].includes(current));
        return (
          (workStudy || known.some((current) => focus.topics.includes(current))) &&
          known.includes(topic)
        );
      }),
  );
}

export function unsupportedClosingDetail(question, value, facts) {
  const evidence = [
    value.query,
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
    ...facts,
  ].join("\n");
  const statements = [
    value.query,
    ...(value.history ?? [])
      .filter((t) => t.role === "user")
      .toReversed()
      .map((t) => t.text),
    ...facts,
  ];
  const inventedConversation = ["mummy", "papa"].some((person) => {
    const latest = statements.find((text) => new RegExp(`\\b${person}\\b`, "i").test(text));
    return (
      new RegExp(`${person}.{0,20}baat kar sak`, "i").test(latest ?? "") &&
      new RegExp(`${person}.{0,20}(?:baat ho rahi|baat ho gayi|baat kar li)`, "i").test(question)
    );
  });
  const inventedParentSituation =
    /\b(?:papa|mummy|father|mother|dad|mom)\b.{0,45}(?:intezaar|waiting|agree nahi|oppos|rehnumaai)/i.test(
      question,
    ) && !/\b(?:papa|mummy|father|mother|dad|mom)\b/i.test(evidence);
  return (
    (/\b(?:abhi jo bhi kaam kar rahe|your current job|aapki current job|tumhari current job)\b/i.test(
      question,
    ) &&
      !/\b(?:I work|I am working|meri job|meri naukri|main kaam karta|main kaam karti|night shift)\b/i.test(
        evidence,
      )) ||
    (/\b(?:your|tere|tumhare|aapke)\s+strengths?\b|\bnaturally\s+fit\b|\b(?:solid|meaningful)\s+hoga\b/i.test(
      question,
    ) &&
      !/\b(?:my|mere|meri)\s+strengths?\b|\bnaturally\s+fit\b/i.test(evidence)) ||
    inventedParentSituation ||
    inventedConversation ||
    (/\b(?:darr?|afraid|scared|fear)\b/i.test(question) &&
      !/\b(?:darr|dar|afraid|scared|fear)\b/i.test(evidence)) ||
    (/\b(?:usse|usko|unse)\s+(?:baat|apni baat)|\b(?:aapko|tumhe)\s+kisi\s+(?:ek\s+)?insaan\s+ke\s+baare\b/i.test(
      question,
    ) &&
      !/\b(?:crush|girlfriend|boyfriend|gf|bf|my partner|meri partner|mera partner|usse|usko|unse|pasand|papa|mummy|father|mother|dad|mom|boss|friend|dost)\b/i.test(
        evidence,
      )) ||
    rejectedDetail(question, value) ||
    [/\bMBA\b/i, /night shifts?|raat ki shift/i, /\bEMI\b/i].some(
      (detail) => detail.test(question) && !detail.test(evidence),
    )
  );
}

export function asksKnownDetail(question, value, facts) {
  if (
    /\bfees?\b/i.test(value.query) &&
    /(?:sabse zaroori kya|what matters most|kis baat ki.*tension)/i.test(question)
  ) {
    return true;
  }
  const evidence = [
    value.query,
    ...(value.history ?? []).filter((t) => t.role === "user").map((t) => t.text),
    ...facts,
  ].join("\n");
  return (
    (/which (?:course|degree)|kaun\s*sa\s*(?:course|degree)|कौन\s*सा\s*(?:कोर्स|डिग्री)/i.test(
      question,
    ) &&
      /\b(?:MBA|BTech|B\.Tech|BCA|MCA|BBA|MBBS)\b/i.test(evidence)) ||
    (/do you (?:have a partner|work nights)|kya (?:aap|tum) (?:relationship mein|night shift)/i.test(
      question,
    ) &&
      (/partner|relationship/i.test(question)
        ? /\b(?:my|meri|mera)\s+(?:partner|girlfriend|boyfriend|gf|bf)\b/i.test(evidence)
        : /night shifts?|raat ki shift/i.test(evidence)))
  );
}
