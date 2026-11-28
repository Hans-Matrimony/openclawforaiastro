// Normalize only a self pronoun immediately before a supported reading topic.
// Keep the original message for display; never alter names or birth values.
export function normalizePersonalQuery(query) {
  return query.replace(/\b(?:mea|mra|meraa|meree|merii)\s+(?=(?:career|job|naukri|promotion|sha+di|vivah|marriage|kundli|horoscope|chart|education|studies|padhai|money|finances?)\b)/giu, 'mera ');
}

// A rejected topic is not a second requested reading. Strip only a short,
// explicit correction prefix, never a report such as "shaadi nahi hui".
export function correctedReadingSubject(query,{allowDismissal=false}={}) {
  const topic='(?:sha+di|vivah|marriage|wedding|career|job|naukri|promotion|education|padhai|money|finances?|शादी|विवाह|करियर|पढ़ाई'+
    (allowDismissal?'|property|home|house|ghar|makaan|makan|घर|मकान|love(?:[ -]+life)?|romance|dating|pya+ar|pya+r|mohabbat|relationship|rishta|प्रेम(?:\\s*जीवन)?|प्यार|लव\\s*लाइफ':'')+')';
  if(allowDismissal) {
    const translatedDismissal=/^(?:(?:leave|forget|set aside)\s+(?:(?:my|the)\s+)?(?:career|job|marriage|wedding|property|home|house|love life)(?:\s+(?:aside|for now))?|(?:करियर|नौकरी|शादी|विवाह|घर|मकान|प्रेम जीवन)(?:\s+की\s+बात)?\s+(?:छोड़ो|छोड़िए|रहने दो))\s*[,;:.!?।—-]\s*(.+)$/iu.exec(query.trim());
    if(translatedDismissal&&new RegExp(topic,'iu').test(translatedDismissal[1]))return translatedDismissal[1].trim();
    // A report of an earlier question is context, not a second request. Only
    // an explicit now/instead clause after a past asking verb selects this path.
    const shifted=/^(.{1,220}?)[,;.!?]\s*(?:ab|now|instead)\s+(.+)$/iu.exec(query.trim());
    if(shifted&&/\b(?:asked|discussed|pooch\w*|puch\w*)\b|पूछा|पूछी/iu.test(shifted[1])&&
      new RegExp(topic,'iu').test(shifted[1])&&new RegExp(topic,'iu').test(shifted[2]))query=shifted[2].trim();
    const replacement=new RegExp(`^(?:(?:meri|mera|mere|my)\\s+)?${topic}\\s+ki\\s+jagah\\s+(?:ab\\s+)?(.+)$`,'iu').exec(query.trim());
    if(replacement&&new RegExp(topic+'|income|savings','iu').test(replacement[1]))query=replacement[1].trim();
    // Drop only a whole, explicitly declined request, never a negative outcome
    // such as "job nahi mili" or a request to explain a delay.
    const retained=query.split(/(?<=[.!?])\s+/u).filter(sentence=>
      !new RegExp(`^(?:(?:meri|mera|mere|my)\\s+)?${topic}\\s+ki\\s+(?:date|timing|tareekh)\\s+nahi\\s+chahiye[.!?]*$`,'iu').test(sentence.trim())&&
      !new RegExp(`^(?:please\\s+)?(?:do not|don't|dont)\\s+(?:discuss|mention|talk about)\\s+(?:my\\s+)?${topic}[.!?]*$`,'iu').test(sentence.trim())).join(' ');
    if(retained&&retained!==query&&new RegExp(topic+'|income|savings','iu').test(retained))query=retained;
    const dismissed=new RegExp(`^(?:(?:(?:meri|mera|mere|my)\\s+)?${topic}\\s+(?:ki\\s+baat\\s+)?(?:chh?od(?:iye|o)|chh?od\\s+(?:do|dijiye)|rehne\\s+(?:do|dijiye))|(?:leave|put)\\s+(?:my\\s+)?${topic}\\s+aside)\\s*[,;:.!?—-]\\s*(.+)$`,'iu').exec(query.trim());
    // Once the whole prefix explicitly dismisses a topic, the remaining
    // reading request owns the turn. Requiring a particular self pronoun
    // misses natural forms such as "Main apna pehla ghar kab kharid paunga?".
    if(dismissed && new RegExp(topic,'iu').test(dismissed[1]))return dismissed[1].trim();
  }
  const correction=new RegExp(`^(?:(?:(?:meri|mera|mere|my)\\s+)?${topic}\\s+(?:nahi|nahin|nhi|नहीं)|not\\s+(?:my\\s+)?${topic})(?:\\s*[,;:]\\s*|\\s+)(.+)$`,'iu').exec(query.trim());
  if (!correction || !new RegExp(topic,'iu').test(correction[1])) return query;
  if (!new RegExp(`^(?:(?:meri|mera|mere|my)\\s+)?(?:${topic}|sister|brother|behen|bhai|friend)|^(?:tell me|please|batao|instead)\\b`,'iu').test(correction[1].trim()) &&
      !new RegExp(`^(?:(?:main|mai|mein)\\s+(?:(?:apne|apni|mere|meri)\\s+)?|I\\s+(?:am asking|was asking|asked)\\s+about\\s+(?:my\\s+)?)${topic}\\b`,'iu').test(correction[1].trim())) return query;
  return correction[1].trim();
}
// Reading vocabulary only. Never rewrite a birth value, name or place.
export function normalizeReadingTypos(query) {
  return query.replace(/\bcarrer\b/giu, 'career').replace(/\bkub\b/giu, 'kab');
}
