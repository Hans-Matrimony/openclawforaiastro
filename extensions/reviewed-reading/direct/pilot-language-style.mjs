const protectedText=/```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|https?:\/\/\S+/gu;

// The caller gates this to focused pilots. Language mentions, quotations and
// earlier turns are not instructions to change the current reply's language.
export function pilotMarathiStyle(value) {
  const text=String(value.query??'').replace(protectedText,'');
  const requests=[];
  for(const match of text.matchAll(/(?:^|[.!?।\n])\s*(?:please\s+)?(?:reply|respond|answer|write|explain)(?:\s+(?:it|this|that))?\s+(?:only\s+)?in\s+(marathi|english|hindi|hinglish|bengali)\b/giu))
    requests.push({at:match.index,marathi:match[1].toLowerCase()==='marathi'});
  for(const match of text.matchAll(/(?:^|[.!?।\n])\s*(?:कृपया\s+)?मराठीत\s+(?:उत्तर\s+द्या|सांगा|समजावून\s+सांगा|लिहा)/gu))
    requests.push({at:match.index,marathi:true});
  for(const match of text.matchAll(/(?:^|[.!?।\n])\s*(?:ab\s+|please\s+)?(?:Roman Hindi|Hinglish|Hindi|English)\s+mein\b(?!\s+(?:mat|nahi|nahin)\b)/giu))
    requests.push({at:match.index,marathi:false});
  const enabled=requests.length?requests.sort((a,b)=>a.at-b.at).at(-1).marathi:
    /^(?:marathi|mr)$/iu.test(value.language??'')&&!/मराठीत[^।.!?\n]{0,30}(?:नको|नका)/u.test(text);
  return enabled?marathiStyle:'';
}

const marathiStyle=`Marathi wording: use clear, everyday Marathi in Devanagari, with natural case endings, subject/verb agreement and respectful तुम्ही/तुमच्या address. Do not translate Hindi or English word for word. For example, use "ठराविक वेळेच्या नोकरीत पगार कमी असला तरी…", not "ठरलेल्या वेळेची नोकरीत…". Prefer "जास्त पगाराची नोकरी, पण शनिवारीही काम" over "शनिवारच्या कामाची नोकरी". Use short, complete sentences; separate a condition from its advice instead of joining several clauses into a run-on sentence. Preserve the user's actual priority and actor, every supported fact, uncertainty, number and date. Do not invent benefits, salary amounts or events while improving wording. A follow-up must sound natural in Marathi and concern a relevant unanswered detail. In a requested message draft, preserve the speaker, recipient and intended register. Do not force a question into a draft, listening-only request or goodbye.`;

export const marathiReviewInstruction=`Review Marathi grammar and idiom as well as the existing factual/intent checks. Return the existing status and issues fields plus "presentation_issue":"" when no wording correction is needed, or a short specific wording defect otherwise. Understandable but awkward case endings, literal translations and run-on sentences are presentation issues, not factual rejections. Reject factual, actor, intent or explicit-format violations under the existing rules. For an accepted answer, issues stays empty even when presentation_issue requests a wording polish. Do not reject an accurate answer merely because another synonym is preferable.`;
