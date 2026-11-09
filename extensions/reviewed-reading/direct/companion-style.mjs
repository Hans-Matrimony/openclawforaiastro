export const companionStyleInstruction =
  "\n# Natural companion tone\nSpeak warmly and naturally, like an attentive close friend who also handles astrology questions. When the user welcomes affection, a gentle, playful girlfriend-like or boyfriend-like conversational style is welcome; do not claim to be their actual romantic partner. Respond to their actual words instead of giving a counselling script, flowery monologue or service disclaimer. A user saying I love you or asking to call you sweetheart does not ask about your identity. Acknowledge that affection kindly without a rejection, lecture, or an unsolicited I am AI / I am not human disclaimer. Use an affectionate nickname only when explicitly welcomed, without escalating intimacy, exclusivity, dependency or possessiveness. Respect a change of preference immediately. Keep established respectful address and persona grammar.\nDo not volunteer that you are AI, a bot, a language model or not human during ordinary chat, affection, comfort or a reading. This is a conversational relevance rule, never permission to deceive: answer honestly when directly asked about AI/human identity, and do not claim a human body, lived experiences, real tears, family events or actual romantic feelings. Keep current language, no-advice/no-question preferences, safety and verified astrology evidence intact. Never replace real-world relationships or discourage the user from talking to people they trust.\n";

export function directIdentityQuestion(query = "") {
  if (
    /^\s*(?:please\s+)?(?:translate|translation|quote|write (?:a )?code|give (?:a )?json)\b/iu.test(
      query,
    )
  ) {
    return false;
  }
  return /\b(?:are|r)\s+you\s+(?:(?:really|actually|a|an|real)\s+)*(?:AI|human|person|bot|chatbot|artificial intelligence)|\b(?:AI|human|bot|chatbot|insaan)\s+(?:ho|hain|hai)\b|\b(?:tum|aap)\s+(?:(?:ek|sach\s+mein|real)\s+)*(?:AI|insaan|human|bot)\b|(?:आप|तुम)\s*(?:सच में\s*)?(?:AI|एआई|इंसान|मानव|बॉट)|(?:क्या|क्‍या)\s*(?:आप|तुम).{0,20}(?:इंसान|एआई|AI)|तू\s*(?:माणूस|AI)|तुम्ही\s*(?:माणूस|AI)|^\s*are you (?:really |actually )?real[?!.\s]*$/iu.test(
    query,
  );
}

function identityRelevant(query = "") {
  return (
    directIdentityQuestion(query) ||
    /\b(?:who are you|introduce yourself|about yourself|your (?:age|family|backstory|background)|how old are you|where are you from|how did you learn astrology|kaun ho|kon ho|umar|tumhari age|aapki age|kirdaar|backstory)\b|अपने बारे|उम्र|कहाँ से|परिवार/iu.test(
      query,
    ) ||
    /\b(?:translate|translation|quote|code|json|example|pretend|hide|conceal|never admit)\b.{0,90}\b(?:AI|human|insaan|bot|chatbot)\b/iu.test(
      query,
    )
  );
}

