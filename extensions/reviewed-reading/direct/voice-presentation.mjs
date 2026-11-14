// Presentation of already checked text only. Never shorten a date range,
// remove a caution, or ask another model to paraphrase before speech starts.
export function spokenReply(reply, value) {
  if (value.reply_surface !== 'voice' || /```|https?:\/\//.test(reply)) return reply;
  try { JSON.parse(reply); return reply; } catch { /* Prose only. */ }
  let text = reply;
  if (['english', 'en'].includes(value.language)) {
    text = text
      .replace(/The separate house[ -]strength indicator for house (\d{1,2}) is supportive/giu, 'House $1 shows support')
      .replace(/The separate house[ -]strength indicator for house (\d{1,2}) shows limited support/giu, 'House $1 shows limited support')
      .replace(/current dasha lords is area se directly linked nahi external push kam/giu, 'The current planetary period offers limited direct support')
      .replace(/The calculated (\w+) sub[ -]period runs/giu, 'Your $1 sub period runs');
  }
  // The full day, month and year survive; only the spoken representation changes.
  text = text.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/gu, (original, year, month, day) => {
    const date = new Date(`${original}T00:00:00Z`);
    if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== original) return original;
    return new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  });
  return text.replace(/\s+/gu, ' ').trim();
}
