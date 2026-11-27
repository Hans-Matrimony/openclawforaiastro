const protectedText=/```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|https?:\/\/\S+/gu;

// Only an explicit current name-recognition question opens this introduction.
// A greeting, a reading, a quotation or distress must not become a name form.
export function firstContactPolicy(value,savedContext=[]) {
  if(value.user_name?.trim()||value.reply_to||savedContext.length)return null;
  if((value.history??[]).some(turn=>turn.role==='user'&&/\b(?:my name is|call me|mera naam)\b|मेरा\s+नाम|माझं\s+नाव|আমার\s+নাম/iu.test(turn.text)))return null;
  const text=String(value.query??'').replace(protectedText,'');
  if(!/\b(?:do you (?:know|remember) my name|what(?:'s| is) my name|(?:mera|aapko mera)\s+naam\s+(?:yaad|pata|jaante))\b|मेरा\s+नाम\s+(?:याद|पता|जानते)/iu.test(text))return null;
  return {instruction:'This is an introduction/name-recognition question with no established user name in the supplied profile, user dialogue or saved context. Say briefly that the name is not available, then naturally ask what name to use. Do not guess a name, repeat a how-are-you question, list marriage/career services, request birth details or imply a previous relationship. Keep the user as the person invited to speak: respectful aap can baat kar sakte hain, not mujhse baat kar sakti hoon. Do not claim a name has been saved or promise to remember everything, all their conversations or every detail forever.'};
}

export function firstContactIssue(reply,policy) {
  if(!policy)return null;
  const questions=reply.match(/[^.!?।\n]*[?？]/gu)??[];
  if(!questions.some(q=>/\b(?:name|naam)\b|नाम|नाव|নাম/iu.test(q)))
    return 'For this explicit unknown-name introduction, briefly acknowledge that no name is available and ask what name to use instead of another wellbeing question or a service menu.';
  return null;
}
