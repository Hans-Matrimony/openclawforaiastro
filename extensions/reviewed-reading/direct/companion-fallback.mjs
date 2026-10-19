// Used only when the companion writer fails or offers no usable closing.
// Topic acknowledgments do not infer personal circumstances from chart claims.
export function companionFallback(value) {
  const language = /\b(?:reply|answer|respond) in english\b/i.test(value.query)
    ? "english"
    : value.language?.toLowerCase();
  const education = /educat(?:ion|oin)|padhai|stud(?:y|ies)|exam|शिक्षा|पढ़ाई/i.test(value.query);
  const finance = /pais[aeo]|financ|money|पैस|धन/i.test(value.query);
  if (!education && !finance) {
    return null;
  }
  const options =
    language === "hinglish"
      ? education
        ? [
            "Padhai ko lekar jo bhi mann mein chal raha hai, aaram se batao.",
            "Apni baat apne tareeke se keh sakte ho, jaldi nahi hai.",
          ]
        : finance
          ? [
              "Paise ki baat khulkar kar sakte ho, judge nahi karunga.",
              "Jitna comfortable ho utna hi batao, jaldi nahi hai.",
            ]
          : ["Jo mann mein chal raha hai, aaram se bata sakte ho."]
      : ["english", "en"].includes(language)
        ? [
            "You can talk this through at your own pace, without judgment.",
            "Share as much or as little as feels comfortable.",
          ]
        : ["hindi", "hi"].includes(language)
          ? ["मन में जो चल रहा है, आराम से कह सकते हो।", "जितना सहज लगे उतना ही बताओ, जल्दी नहीं है।"]
          : [];
  const previous = (value.history ?? [])
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.toLowerCase());
  return options.find((text) => !previous.some((old) => old.includes(text.toLowerCase()))) ?? null;
}
