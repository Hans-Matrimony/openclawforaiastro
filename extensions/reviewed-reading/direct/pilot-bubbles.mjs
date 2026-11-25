export const pilotBubbleInstruction = "\nPilot bubble format: use one to four short paragraphs separated by blank lines, only as needed. First answer the exact question directly, including the checked window when timing is requested. Next explain the relevant checked reasons. Additional nuance or a warm follow-up is optional; never repeat the verdict or force a question. This replaces explanation-first ordering while preserving all evidence requirements.\n";
// Preserve every word; only swap an unambiguous legacy explanation/verdict pair.
export function pilotAnswerFirst(reply, { timingRequested = false } = {}) {
  if (/```|https?:\/\/|(?:^|\n)\s*\||^\s*[\[{]/u.test(reply)) return reply;
  const parts=reply.trim().split(/\n\s*\n/u);
  if(parts.length>4)return reply;
  if (timingRequested) {
    const index=parts.findIndex(part => /\b20\d{2}\b/u.test(part) && /\b(?:shaadi|shadi|marriage|career|job|naukri|rishte|relationship|paise|income)\b/iu.test(part) && !/[??]\s*$/u.test(part));
    if (index > 0) { const [answer]=parts.splice(index,1); parts.unshift(answer); return parts.join("\n\n"); }
  }
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

export function isSpecificReturnQuestion(query = '') {
  return /\b(?:girlfriend|boyfriend|gf|bf|ex|partner)\b/iu.test(query) &&
    /\b(?:wapas|vaapas|return|come back)\b/iu.test(query);
}

export function specificReturnBoundary(reply, query, language) {
  if (!isSpecificReturnQuestion(query)) return reply;
  // Natal relationship windows cannot answer another person's choice. A failed
  // rewrite must not reattach the generic period fallback to this question.
  if (language === 'english') return "I understand you want to know when they will return. Your chart alone cannot tell us their decision or a return date.\n\nThat depends on what they want and the situation between you both.";
  if (language === 'hindi') return "?? ????? ????? ??? ?? ?? ?? ???????? ????? ???? ?????? ?? ???? ????? ?? ????? ?? ??? ???? ????? ?? ?????\n\n?? ???? ????? ?? ?? ????? ?? ??? ?? ?????? ?? ?????? ???";
  return "Aap jaanna chahte hain ki woh kab lautenge. Sirf aapki kundli se unka faisla ya lautne ka samay nahi bataya ja sakta.\n\nYeh unki marzi aur aap dono ke beech ki sthiti par nirbhar hai.";
}
