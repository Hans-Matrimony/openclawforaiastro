import {readingTopics} from './topic-period-context.mjs';
import {correctedReadingSubject} from './personal-query.mjs';

// Keep dialogue within the current reading episode. Birth provenance and saved
// personal facts have their own inputs; prior predictions are never evidence.
export function focusedReadingDialogue(value,topic) {
 const history=(value.history??[]).slice(-12);
 const otherTopic=text=>readingTopics(correctedReadingSubject(text,{allowDismissal:true}),{multilingual:true})
  .some(previous=>previous.topic!==topic);
 let start=0;
 for(let i=history.length-1;i>=0;i--) {
  if(history[i].role!=='user')continue;
  if(otherTopic(history[i].text)) {
   start=i+1;
   while(start<history.length&&history[start].role!=='user')start++;
   break;
  }
 }
 return history.slice(start).filter(turn=>turn.role!=='assistant'||!otherTopic(turn.text));
}
