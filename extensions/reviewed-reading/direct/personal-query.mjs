// Normalize only a self pronoun immediately before a supported reading topic.
// Keep the original message for display; never alter names or birth values.
export function normalizePersonalQuery(query) {
  return query.replace(/\b(?:mea|mra|meraa|meree|merii)\s+(?=(?:career|job|naukri|promotion|sha+di|marriage|kundli|horoscope|chart|education|studies|padhai|money|finances?)\b)/giu, 'mera ');
}
