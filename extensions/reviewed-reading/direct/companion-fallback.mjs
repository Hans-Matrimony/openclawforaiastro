import { fallbackGrammar } from "./persona.mjs";
// Used only when the companion writer fails or offers no usable closing.
// Topic acknowledgments do not infer personal circumstances from chart claims.
export function companionFallback(value, facts = []) {
  const language = /\b(?:reply|answer|respond) in english\b/i.test(value.query)
    ? "english"
    : value.language?.toLowerCase();
  const education = /\beduc[a-z]{2,8}\b|padhai|stud(?:y|ies)|exam|शिक्षा|पढ़ाई/i.test(value.query);
  const finance = /pais[aeo]|financ|money|पैस|धन/i.test(value.query);
  const career = /career|job|work|naukri|MBA/i.test(value.query);
  const relationship =
    /sha+di|shadi|marriage|partner|relationship|girlfriend|boyfriend|crush|\u0936\u093e\u0926\u0940|\u0935\u093f\u0935\u093e\u0939|\u0930\u093f\u0936\u094d\u0924/i.test(
      value.query,
    );
  if (!education && !finance && !relationship && !career) {
    return null;
  }
  const userContext = [
    value.query,
    ...(value.history ?? [])
      .filter((turn) => turn.role === "user")
      .toReversed()
      .map((turn) => turn.text),
    ...facts,
  ];
  const previous = (value.history ?? [])
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.toLowerCase());
  const choose = (options) =>
    options
      .map((text) => fallbackGrammar(text, value))
      .find((text) => !previous.some((old) => old.includes(text.toLowerCase()))) ?? null;
  if (language === "hinglish") {
    if (
      (career || education) &&
      userContext.some(
        (text) =>
          /night shift/i.test(text) && !/no longer|ab nahi|nahi karta|nahi karti/i.test(text),
      ) &&
      !/night shift.*(?:ab nahi|nahi karta|nahi karti)|no longer.*night shift/i.test(value.query)
    ) {
      const contextual = choose([
        "Night shift ke saath padhai ka waqt nikaalna kaisa chal raha hai?",
        "Kaam aur padhai dono ki baat hai—abhi kis cheez mein saath chahiye?",
      ]);
      if (contextual) {
        return contextual;
      }
    }
    if (relationship && !/ab.*(?:maan gaye|support)|no longer oppose/i.test(value.query)) {
      const opposition = userContext.find(
        (text) =>
          /gharwal|family|parents/i.test(text) && /khilaaf|against|oppos|nahi maan/i.test(text),
      );
      if (opposition) {
        const reasonKnown = userContext.some((text) => /caste|jaat|religion|dharm/i.test(text));
        const contextual = choose(
          reasonKnown
            ? [
                "Gharwalon se is baat par baat karna kaisa raha?",
                "Is situation mein aapko abhi kis tarah ka saath chahiye?",
              ]
            : [
                "Gharwalon ko is rishte mein sabse zyada kis baat ki dikkat hai?",
                "Gharwalon ki baat sunne ke baad aapke mann mein kya chal raha hai?",
              ],
        );
        if (contextual) {
          return contextual;
        }
      }
    }
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
          : career
            ? [
                "Kaam ko lekar abhi sabse zyada kya uljhan hai?",
                "Apni work situation ke baare mein jitna comfortable ho, bataiye.",
              ]
            : relationship
              ? [
                  "Is rishte ke sawaal ko lekar aapke mann mein jo baat hai, aaram se bataiye.",
                  "Aapke liye rishte mein kya maayne rakhta hai, us par bhi baat kar sakte hain.",
                ]
              : [
                  "Abhi aapke mann mein kya chal raha hai?",
                  "Aap apni baat aaram se keh sakte hain.",
                ]
      : ["english", "en"].includes(language)
        ? [
            "You can talk this through at your own pace, without judgment.",
            "Share as much or as little as feels comfortable.",
          ]
        : ["hindi", "hi"].includes(language)
          ? ["मन में जो चल रहा है, आराम से कह सकते हो।", "जितना सहज लगे उतना ही बताओ, जल्दी नहीं है।"]
          : [];
  return choose(options);
}