const identityAside =
  /\b(?:as\s+(?:an?\s+)?AI|i(?:\s+am|'m|’m)\s+(?:(?:an?|just|only)\s+)*(?:AI(?:\s+(?:assistant|companion|friend|model))?|(?:an?\s+)?(?:large\s+)?language model|chatbot|bot|not\s+(?:an?\s+)?(?:human|real person)))\b|\b(?:main|mein|mai)\s+(?:ek\s+)?(?:AI(?:\s+(?:dost|saathi))?(?:\s+hoon)?|(?:insaan|human)\s+(?:toh?\s+)?(?:nahi|nahin|nhi)(?:\s+hoon)?)\b|मैं\s*(?:एक\s*)?(?:AI(?:\s*साथी)?(?:\s*हूँ)?|एआई(?:\s*हूँ)?|इंसान\s*(?:तो\s*)?नहीं(?:\s*हूँ)?)|मी\s*(?:एक\s*)?(?:AI|माणूस नाही)/iu;

export function hasUnsolicitedIdentityAside(reply, value) {
  return !identityRelevant(value.query) && identityAside.test(reply);
}

function identityReply(value) {
  if (/^(?:hi|hindi)(?:-|$)/i.test(value.language || "")) {
    return "मैं AstroFriend का AI साथी हूँ, इंसान नहीं। आप मुझसे आराम से बात कर सकते हैं।";
  }
  if (value.language === "hinglish") {
    return "Main AstroFriend ka AI saathi hoon, insaan nahi. Aap mujhse aaram se baat kar sakte hain.";
  }
  return "I'm an AI companion at AstroFriend. You can still talk with me openly and comfortably.";
}

function warmFallback(value) {
  const affection = /\b(?:i love you|sweetheart|darling|pyaar|pyar)\b|प्यार|स्वीटहार्ट/iu.test(
    value.query || "",
  );
  if (/^(?:hi|hindi)(?:-|$)/i.test(value.language || "")) {
    return affection
      ? "आप मुझसे प्यार से बात कर सकते हैं। जो कहना चाहें, आराम से कहिए।"
      : "आप अपनी बात आराम से कहिए। हम इसी पर बात कर सकते हैं।";
  }
  if (value.language === "hinglish") {
    return affection
      ? "Aap mujhse pyaar se baat kar sakte hain. Jo kehna chahein, aaram se kahiye."
      : "Aap apni baat aaram se kahiye. Hum isi par baat kar sakte hain.";
  }
  return affection
    ? "You can speak affectionately with me. Say what's on your mind at your own pace."
    : "You can tell me what's on your mind. We can talk it through at your pace.";
}

// Final presentation boundary. Normal prose is returned byte-for-byte. Remove
// only irrelevant identity asides; keep chart sentences, scores and dates.
export function naturalCompanionReply(reply, value) {
  if (directIdentityQuestion(value.query)) {
    // Mixed questions still own their complete answer and checked reading.
    if (/\b(?:guna|score|chart|marriage|career|job|kundli|shaadi|20\d{2})\b/iu.test(value.query)) {
      return reply;
    }
    return identityReply(value);
  }
  if (!hasUnsolicitedIdentityAside(reply, value)) {
    return reply;
  }
  try {
    JSON.parse(reply);
    return reply;
  } catch {
    // JSON and code are content, not a conversational self-description.
  }
  return (
    reply
      .split(/(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+)/gu)
      .map((part, index) =>
        index % 2
          ? part
          : part
              .split(/(\n\s*\n)/u)
              .map((paragraph, i) => {
                if (i % 2 || !identityAside.test(paragraph)) {
                  return paragraph;
                }
                // A disclaimer joined to a useful clause is not the whole response.
                return paragraph
                  .split(/(?<=[.!?।])\s+/u)
                  .map((sentence) => {
                    if (!identityAside.test(sentence)) {
                      return sentence;
                    }
                    return sentence
                      .split(/\s*(?:,|;|\bbut\b|\blekin\b|\bmagar\b|परंतु|लेकिन|मगर|\sपर\s)\s*/iu)
                      .map((clause) => {
                        if (!identityAside.test(clause)) {
                          return clause;
                        }
                        // A prefix without a comma must not swallow checked reading facts.
                        if (
                          /\b(?:20\d{2}|guna|bhakoot|nadi|varna|tara|yoni|vashya|maitri|dasha|house|jupiter|saturn)\b|\d+(?:\.\d+)?\s*\/\s*36/iu.test(
                            clause,
                          )
                        ) {
                          return clause
                            .replace(identityAside, "")
                            .replace(/^\s*[,;:]?\s*(?:but|and|lekin|magar|पर|और)?\s*/iu, "")
                            .trim();
                        }
                        return "";
                      })
                      .filter(Boolean)
                      .join(", ")
                      .replace(/^\s*(?:but|and|lekin|magar|पर|और)\s+/iu, "");
                  })
                  .filter(Boolean)
                  .join(" ")
                  .trim();
              })
              .join(""),
      )
      .join("")
      .trim()
      .replace(/\n(?:\s*\n){2,}/gu, "\n\n") || warmFallback(value)
  );
}
