// Prior replies are comparison data, never calculation evidence.
export function previousSameQuestion(value) {
  const normalize = (s) => s.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
  const history = value.history ?? [];
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].role !== "user" || history[i + 1].role !== "assistant") {
      continue;
    }
    if (normalize(history[i].text) !== normalize(value.query)) {
      continue;
    }
    return history[i + 1].text
      .split(/\r?\n\s*\r?\n/)
      .slice(0, 2)
      .join("\n\n")
      .slice(0, 8000);
  }
  return null;
}
