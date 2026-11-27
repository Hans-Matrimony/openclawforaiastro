import {readingTopics} from './topic-period-context.mjs';

// Dates may legitimately overlap. Check what the response answers, rather than
// requiring varied dates or trusting a model's approval of a stale draft.
export function unrelatedReadingTopic(reply,plan) {
 if(!plan.topic)return null;
 const paragraphs=reply.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|`[^`\n]*`/gu,'').split(/\n\s*\n/u);
 for(let index=0;index<paragraphs.length;index++) {
  for(const clause of paragraphs[index].split(/[.!?।]+/u)) {
   if(/\b(?:not (?:the|a|your|my) (?:career|job|marriage|relationship|property)|(?:career|job|marriage|property)[^.!?\n]{0,70}(?:lagu nahi|does not apply|doesn't apply|not applicable))\b/iu.test(clause))continue;
   const topics=readingTopics(clause,{multilingual:true});
   const unrelated=topics.filter(({topic})=>topic!==plan.topic);
   for(const {topic} of unrelated) {
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
