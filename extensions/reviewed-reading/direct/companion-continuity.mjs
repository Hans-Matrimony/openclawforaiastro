// Interaction preferences and explicit answers belong to companionship only.
// Never infer these facts from a chart or from an assistant prediction.
export function listeningOnly(query) {
  return /\b(?:just (?:listen|vent|talk)|bas (?:suno|sun lo|mann halka|baat)|sirf (?:suno|baat))\b|(?:advice|salah).{0,15}(?:nahi|nahin|mat)|(?:no|don't want) advice/i.test(
    query,
  );
}

export function celebration(query) {
  return (
    !/\b(?:nahi|nahin|not|didn't|failed|kab|kya|will|if|agar)\b|\?/i.test(query) &&
    /(?:interview|round|exam).{0,30}(?:clear(?:ed| ho gay[ai])|pass(?:ed| ho gay[ai]))|(?:cleared|passed).{0,30}(?:interview|round|exam)/i.test(
      query,
    )
  );
}

export function continuityFallback(value) {
  const language =
    /\b(?:reply|answer|respond) in (english|hindi)\b/i.exec(value.query)?.[1]?.toLowerCase() ??
    { en: "english", hi: "hindi" }[value.language?.toLowerCase()] ??
    value.language?.toLowerCase();
  let lines;
  if (listeningOnly(value.query)) {
    lines = {
      hinglish: "Theek hai, abhi koi advice nahi. Aaram se apni baat keh sakte ho.",
      english: "Okay, no advice right now. Take your time; you can say what's on your mind.",
      hindi: "ठीक है, अभी कोई सलाह नहीं। मन में जो है, अपने तरीके से कह सकते हो।",
    };
  } else if (celebration(value.query)) {
    lines = {
      hinglish: "Arre wah, yeh toh achhi khabar hai! Aaj is khushi ko thoda enjoy karna banta hai.",
      english: "That is lovely news! Give yourself a moment to enjoy it.",
      hindi: "अरे वाह, यह तो अच्छी खबर है! आज इस खुशी को थोड़ा महसूस करने का वक्त बनता है।",
    };
  } else if (/\b(?:papa|dad|father)\b.{0,35}(?:mana kar|refus|reject)/i.test(value.query)) {
    lines = {
      hinglish:
        "Unke mana karne ka darr hai. Abhi is baat par dil halka karna chahoge, ya baat shuru karne ke shabd saath sochen?",
      english:
        "You are worried he will refuse. Would you rather talk through that worry or find words to start the conversation?",
      hindi: "उनके मना करने का डर है। अभी मन हल्का करना चाहोगे या बात शुरू करने के शब्द साथ सोचें?",
    };
  }
  return lines?.[language] ?? null;
}

export function repeatsAnsweredConcern(question, value) {
  // Compare the actual question as well as the full bubble. Changing the
  // acknowledgment must not disguise asking the same question again.
  const core = (text) =>
    text
      .toLowerCase()
      .match(/\b(?:kya|kis|kaun|what|which|when|how|would|could|do|have)\b[^?]*\?\s*$/)?.[0]
      ?.replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const current = core(question);
  if (
    current &&
    current.split(/\s+/).length >= 6 &&
    (value.history ?? [])
      .filter((turn) => turn.role === "assistant")
      .slice(-3)
      .some((turn) => core(turn.text.split(/\n\s*\n/).at(-1)) === current)
  ) {
    return true;
  }
  // Latest explicit refusal concern: do not ask for the feared reaction again.
  return (
    /\b(?:papa|dad|father)\b.{0,35}(?:mana kar|refus|reject)/i.test(value.query) &&
    /(?:kis|kya|what).{0,35}(?:reaction|darr|dar |worried|fear)|(?:kahenge|keh denge|chup rehenge)/i.test(
      question,
    )
  );
}
