export const pilotBubbleInstruction = "\nPilot bubble format: use one to four short paragraphs separated by blank lines, only as needed. First answer the exact question directly, including the checked window when timing is requested. Next explain the relevant checked reasons. Additional nuance or a warm follow-up is optional; never repeat the verdict or force a question. This replaces explanation-first ordering while preserving all evidence requirements.\n";
// Preserve every word; only swap an unambiguous legacy explanation/verdict pair.
export function pilotAnswerFirst(reply) {
  if (/```|https?:\/\/|(?:^|\n)\s*\||^\s*[\[{]/u.test(reply)) return reply;
  const parts=reply.trim().split(/\n\s*\n/u);
  if(parts.length>4)return reply;
  const reason=/\b(?:house\s*\d|\d+(?:ve|th|st|nd|rd)?\s+(?:ghar|house)|drishti|placement|bindus|majbooti|sthiti)\b/iu;
  const answer=/\b(?:shaadi|shadi|marriage|career|job|naukri|relationship|rishte|paise|financial)\b/iu;
  const sentences=parts[0].split(/(?<=[.!?])\s+/u);
  if(parts.length<4 && sentences.length>1 && answer.test(sentences[0]) && !reason.test(sentences[0]) && reason.test(sentences.slice(1).join(' '))) {
    parts.splice(0,1,sentences[0],sentences.slice(1).join(' '));
    return parts.join('\n\n');
  }
  if(parts.length<2)return reply;
  if(reason.test(parts[0])&&!reason.test(parts[1])&&answer.test(parts[1])&&!/[??]\s*$/u.test(parts[1])) {
    [parts[0],parts[1]]=[parts[1],parts[0]];return parts.join('\n\n');
  }
  return reply;
}

export function specificReturnBoundary(reply, query, language) {
  if (!/\b(?:girlfriend|boyfriend|gf|bf|ex|partner)\b/iu.test(query) ||
      !/\b(?:wapas|vaapas|return|come back)\b/iu.test(query)) return reply;
  const limitation = language === 'english'
    ? "Your chart cannot establish whether or when this specific person will return. The relationship outlook below is general, not a return date."
    : language === 'hindi'
      ? "आपकी कुंडली से यह तय नहीं होता कि वे वापस आएँगे या कब आएँगे। नीचे रिश्तों के सामान्य संकेत हैं, उनके लौटने की तारीख नहीं।"
      : "Aapki kundli se yeh tay nahi hota ki woh wapas aayenge ya kab aayenge. Neeche rishte ke general sanket hain, unke lautne ki tareekh nahi.";
  if (reply.startsWith(limitation)) return reply;
  return limitation + '\n\n' + reply;
}
