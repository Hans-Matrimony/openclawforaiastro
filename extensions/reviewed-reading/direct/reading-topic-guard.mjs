import {readingTopics} from './topic-period-context.mjs';

function careerIncomePreference(clause,paragraph,isLast) {
 // A question about what stable employment means is still a career follow-up.
 // Do not exempt an income forecast or an unrelated savings/debt discussion.
 return isLast&&/[?？]\s*$/u.test(paragraph)&&
  /\b(?:job|role|career|naukri|employment)\b|नौकरी|रोज़गार|रोजगार/iu.test(clause)&&
  /\b(?:regular|steady|stable|monthly|earned)\s+income\b|नियमित\s+आय/iu.test(clause)&&
  /\b(?:matlab|mean|means|meaning|priority|priorities|prefer|important|zaroori|zaruri)\b|मतलब|प्राथमिकता|ज़रूरी|जरूरी/iu.test(clause)&&
  !/\b(?:when|kab|will|hoga|hogi|honge|milegi|milega|increase|decrease|double|grow|improve|badhe\w*|ghate\w*|savings?|debt|loans?|invest\w*|trading|wealth|financ\w*|paisa|paise|bachat|karz)\b|20\d{2}|कब|बढ़े|बचत|कर्ज|निवेश/iu.test(clause);
}

// Dates may legitimately overlap. Check what the response answers, rather than
// requiring varied dates or trusting a model's approval of a stale draft.
export function unrelatedReadingTopic(reply,plan) {
 if(!plan.topic)return null;
 const paragraphs=reply.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|`[^`\n]*`/gu,'').split(/\n\s*\n/u);
 for(let index=0;index<paragraphs.length;index++) {
  for(const clause of paragraphs[index].split(/[.!?।]+/u)) {
   if(/\b(?:not (?:the|a|your|my) (?:career|job|marriage|relationship|property)|(?:career|job|marriage|property)[^.!?\n]{0,70}(?:lagu nahi|does not apply|doesn't apply|not applicable))\b/iu.test(clause))continue;
   // A chart's numbered/ordinal house is not a building. Keep the rest of
   // the clause so an actual purchase/sale claim still triggers the guard.
   const subjectClause=clause.replace(/\b(?:house\s+(?:1[0-2]|[1-9])|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|(?:1[0-2]|[1-9])(?:st|nd|rd|th|ve|va)?)\s+(?:house|ghar))\b/giu,'chart sector');
   const topics=readingTopics(subjectClause,{multilingual:true});
   const unrelated=topics.filter(({topic})=>topic!==plan.topic);
   for(const {topic} of unrelated) {
    if(plan.overview_outlooks?.some(outlook=>outlook.topic===topic||
      (outlook.topic==='marriage'&&topic==='relationship')))continue;
    if(plan.comparison_outlooks?.some(outlook=>outlook.topic===topic))continue;
    if(plan.topic==='career'&&topic==='money'&&careerIncomePreference(clause,paragraphs[index],index===paragraphs.length-1))continue;
    // Pay growth belongs to a career assessment as well as finances. Naming
    // salary must not itself force a valid promotion answer into a fallback.
    if(plan.topic==='career'&&topic==='money'&&/\bsalary\b|वेतन/iu.test(clause)&&
      !/\b(?:financ\w*|money|paisa|paise|income|savings|debt)\b/iu.test(clause))continue;
    // The shared seventh house may be explained for dating/commitment. It
    // must not turn a love-life answer into a marriage prediction or vice versa.
    const sharedRelationship=['marriage','relationship'].includes(plan.topic)&&['marriage','relationship'].includes(topic);
    if(sharedRelationship&&index>0&&/\b(?:house|ghar|bhav|bhava)\b|भाव|सातव|सातवें/iu.test(clause)&&!(/20\d{2}/u.test(clause)))continue;
    return `Answer only the locked ${plan.topic} subject. This draft introduces an unrelated ${topic} answer, explanation or follow-up. Explain the current subject from its own supplied evidence; do not reuse the previous topic's reply.`;
   }
  }
 }
 return null;
}
