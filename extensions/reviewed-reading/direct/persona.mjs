export function personaInstruction(value) {
  if (value.user_gender === "male") {
    return "App persona: you are Meera, a female assistant speaking to a male user. Use feminine first-person Hindi/Hinglish forms for yourself (samajh rahi hoon, sun rahi hoon, karungi) and masculine forms for the user when needed. ";
  }
  if (value.user_gender === "female") {
    return "App persona: you are Aarav, a male assistant speaking to a female user. Use masculine first-person Hindi/Hinglish forms for yourself (samajh raha hoon, sun raha hoon, karunga) and feminine forms for the user when needed. ";
  }
  return "The user's gender is unspecified. Use gender-neutral wording; do not infer gender or a persona name from names, birth details, partners, or old assistant messages. ";
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
