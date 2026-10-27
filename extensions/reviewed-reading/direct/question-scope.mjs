const wedding = /\b(?:sha+di|marri(?:age|ed)|marry|wedding|spouse|vivah)\b|शादी|विवाह/i;
const dating =
  /\b(?:g\s*\.?\s*f|b\s*\.?\s*f|girl\s*friend|boy\s*friend|relationship|risht[ae]|dating)\b|गर्लफ्रेंड|बॉयफ्रेंड|रिश्त/i;
const career = /\b(?:career|job|naukri|employment|promotion)\b|नौकरी|करियर/i;
const finance = /\b(?:finances?|financial|money|income|paisa|paise)\b/i;
const education = /\b(?:education|studies|study|exam|padhai)\b/i;

// A wedding involving an existing partner is still a marriage question. Only
// explicit formation questions are scoped as finding a new partner.
export function questionScope(query) {
  if (wedding.test(query)) {
    return "marriage";
  }
  if (
    dating.test(query) &&
    /\b(?:baneg[ai]|banegi|banega|milegi|milega)\b|\b(?:find|meet|get|have)\s+(?:a|my first|new)\s+(?:girlfriend|boyfriend|gf|bf)\b|\b(?:new|naya|nayi)\s+(?:relationship|rishta)\b|\bstart\s+(?:(?:a|new)\s+relationship|dating)\b|बनेगी|बनेगा|मिलेगी|मिलेगा/i.test(
      query,
    )
  ) {
    return "dating";
  }
  if (career.test(query)) {
    return "career";
  }
  if (finance.test(query)) {
    return "finance";
  }
  if (education.test(query)) {
    return "education";
  }
  return null;
}

export function questionScopeInstruction(query) {
  const topic = questionScope(query);
  if (topic === "dating") {
    return "The current question asks about forming a girlfriend/boyfriend relationship, not marriage or a wedding. GF means girlfriend; BF means boyfriend. Answer the start of a romantic relationship. An earlier marriage prediction is not a dating timeline. Use current relevant tool evidence; do not simply rename a wedding date as a girlfriend/boyfriend date. Preserve the normal explanation and short direct verdict style.";
  }
  if (["career", "finance", "education"].includes(topic)) {
    return `Answer the current ${topic} question using relevant chart factors. Do not answer an earlier marriage question or reuse its verdict.`;
  }
  return "";
}

export function mismatchedQuestionReply(query, reply) {
  const topic = questionScope(query);
  const expected = { dating, career, finance, education }[topic];
  if (!expected) {
    return false;
  }
  const parts = reply.trim().split(/\r?\n\s*\r?\n/);
  const verdict = parts.length >= 3 ? parts[1] : parts.at(-1);
  return wedding.test(verdict) && !expected.test(verdict);
}

export function unresolvedQuestionReply(value) {
  const topic = questionScope(value.query);
  if (["finance", "education"].includes(topic)) {
    return value.language === "hinglish"
      ? `Aapka sawaal ${topic} ke baare mein hai; shaadi ki reading iska jawab nahi hai.\n\nIs sawaal ki reading abhi verify nahi hui.`
      : `Your question concerns ${topic}; a marriage reading does not answer it.\n\nThis reading has not established an answer to your question.`;
  }
  // Used only when a bounded repair still answers the wrong question. Do not
  // return the stale marriage prediction or fabricate a replacement date.
  const datingQuestion = questionScope(value.query) === "dating";
  const lang = value.language?.toLowerCase();
  if (lang === "hinglish") {
    return datingQuestion
      ? "Aapne GF/BF banne ka waqt poocha hai; pehle wali shaadi ki timing is sawaal ka jawab nahi hai.\n\nNaye rishte ki timing is reading mein alag se confirm nahi hui."
      : "Aapne career ke baare mein poocha hai; pehle wali shaadi ki timing is sawaal ka jawab nahi hai.\n\nCareer ki timing is reading mein alag se confirm nahi hui.";
  }
  if (["hindi", "hi"].includes(lang)) {
    return datingQuestion
      ? "आपने नया रिश्ता बनने का समय पूछा है; पहले बताई गई शादी की अवधि इसका जवाब नहीं है।\n\nइस रीडिंग में नए रिश्ते का समय अलग से स्पष्ट नहीं हुआ।"
      : "आपने करियर के बारे में पूछा है; शादी की अवधि इसका जवाब नहीं है।\n\nइस रीडिंग में करियर का समय अलग से स्पष्ट नहीं हुआ।";
  }
  return datingQuestion
    ? "You asked when a new relationship may begin; the earlier marriage timeline does not answer that.\n\nThis reading did not establish a separate dating timeline."
    : "You asked about your career; the earlier marriage timeline does not answer that.\n\nThis reading did not establish a separate career timeline.";
}
