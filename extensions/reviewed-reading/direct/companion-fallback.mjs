import { companionFocus, companionNotes, asksKnownDetail } from "./companion-context.mjs";
import { fallbackGrammar } from "./persona.mjs";
import { questionScope } from "./question-scope.mjs";
// Used only when the companion writer fails or offers no usable closing.
// Topic acknowledgments do not infer personal circumstances from chart claims.
export function companionFallback(value, facts = [], { requireQuestion = false } = {}) {
  const language = /\b(?:reply|answer|respond) in english\b/i.test(value.query)
    ? "english"
    : /\b(?:reply|answer|respond) in hindi\b/i.test(value.query)
      ? "hindi"
      : value.language?.toLowerCase();
  const personalTopic =
    /\b(?:mere|mera|meri|apne)\s+ba+re\s+(?:me|mai|main|mein)\b|\babout (?:me|myself)\b|मेरे बारे/i;
  let personal = personalTopic.test(value.query);
  const topics =
    /\b(?:gf|bf)\b|sha+di|marriage|relationship|partner|crush|girl\s*friend|boy\s*friend|career|job|naukri|work|educ[a-z]*|padhai|study|exam|pais[aeo]|financ[a-z]*|money|शादी|रिश्त|करियर|नौकरी|शिक्षा|पढ़ाई|पैस|धन/i;
  let topicQuery = companionFocus(value).user_topic;
  if (!topics.test(topicQuery) && /\b(?:sabhi|sab kuch|everything|all these)\b/i.test(topicQuery)) {
    personal = true; // A concern about all areas of life is not just the last GF/career topic.
  }
  if (
    !personal &&
    !topics.test(topicQuery) &&
    /\b(?:why|kyu|kyun|kaise|matlab|samjhao|explain|thik se|aur batao|or batao|sabhi|sab kuch)\b|क्यों|कैसे|समझाओ/i.test(
      topicQuery,
    )
  ) {
    topicQuery =
      (value.history ?? [])
        .filter((turn) => turn.role === "user")
        .toReversed()
        .find((turn) => topics.test(turn.text) || personalTopic.test(turn.text))?.text ??
      value.query;
    personal = personalTopic.test(topicQuery);
  }
  const focusedTopics = companionFocus(value).topics;
  const education = focusedTopics.includes("education");
  const finance = focusedTopics.includes("finance");
  const relationship =
    /\b(?:gf|bf)\b|sha+di|marri(?:age|ed)|relationship|partner|crush|girl\s*friend|boy\s*friend|शादी|रिश्त/i.test(
      topicQuery,
    );
  const career = /career|job|naukri|work|करियर|नौकरी/i.test(topicQuery);
  const newRelationship = questionScope(topicQuery) === "dating";
  if (!education && !finance && !relationship && !career && !personal) {
    if (
      !requireQuestion ||
      /\b(?:death|maut|mrityu|lifespan|martyrdom|shahe+e?d)\b|मृत्यु|मौत/i.test(value.query)
    ) {
      return null;
    }
    personal = true; // Completed readings on other topics also retain a conversational third bubble.
  }
  const userContext = companionNotes(
    [
      value.query,
      ...(value.history ?? [])
        .filter((turn) => turn.role === "user")
        .slice(-10)
        .map((turn) => turn.text),
      ...facts,
    ],
    companionFocus(value),
    value,
  ).join("\n");
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
  const crush = relationship && /\bcrush\b/i.test(topicQuery);
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
            : career
              ? [
                  "Kaam ko lekar abhi aapke mann mein sabse zyada kya chal raha hai?",
                  "Career wali baat ko aaram se ek-ek karke samajhte hain.",
                ]
              : [
                  "Aajkal apni zindagi mein sabse zyada kya chal raha hai?",
                  "Apne liye abhi sabse zaroori kya lagta hai?",
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
                  : career
                    ? "What has been on your mind most about work lately?"
                    : "What has been on your mind most in your life lately?",
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
                    : career
                      ? "काम को लेकर अभी मन में सबसे ज़्यादा क्या चल रहा है?"
                      : "आजकल अपनी ज़िंदगी में सबसे ज़्यादा क्या चल रहा है?",
              "मन में जो चल रहा है, आराम से कह सकते हो।",
              "जितना सहज लगे उतना ही बताओ, जल्दी नहीं है।",
            ]
          : [];
  const previous = (value.history ?? [])
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.toLowerCase().replace(/\s+/g, " "));
  const subject = education
    ? "Padhai"
    : finance
      ? "Paise"
      : relationship
        ? "Rishte"
        : career
          ? "Kaam"
          : "Apni zindagi";
  const englishSubject = education
    ? "studying"
    : finance
      ? "money"
      : relationship
        ? "relationships"
        : career
          ? "work"
          : "your life";
  const hindiSubject = education
    ? "पढ़ाई"
    : finance
      ? "पैसों"
      : relationship
        ? "रिश्तों"
        : career
          ? "काम"
          : "अपनी ज़िंदगी";
  const candidates = [
    contextual?.[{ en: "english", hi: "hindi" }[language] ?? language],
    ...(language === "hinglish" && crush
      ? [
          "Kya aapne unse apni feelings share ki hain?",
          "Unke saath abhi baatcheet kaisi chal rahi hai?",
        ]
      : []),
    // Concrete invitations for broad questions, without inventing a problem or
    // asking for a preference the user may already have supplied in memory.
    ...(language === "hinglish" && career && !education && !finance
      ? [
          "Kaam mein apni kaunsi skill ko aur use karne ka mann hai?",
          "Career mein agla kadam lene se pehle kis baat par saath mein sochna chahenge?",
        ]
      : language === "hinglish" && finance
        ? [
            "Aap pehle aamdani ki baat karna chahenge ya kharchon ki?",
            "Paison ko lekar koi khaas faisla soch rahe hain jiske baare mein baat karein?",
          ]
        : []),
    ...options,
    ...(requireQuestion
      ? language === "hinglish"
        ? [
            newRelationship
              ? "Naye rishte mein aapke liye sabse zaroori kya hai?"
              : `${subject} ko lekar aapke liye abhi sabse zaroori kya hai?`,
            `${subject} ko lekar aaj kaisa lag raha hai?`,
          ]
        : ["english", "en"].includes(language)
          ? [
              `What matters most to you about ${englishSubject} right now?`,
              `How are you feeling about ${englishSubject} today?`,
            ]
          : ["hindi", "hi"].includes(language)
            ? [
                `${hindiSubject} को लेकर अभी आपके लिए सबसे ज़रूरी क्या है?`,
                `${hindiSubject} को लेकर आज कैसा लग रहा है?`,
              ]
            : []
      : []),
  ]
    .filter(Boolean)
    .filter(
      (text) =>
        !((career || finance) && /\bsabse (?:zyada|zaroori) kya\b/i.test(text)) &&
        !asksKnownDetail(text, value, facts),
    )
    .map((text) => fallbackGrammar(text, value))
    .filter(
      (text) => (!requireQuestion || /[?？]\s*$/.test(text)) && text.split(/\s+/u).length <= 20,
    );
  // Prefer unused questions, then the least recently used. Exhausting the small
  // emergency pool must not silently remove the companion bubble.
  return (
    candidates.toSorted(
      (a, b) =>
        previous.findLastIndex((old) => old.includes(a.toLowerCase())) -
        previous.findLastIndex((old) => old.includes(b.toLowerCase())),
    )[0] ?? null
  );
}
