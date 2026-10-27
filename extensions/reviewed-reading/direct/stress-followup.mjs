export const isStressConcern = (query) =>
  /\b(?:tension|stress(?:ed)?|pressure|worried|overwhelmed|pareshan|pareshaan|anxiety|anxious)\b|तनाव|परेशान|चिंता/i.test(
    query,
  ) && /\b(?:i|i'm|my|me|user|life|main|mein|meri|mera|mujhe|bahut)\b|मुझे|मेरे|मेरी|मैं|बहुत/i.test(query);

export function stressFollowup(value, facts = []) {
  if (!isStressConcern(value.query)) {
    return null;
  }
  const userTurns = (value.history ?? [])
    .filter((turn) => turn.role === "user")
    .slice(-4)
    .map((turn) => turn.text);
  // Assistant predictions are never evidence for the cause of a user's distress.
  const relevant = [value.query, ...userTurns.toReversed(), ...facts.filter(isStressConcern)];
  const work = /\b(?:job|work|career|boss|office|deadline|naukri)\b|नौकरी|काम|ऑफिस/i;
  const family =
    /\b(?:family|parents|ghar|relationship|partner|girlfriend|boyfriend)\b|परिवार|रिश्ते|घर/i;
  const deniesWork =
    /\bnot (?:my )?(?:work|job)|\b(?:job|work|kaam)\s+(?:ki\s+)?(?:tension|stress)\s+(?:nahi|nahin)\b/i.test(
      value.query,
    );
  let cause = null;
  for (const text of relevant) {
    if (!isStressConcern(text)) {
      continue;
    }
    if (!deniesWork && work.test(text)) {
      cause = "work";
    } else if (family.test(text)) {
      cause = "family";
    }
    if (cause) {
      break;
    }
  }
  const language = /\b(?:reply|answer|respond) in english\b/i.test(value.query)
    ? "english"
    : /\b(?:reply|answer|respond) in hindi\b/i.test(value.query)
      ? "hindi"
      : value.language?.toLowerCase();
  const questions =
    language === "hinglish"
      ? [
          cause === "work"
            ? "Kaam ke is pressure mein abhi kis tarah ka support chahiye?"
            : cause === "family"
              ? "Ghar ya rishte ki is situation mein abhi kis tarah ka support chahiye?"
              : "Abhi sabse zyada tension kis baat ki ho rahi hai?",
          "Abhi tum bas baat karna chahte ho, ya saath mein koi chhota practical step sochein?",
        ]
      : ["hindi", "hi"].includes(language)
        ? [
            cause
              ? "इस स्थिति में अभी किस तरह का सहारा चाहिए?"
              : "अभी सबसे ज़्यादा तनाव किस बात का हो रहा है?",
            "अभी मन की बात कहना चाहोगे या साथ में कोई छोटा कदम सोचें?",
          ]
        : ["english", "en"].includes(language)
          ? [
              cause === "work"
                ? "What support would help with the pressure at work right now?"
                : cause === "family"
                  ? "What support would help with this family or relationship situation right now?"
                  : "What has been weighing on you the most lately?",
              "Would you rather talk it through, or think of one small practical next step together?",
            ]
          : [];
  const previous = (value.history ?? [])
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.text.toLowerCase());
  return (
    questions.find((question) => !previous.some((text) => text.includes(question.toLowerCase()))) ??
    null
  );
}
