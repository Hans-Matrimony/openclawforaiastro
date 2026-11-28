// Prior assistant text establishes what was said, not that its forecast was
// correct. This boundary allows explanation without silently recalculating it.
export function previousReply(value) {
  if(value.reply_to)return value.reply_to.role==='assistant'?value.reply_to.text:null;
  return [...(value.history??[])].reverse().find(turn=>turn.role==='assistant')?.text??null;
}

export function explanationContext(value,intent) {
  if(intent?.scope!=='explain_previous'||intent.timing)return null;
  const text=previousReply(value);
  return typeof text==='string'&&text.trim()?{text:text.slice(0,8000),status:'previous_statement_not_new_evidence'}:null;
}

export const explanationInstruction=`For scope explain_previous, explain the meaning of the supplied previous_statement in plain language. It proves only what the assistant said, not a fresh forecast. You may refer to its dates and qualifications as the previous answer ("I meant", "maine ... kaha tha"), preserving their uncertainty; do not treat those dates as newly verified facts. Do not contradict or replace that answer with a new assessment, promise an outcome, invent a chart factor, request another calculation, or ask for birth details. Address the specific wording or quoted reply the user points to. Earlier unrelated turns must not replace that referent. A new timing or chart-assessment request still requires checked_reading.`;

export function asksBirthDetailQuestion(reply) {
  return /[^!?\n]*(?:\bbirth\s*(?:details|date|time|place)\b|\b(?:date|time|place)\s+of\s+birth\b|\b(?:dob|tob)\b|\b(?:janam|janm)\s+(?:ki\s+|ka\s+)?(?:tareekh|samay|jagah|time)\b|जन्म\s*(?:का\s*|की\s*)?(?:समय|तारीख|स्थान))[^!?\n]*[?？]/iu.test(reply);
}

const monthNames=new Map();
for(const locale of ['en','hi','mr','bn','ta','te','gu','ur'])for(const style of ['long','short']) {
  const formatter=new Intl.DateTimeFormat(locale,{month:style,timeZone:'UTC'});
  for(let month=0;month<12;month++)monthNames.set(formatter.format(new Date(Date.UTC(2020,month,1))).toLocaleLowerCase().replace(/\.$/u,''),month);
}
function monthYears(text) {
  const pairs=[];
  for(const match of text.toLocaleLowerCase().matchAll(/([\p{L}\p{M}.]+)\s+((?:19|20)\d{2})\b/gu)) {
    const month=monthNames.get(match[1].replace(/\.$/u,''));
    if(month!==undefined)pairs.push(month+':'+match[2]);
  }
  return pairs;
}

export function explanationIssue(reply,value,intent) {
  const source=explanationContext(value,intent);
  if(!source)return 'An explanation needs the actual preceding assistant reply; do not invent its contents.';
  // Reusing a year in a clearly attributed explanation is allowed. Adding a
  // new year is a different forecast, even when the writer calls it an example.
  const years=reply.match(/\b(?:19|20)\d{2}\b/gu)??[];
  if(years.some(year=>!source.text.includes(year)))return 'The explanation introduces an event year absent from the previous reply.';
  const allowed=new Set(monthYears(source.text));
  if(monthYears(reply).some(pair=>!allowed.has(pair)))return 'The explanation changes a month/year boundary from the previous reply.';
  if(years.length&&!/\b(?:meant|said|saying|earlier|previous|matlab|maine|pichhl\w*|kaha)\b|मतलब|कहा|बताया|म्हणजे|अर्थ|মানে|அர்த்தம்|అర్థం|મતલબ|مطلب/iu.test(reply))
    return 'Attribute these dates to the previous answer instead of presenting them as a newly verified forecast.';
  if(!/\bbirth\s*time\b|\b(?:janam|janm)\b|जन्म/iu.test(source.text)&&
     /\d{1,2}[:.]\d{2}\s*(?:a\.?m\.?|p\.?m\.?)/iu.test(reply)&&
     /\bbirth\s*time\b|\b(?:janam|janm)\s+(?:ka\s+)?(?:samay|time)\b|जन्म\s*(?:का\s*)?समय/iu.test(reply))
    return 'Do not introduce a birth clock or birth-time confirmation while explaining the previous answer.';
  if(!/\b(?:unclear|clear nahi|saaf nahi|pata nahi)\b|\b(?:naya|new|fresh)\s+(?:check|reading|calculation)\b/iu.test(source.text)&&
     /\b(?:kundli|kundali|chart)\b[^.!?\n]{0,90}\b(?:unclear|clear nahi|saaf nahi|pata nahi)\b|\b(?:naya|new|fresh)\s+(?:check|reading|calculation)\b/iu.test(reply))
    return 'Explain the previous statement instead of replacing it with an unsupported unclear assessment or a new calculation.';
  return null;
}
