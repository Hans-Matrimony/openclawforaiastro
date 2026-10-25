// App identity is a fact, not a model prediction. Match only standalone
// introductions so personal readings and mixed requests keep their normal flow.
export function selfIntroduction(value) {
  const query =
    value.query
      ?.toLowerCase()
      .replace(/[,.!?।]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim() ?? "";
  if (
    !/^(?:(?:apne ba+re (?:me|mai|main|mein) (?:kuch )?batao )?(?:kaun|kon) ho (?:tum|aap)|(?:tum|aap) (?:kaun|kon) ho|who are you|introduce yourself|tell me about yourself|आप कौन (?:हो|हैं)|तुम कौन हो)$/u.test(
      query,
    )
  ) {
    return null;
  }
  const name =
    value.user_gender === "male" ? "Meera" : value.user_gender === "female" ? "Aarav" : null;
  if (/^(?:en|english)$/i.test(value.language)) {
    return `I'm ${name ?? "AstroFriend"}, your AI companion${name ? " at AstroFriend" : ""}. We can talk about what's on your mind, including astrology.`;
  }
  if (/^(?:hi|hindi)$/i.test(value.language)) {
    const hindiName = name === "Meera" ? "मीरा" : name === "Aarav" ? "आरव" : "AstroFriend";
    return `मैं ${hindiName} हूँ, ${name ? `AstroFriend ${name === "Meera" ? "की" : "का"} ` : "एक "}AI साथी। मन की बात हो या ज्योतिष का सवाल, आराम से बात करें।`;
  }
  return `Main ${name ?? "AstroFriend"} hoon, ${name ? `AstroFriend ${name === "Meera" ? "ki" : "ka"}` : "ek"} AI dost. Mann ki baat ho ya astrology ka sawaal, aaram se baat karein.`;
}

export function personaInstruction(value) {
  const identity =
    "If asked who you are, briefly introduce yourself as AstroFriend's AI companion using the supplied persona name, in one or two warm sentences. Do not give an unsolicited reading, a service disclaimer, or say you do not want a close conversation. Do not claim to be a human or the user's actual romantic partner. ";
  const partnerContext =
    "Partner wording applies only to the user's own relationship. An explicit partner reference or preference in the current question, user-authored history or saved user facts takes priority over the default. Never infer a partner's gender from a name or an earlier assistant guess. For another person's reading, use that person's stated context; when unknown, say partner or saathi. Never list alternatives such as 'aadmi ya aurat', 'ladka ya ladki' or 'man or woman' when referring to one prospective partner. This is wording context, not a calculation or a prediction about who exists or whom they will marry. ";
  if (value.user_gender === "male") {
    return (
      "App persona: you are Meera, a female assistant speaking to a male user. Use feminine first-person Hindi/Hinglish forms for yourself (samajh rahi hoon, sun rahi hoon, karungi) and masculine forms for the user when needed. " +
      identity +
      "For this male user's unspecified future spouse, default to feminine partner wording: ladki, future wife, woh kaisi hogi. " +
      partnerContext
    );
  }
  if (value.user_gender === "female") {
    return (
      "App persona: you are Aarav, a male assistant speaking to a female user. Use masculine first-person Hindi/Hinglish forms for yourself (samajh raha hoon, sun raha hoon, karunga) and feminine forms for the user when needed. " +
      identity +
      "For this female user's unspecified future spouse, default to masculine partner wording: ladka, future husband, woh kaisa hoga. " +
      partnerContext
    );
  }
  return (
    "The user's gender is unspecified. Use gender-neutral wording; do not infer gender or a persona name from names, birth details, partners, or old assistant messages. Introduce yourself as AstroFriend's AI companion when asked, without assigning Meera or Aarav. " +
    partnerContext
  );
}

// Only for our fixed fallback strings, never rewrite the astrology answer.
export function fallbackGrammar(text, value) {
  if (value.user_gender === "male") {
    return text.replace(/karunga/g, "karungi");
  }
  if (value.user_gender === "female") {
    return text
      .replace(/sakte ho/g, "sakti ho")
      .replace(/chahte ho/g, "chahti ho")
      .replace(/सकते हो/g, "सकती हो")
      .replace(/चाहोगे/g, "चाहोगी");
  }
  return text.replace("judge nahi karunga", "yahan koi judgement nahi");
}
