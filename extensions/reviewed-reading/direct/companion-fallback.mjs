import { fallbackGrammar } from "./persona.mjs";
import { questionScope } from "./question-scope.mjs";
// Used only when the companion writer fails or offers no usable closing.
// Topic acknowledgments do not infer personal circumstances from chart claims.
export function companionFallback(value, facts = []) {
  const language = /\b(?:reply|answer|respond) in english\b/i.test(value.query)
    ? "english"
    : /\b(?:reply|answer|respond) in hindi\b/i.test(value.query)
      ? "hindi"
      : value.language?.toLowerCase();
  const education = /\beduc[a-z]{2,8}\b|padhai|stud(?:y|ies)|exam|शिक्षा|पढ़ाई/i.test(value.query);
  const finance = /pais[aeo]|financ|money|पैस|धन/i.test(value.query);
  const relationship =
    /\b(?:gf|bf)\b|sha+di|marri(?:age|ed)|relationship|partner|crush|girl\s*friend|boy\s*friend|शादी|रिश्त/i.test(
      value.query,
    );
  const career = /career|job|naukri|work|करियर|नौकरी/i.test(value.query);
  const newRelationship = questionScope(value.query) === "dating";
  if (!education && !finance && !relationship && !career) {
    return null;
  }
  const userContext = [
    value.query,
    ...(value.history ?? [])
      .filter((turn) => turn.role === "user")
      .slice(-10)
      .map((turn) => turn.text),
    ...facts,
  ].join("\n");
  // Explicit corrections suppress older details in the fixed fallback. The
  // companion writer still receives all the ordered context, unchanged.
  const detail = /\b(?:nahi|nahin|not|no longer|instead)\b|नहीं/i.test(value.query)
    ? value.query
    : userContext;
  const contextual =
    (education || career) && /\bMBA\b/i.test(detail)
      ? {
          hinglish: "MBA ko lekar abhi aapke mann mein sabse badi uljhan kya hai?",
          english: "What feels most difficult about the MBA decision right now?",
          hindi: "एमबीए को लेकर अभी मन में सबसे बड़ी उलझन क्या है?",
        }
      : relationship && !newRelationship && /family|parents|ghar wal|परिवार|घरवाल/i.test(detail)
        ? {
            hinglish: "Ghar walon wali baat ko lekar ab kaisa lag raha hai?",
            english: "How are you feeling about the situation with your family now?",
            hindi: "घरवालों वाली बात को लेकर अब कैसा महसूस हो रहा है?",
          }
        : null;
  const options =
    language === "hinglish"
      ? education
        ? [
            "Padhai mein abhi kis cheez par dhyaan dena chahte ho?",
            "Padhai ko lekar jo bhi mann mein chal raha hai, aaram se batao.",
            "Apni baat apne tareeke se keh sakte ho, jaldi nahi hai.",
          ]
        : finance
          ? [
              "Paise ki is pareshani mein abhi sabse zaroori kya sambhalna hai?",
              "Paise ki baat khulkar kar sakte ho, judge nahi karunga.",
              "Jitna comfortable ho utna hi batao, jaldi nahi hai.",
            ]
          : relationship
            ? [
                newRelationship
                  ? "Naye rishte ko lekar aapke mann mein kya chal raha hai?"
                  : "Shaadi ya rishte ko lekar aap khud kya chahte ho?",
                "Rishte ki baat aaram se kar sakte ho, jaldi nahi hai.",
              ]
            : [
                "Kaam ko lekar abhi aapke mann mein sabse zyada kya chal raha hai?",
                "Career wali baat ko aaram se ek-ek karke samajhte hain.",
              ]
      : ["english", "en"].includes(language)
        ? [
            education
              ? "What would you like to focus on with your studies right now?"
              : finance
                ? "What feels most urgent to sort out with money right now?"
                : relationship
                  ? newRelationship
                    ? "What is on your mind about starting a new relationship?"
                    : "What do you want for yourself in marriage or a relationship?"
                  : "What has been on your mind most about work lately?",
            "You can talk this through at your own pace, without judgment.",
            "Share as much or as little as feels comfortable.",
          ]
        : ["hindi", "hi"].includes(language)
          ? [
              education
                ? "पढ़ाई में अभी किस चीज़ पर ध्यान देना है?"
                : finance
                  ? "पैसों की इस परेशानी में अभी सबसे ज़रूरी क्या संभालना है?"
                  : relationship
                    ? newRelationship
                      ? "नए रिश्ते को लेकर आपके मन में क्या चल रहा है?"
                      : "शादी या रिश्ते को लेकर आपकी अपनी चाहत क्या है?"
                    : "काम को लेकर अभी मन में सबसे ज़्यादा क्या चल रहा है?",
              "मन में जो चल रहा है, आराम से कह सकते हो।",
              "जितना सहज लगे उतना ही बताओ, जल्दी नहीं है।",
            ]
          : [];
  const previous = (value.history ?? [])
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.toLowerCase().replace(/\s+/g, " "));
  return (
    [contextual?.[{ en: "english", hi: "hindi" }[language] ?? language], ...options]
      .filter(Boolean)
      .map((text) => fallbackGrammar(text, value))
      .find((text) => !previous.some((old) => old.includes(text.toLowerCase()))) ?? null
  );
}
