// Only explicit stage envelopes opt out of the general agent bootstrap prompt.
export function providerMessages(messages, agentId) {
  if (!["provider_selector", "provider_renderer"].includes(agentId)) {
    return null;
  }
  const users = messages.filter((message) => message?.role === "user");
  const content = users.at(-1)?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content) && content.length === 1 && content[0]?.type === "text"
        ? content[0].text
        : undefined;
  if (typeof text !== "string") {
    return null;
  }
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return null;
  }
  if (envelope?.kind !== "astrofriend.provider-stage.v1") {
    return null;
  }
  if (
    users.length !== 1 ||
    messages.some((message) => !["system", "developer", "user"].includes(message?.role)) ||
    Object.keys(envelope).toSorted().join(",") !== "data,instruction,kind,stage" ||
    envelope.stage !== agentId ||
    typeof envelope.instruction !== "string" ||
    !envelope.instruction.trim() ||
    envelope.instruction.length > 12000 ||
    !envelope.data ||
    typeof envelope.data !== "object" ||
    Array.isArray(envelope.data) ||
    JSON.stringify(envelope.data).length > 32768
  ) {
    throw new Error("Invalid provider stage envelope");
  }
  return [
    { role: "system", content: envelope.instruction },
    { role: "user", content: JSON.stringify(envelope.data) },
  ];
}
