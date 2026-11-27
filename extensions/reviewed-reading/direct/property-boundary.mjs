import {isPropertyQuestion,propertyEventKind} from './property-intent.mjs';
import {asksForTiming} from './reading-intent.mjs';
import {canAskFollowup} from './friendly-closing.mjs';
import {propertySubjectBoundary} from './property-subject.mjs';
import {correctedReadingSubject} from './personal-query.mjs';

// These requests must not acquire purchase dates through a shared property
// keyword. Practical questions still use the ordinary conversation route.
export function propertyCapabilityBoundary(value) {
 value={...value,query:correctedReadingSubject(value.query,{allowDismissal:true})};
 if(!isPropertyQuestion(value.query)||!asksForTiming(value.query,{exactDateRequests:true}))return null;
 if(/\b(?:tax|documents?|registration|paperwork|process|fees?|stamp duty|appointment)\b/iu.test(value.query)&&
  !/\b(?:chart|kundli|astrology|predict\w*)\b/iu.test(value.query))return null;
 const event=propertyEventKind(value.query);
 if(event==='purchase')return propertySubjectBoundary(value);
 const lang=value.language;
 const replies={
  sale:['This reading does not establish a month or year for selling your property.','Is reading se property bechne ka mahina ya saal nahi nikalta.','इस रीडिंग से संपत्ति बेचने का महीना या साल नहीं निकलता।'],
  construction:['This reading does not establish when construction will start or finish.','Is reading se ghar banwane ka shuru ya poora hone ka samay nahi nikalta.','इस रीडिंग से घर का निर्माण शुरू या पूरा होने का समय नहीं निकलता।'],
  lender_decision:["A chart cannot establish when a bank will approve your loan.",'Kundli se bank ke loan approve karne ka samay nahi nikalta.','कुंडली से बैंक के लोन मंज़ूर करने का समय नहीं निकलता।'],
  clarify:['Are you asking about buying, selling or building a property?','Aap property kharidne, bechne ya banwane ka samay pooch rahe hain?','आप संपत्ति खरीदने, बेचने या बनवाने का समय पूछ रहे हैं?'],
 };
 const kind=event??'clarify';
 let reply=replies[kind][lang==='english'?0:lang==='hindi'?2:1];
 if(kind==='clarify'&&!canAskFollowup('Normal prose.',value,true))reply=lang==='english'?
  'The property event is unclear, so a timing calculation cannot be selected.':lang==='hindi'?
  'संपत्ति से जुड़ा कौन सा काम है, यह स्पष्ट नहीं है; इसलिए समय की गणना नहीं चुनी जा सकती।':
  'Property se juda kaunsa kaam hai, yeh saaf nahi hai; isliye samay ki ganana nahi chuni ja sakti.';
 return {kind,supported_event:'property_purchase',reply};
}
