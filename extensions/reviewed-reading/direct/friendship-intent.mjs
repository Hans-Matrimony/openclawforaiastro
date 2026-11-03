// Friendship-only intent signals. Shared astrology intent remains unchanged.
export const friendshipContinuation = /^(?:yes|yeah|haan|han|hmm|please (?:listen|stay)|bas suno|sirf suno|हाँ|हां|बस सुनो|(?:ab )?kya kar[uon]+|what should i do(?: now)?|can i tell you what happened|can we talk through this at my pace|can you listen without giving advice|can i explain a little more about my experience|kya main bata sakta hoon ki kya hua|kya hum meri baat aaram se kar sakte hain|kya aap bina salah diye meri baat sun sakte hain|kya main apni baat thoda aur samjha sakta hoon|क्या मैं बता सकता हूँ कि क्या हुआ|क्या हम इस बारे में आराम से बात कर सकते हैं|क्या आप बिना सलाह दिए मेरी बात सुन सकते हैं|क्या मैं अपनी बात थोड़ा और समझा सकता हूँ)[.!?।\s]*$/iu;

export function rejectsPreviousAdvice(query) {
  return /\b(?:did(?:n't| not) help|not helpful|same advice|advice (?:dobara|again)|wahi advice|help nahi hui|kaam nahi (?:kiya|aaya))\b|वही सलाह|मदद नहीं हुई/iu.test(query);
}

export function friendshipDisclosure(query) {
  const personal = /\b(?:i|my|me|main|maine|mera|meri|mere|mujhe|apne|bura lag|sharam aa)\b|मैं|मेरी|मेरे|मुझे/iu.test(query);
  if (!personal) return false;
  return /\b(?:relationship|rishta)\s+(?:khatam|end)|\b(?:ended|ending) (?:our|my|the) relationship\b|\b(?:ignored|excluded|rejected|reject ho|sharam|ashamed|gussa|angry|bura lag|hurt kiya)\b|\b(?:passed away|lost my (?:grandmother|grandfather|mother|father))\b|निधन|गुज़र गए|गुजर गए|गुस्सा|शर्म|बुरा लग|\b(?:tareef hui|praised|appreciated|achhi khabar)\b/iu.test(query);
}

export function friendshipNoName(value) {
  // Most recent user preference wins. Assistant guesses never establish consent.
  const turns = [...(value.history || []).filter(t => t.role === "user").map(t => t.text ?? t.content ?? ""), value.query];
  for (const text of turns.reverse()) {
    if (/\b(?:naam mat|naam nahi|don't use my name|do not use my name|stop using my name)\b|नाम मत|नाम नहीं/iu.test(text)) return true;
    if (/\b(?:use my name|naam use (?:karna|karo|kijiye)|naam se bulao)\b|नाम से बुला/iu.test(text)) return false;
  }
  return false;
}
