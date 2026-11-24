export function conversationProgressEnabled(env, userId) {
  if (env.ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED !== "1") return false;
  const normalize = value => typeof value === "string" && /^\+?\d{10,15}$/.test(value.trim())
    ? value.trim().replace(/^\+/, "") : null;
  const user = normalize(userId);
  return Boolean(user && (env.ASTROFRIEND_CONVERSATION_PROGRESS_USERS || "")
    .split(",").map(normalize).filter(Boolean).includes(user));
}

export const conversationProgressInstruction = `
# Conversation continuity
Read the latest user message together with the ordered conversation, including your own previous question. Resolve short replies, spelling mistakes and quoted replies from that context before asking for clarification. Earlier assistant statements are conversation context, never verified facts or chart evidence.
Answer the user's current request first. When the user asks you to suggest or decide, offer useful conditional guidance from what is known instead of asking them to supply the recommendation. Do not invent a location, prediction or personal fact to sound confident. If essential information is missing, explain the specific limitation and ask only one necessary question. If that question was already asked and the user asks you to proceed, explain what can be answered without it; do not repeat the clarification. A friendly conversation does not need to end every reply with a question.
Birth information is required only for a calculation that needs it, not for ordinary advice or a practical recommendation. An earlier astrology discussion does not turn every later request into a new reading. Distinguish a request for advice from a request to predict an outcome using the full dialogue, not isolated keywords. Never promise that providing birth details will let you determine an exact location, decision or outcome: tool availability is not proof that a tool supports that conclusion. When a user asks for guidance, give the useful part you can answer now and state any genuine limitation briefly.
`;

export function conversationalHistory(history, excludeForecasts = false) {
  if (!excludeForecasts) return history;
  return history.flatMap(turn => {
    if (turn.role !== "assistant") return [turn];
    const text = turn.text.split(/\n\s*\n|(?<=[.!?])\s+/u)
      .filter(part => !/\b(?:20\d{2}|dasha|antardasha|transit|kundli|horoscope|saturn|jupiter|rahu|ketu|shani|mercury|venus|mars)\b/iu.test(part)).join(" ");
    return text ? [{...turn, text}] : [];
  });
}

// Detect verbatim clarification loops in any language, without topic keywords.
export function repeatsClarification(reply, history = []) {
  const normalize = (text) => text.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ").trim();
  const questions = (text) => text.match(/[^.!?。！？\n]*[?？]/gu) ?? [];
  const previous = new Set(history.filter(turn => turn.role === "assistant").slice(-4)
    .flatMap(turn => questions(turn.text)).map(normalize));
  return questions(reply).some(question => {
    const clean = normalize(question);
    return clean.length >= 18 && previous.has(clean);
  });
}
