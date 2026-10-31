import { isDeathTimingQuestion } from "./sensitive-reply.mjs";

// Only a short, separate conversational paragraph may be replaced by the
// companion stage. Keep chart/date paragraphs in the reading formatter.
export function isCompanionParagraph(text) {
  return (
    text.length <= 280 &&
    (/[?？]\s*$/.test(text) ||
      !/\b(?:20\d{2}|dasha|antardasha|transit|kundli|natal|saturn|jupiter|rahu|ketu|shani|guru|mercury|venus|sun|moon|mars|shukra|mangal|chandra|house\s*\d+)\b|दशा|शनि|ग्रह/i.test(
        text,
      ))
  );
}

function responseLanguage(value) {
  if (/\b(?:reply|answer|respond)\s+in\s+english\b/i.test(value.query)) {
    return "english";
  }
  if (/\b(?:reply|answer|respond)\s+in\s+hindi\b/i.test(value.query)) {
    return "hindi";
  }
  return value.language.toLowerCase();
}

export function remedyUnavailableReply(value) {
  const language = responseLanguage(value);
  if (language === "hindi" || language === "hi") {
    return "अभी इस सवाल के लिए भरोसेमंद उपाय का संदर्भ उपलब्ध नहीं है।";
  }
  if (language === "hinglish") {
    return "Is sawaal ke liye abhi koi verified upay ka reference nahi mil raha.";
  }
  return "I couldn’t find a verified remedy for this question in the available references.";
}

export function canAskFollowup(reply, value, completed) {
  if (
    !completed ||
    isDeathTimingQuestion(value.query) ||
    /\b(?:no (?:follow[- ]?ups?|questions)|without (?:follow[- ]?ups?|questions)|(?:don't|do not) ask|(?:sirf|bas) (?:jawab|answer)|(?:follow[- ]?up(?:\s+(?:sawaal|sawal|questions?))?|sawaal|sawal|questions?)\s+(?:nahi|nahin|mat)(?:\s+(?:chahiye|puch\w*|pooch\w*))?|(?:mat|nahi|nahin)\s+(?:puch\w*|pooch\w*))\b|सिर्फ\s*जवाब|(?:सवाल|प्रश्न)\s*(?:मत|नहीं)/i.test(
      value.query,
    ) ||
    reply.includes("```") ||
    /(?:^|\n)\s*\|[^\n]+\|/.test(reply)
  ) {
    return false;
  }
  try {
    JSON.parse(reply);
    return false;
  } catch {
    /* Normal prose only. */
  }
  return true;
}

export function appendFriendlyClosing(reply, value, completed) {
  if (!canAskFollowup(reply, value, completed) || /[?？]\s*$/.test(reply)) {
    return reply;
  }
  const language = responseLanguage(value);
  const closing =
    language === "hinglish"
      ? "Iske baare mein thoda aur bataun?"
      : ["hindi", "hi"].includes(language)
        ? "क्या इसके बारे में थोड़ा और बताऊँ?"
        : ["english", "en"].includes(language)
          ? "Would you like me to explain this a little more?"
          : null;
  return closing ? reply.trimEnd() + "\n\n" + closing : reply;
}
