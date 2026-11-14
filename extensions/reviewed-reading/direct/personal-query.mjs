// Normalize only a self pronoun immediately before a supported reading topic.
// Keep the original message for display; never alter names or birth values.
export function normalizePersonalQuery(query) {
  return query.replace(/\b(?:mea|mra|meraa|meree|merii)\s+(?=(?:career|job|naukri|promotion|sha+di|marriage|kundli|horoscope|chart|education|studies|padhai|money|finances?)\b)/giu, 'mera ');
}

// A rejected topic is not a second requested reading. Strip only a short,
// explicit correction prefix, never a report such as "shaadi nahi hui".
export function correctedReadingSubject(query) {
  const topic='(?:sha+di|marriage|wedding|career|job|naukri|promotion|education|padhai|money|finances?|शादी|विवाह|करियर|पढ़ाई)';
  const correction=new RegExp(`^(?:(?:(?:meri|mera|mere|my)\\s+)?${topic}\\s+(?:nahi|nahin|nhi|नहीं)|not\\s+(?:my\\s+)?${topic})(?:\\s*[,;:]\\s*|\\s+)(.+)$`,'iu').exec(query.trim());
  if (!correction || !new RegExp(topic,'iu').test(correction[1])) return query;
  if (!new RegExp(`^(?:(?:meri|mera|mere|my)\\s+)?(?:${topic}|sister|brother|behen|bhai|friend)|^(?:tell me|please|batao|instead)\\b`,'iu').test(correction[1].trim()) &&
      !new RegExp(`^(?:(?:main|mai|mein)\\s+(?:(?:apne|apni|mere|meri)\\s+)?|I\\s+(?:am asking|was asking|asked)\\s+about\\s+(?:my\\s+)?)${topic}\\b`,'iu').test(correction[1].trim())) return query;
  return correction[1].trim();
}
