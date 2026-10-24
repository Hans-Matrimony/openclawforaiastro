const words = (text) => text.trim().split(/\s+/u).filter(Boolean);

function fit(text, budget) {
  if (words(text).length <= budget) {
    return text;
  }
  const sentences = text.match(/[^.!?।]+(?:[.!?।]+|$)/gu) ?? [text];
  let result = "";
  for (const sentence of sentences) {
    const next = (result + " " + sentence).trim();
    if (words(next).length > budget) {
      break;
    }
    result = next;
  }
  return result || words(text).slice(0, budget).join(" ") + "…";
}

// Presentation only: reserve room for the short verdict and final companion.
// Never send shortened text back into chart calculations or memory retrieval.
export function limitResponseLength(reply) {
  if (reply.includes("```") || /(?:^|\n)\s*\|[^\n]+\|/.test(reply)) {
    return reply;
  }
  try {
    JSON.parse(reply);
    return reply;
  } catch {
    // Structured payloads are not chat bubbles.
  }
  let parts = reply
    .trim()
    .split(/\n\s*\n/u)
    .filter(Boolean);
  if (parts.length <= 3 && words(reply).length <= 140) {
    return reply;
  }
  if (parts.length > 3) {
    parts = [parts.slice(0, -2).join(" "), ...parts.slice(-2)];
  }
  if (words(parts.join(" ")).length <= 140) {
    return parts.join("\n\n");
  }
  if (parts.length === 1) {
    return fit(parts[0], 140);
  }
  const tail = parts.slice(1).map((part) => fit(part, 45));
  const remaining = 140 - words(tail.join(" ")).length;
  return [fit(parts[0], remaining), ...tail].join("\n\n");
}
