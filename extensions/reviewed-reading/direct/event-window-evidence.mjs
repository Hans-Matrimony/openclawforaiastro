const months=[['january','jan','जनवरी'],['february','feb','फरवरी','फ़रवरी'],['march','mar','मार्च'],['april','apr','अप्रैल'],['may','मई'],['june','jun','जून'],['july','jul','जुलाई'],['august','aug','अगस्त'],['september','sep','sept','सितंबर','सितम्बर'],['october','oct','अक्टूबर'],['november','nov','नवंबर','नवम्बर'],['december','dec','दिसंबर','दिसम्बर']];
const monthPattern=months.flat().join('|');
const normalize=text=>text.replace(/[०-९]/gu,char=>String(char.charCodeAt(0)-0x966));
const validDate=text=>/^\d{4}-\d{2}-\d{2}$/u.test(text??'')&&Number.isFinite(Date.parse(text))&&new Date(text).toISOString().slice(0,10)===text;

// Only the new calculator's documented estimates may enter this path. Other
// tools and untyped schedules retain their existing checks and scope.
export function projectedTiming(row,topic) {
 const timing=row?.event_timing;
 if(timing?.schema!=='astrology-timing-estimate-v1'||timing.method!=='pilot-dasha-jupiter-transit-v1'||
   timing.topic!==topic||timing.classification!=='experimental_astrological_estimate'||timing.precision!=='month'||
   !validDate(timing.as_of)||!validDate(timing.horizon?.to))return null;
 const windows=(timing.windows??[]).filter(window=>window.topic===topic&&window.estimated===true&&window.precision==='month'&&
  validDate(window.from)&&validDate(window.to)&&window.from>=timing.as_of&&window.to>=window.from&&window.to<=timing.horizon.to&&
  Array.isArray(window.basis?.transit?.activated_houses)&&window.basis.transit.activated_houses.length>0&&window.basis?.minor?.lord&&
  (topic!=='property'||(window.basis.transit.activated_houses.includes(4)&&window.basis.property?.method==='rasi-fourth-d4-v1'&&
   window.basis.property.event==='property_purchase'&&
   (window.basis.property.rasi_fourth_link?.major===true||window.basis.property.rasi_fourth_link?.minor===true)&&
   window.basis.property.d4?.method==='parasara-chaturthamsa-v1'&&
   (window.basis.property.d4.fourth_link?.major===true||window.basis.property.d4.fourth_link?.minor===true))));
 // Earliest qualifying window, not a model-selected or probability-ranked date.
 const selected=windows.sort((a,b)=>a.from.localeCompare(b.from))[0];
 return {method:timing.method,status:timing.status,as_of:timing.as_of,precision:'month',
  classification:timing.classification,horizon:timing.horizon,
  // A future-window reply does not need today's period inventory. Keeping
  // unrelated current periods here made reviewers demand irrelevant detail.
  ...(!selected&&timing.current_period_basis?{current_period_basis:timing.current_period_basis}:{}),
  ...(selected?{selected:{topic,from:selected.from.slice(0,7),to:selected.to.slice(0,7),
   estimated:true,precision:'month',basis:selected.basis,qualification:selected.qualification}}:{}),limits:timing.limits};
}

function dateTokens(reply) {
 const text=normalize(reply);const tokens=[];
 const add=(key,index,length)=>tokens.push({key,index,length});
 const iso=/\b(20\d{2})-(0[1-9]|1[0-2])(?:-(\d{2}))?\b/gu;
 for(const match of text.matchAll(iso))add(match[1]+'-'+match[2],match.index,match[0].length);
 const named=new RegExp('('+monthPattern+')\\.?\\s+(20\\d{2})(?!\\d)','giu');
 for(const match of text.matchAll(named)) {
  const month=months.findIndex(names=>names.includes(match[1].toLowerCase()));
  add(match[2]+'-'+String(month+1).padStart(2,'0'),match.index,match[0].length);
 }
 const compact=new RegExp('('+monthPattern+')\\.?\\s*(?:to|through|se|से|[-–—])\\s*('+monthPattern+')\\.?\\s+(20\\d{2})(?!\\d)','giu');
 for(const match of text.matchAll(compact)) {
  const first=months.findIndex(names=>names.includes(match[1].toLowerCase()));
  const last=months.findIndex(names=>names.includes(match[2].toLowerCase()));
  add(String(Number(match[3])-(first>last?1:0))+'-'+String(first+1).padStart(2,'0'),match.index,match[0].length);
 }
 return {text,tokens};
}

export function eventWindowReplyIssue(reply,timing,{requested=true}={}) {
 if(!timing?.selected)return null;
 const {text,tokens}=dateTokens(reply);
 if(!requested)return /20\d{2}/u.test(text)?'This follow-up did not ask for dates. Explain the checked answer without another timing window.':null;
 const allowed=new Set([timing.selected.from,timing.selected.to]);
 if(tokens.some(token=>!allowed.has(token.key)))return 'Use only both month/year boundaries of the selected calculated estimate; do not change or combine windows.';
 if(new RegExp('(?:(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?\\s+(?:'+monthPattern+')|(?:'+monthPattern+')\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+20\\d{2}|20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]20\\d{2})','iu').test(text))
  return 'The timing estimate has month precision. Do not turn it into an exact day or event deadline.';
 if([...text.matchAll(/20\d{2}/gu)].some(match=>!tokens.some(token=>match.index>=token.index&&match.index<token.index+token.length)))
  return 'Give both selected month/year boundaries, without additional years or undated numeric ranges.';
 const answer=dateTokens(reply.split(/\n\s*\n/u)[0]).tokens;
 if(![...allowed].every(month=>answer.some(token=>token.key===month)))return 'Include both selected month/year boundaries in the direct answer bubble as an estimate.';
 return null;
}

// Remove only the redundant standalone suffix the user rejected. Keep the
// natural qualification in the actual answer, then validate/review that text.
// A refusal or an absolute prediction must not acquire certainty by cleanup.
export function removeTimingBoilerplate(answer,timing,{focused=false}={}) {
 if(!timing?.selected)return answer;
 const qualified=text=>/\b(?:dikh\w*|sambhavana|anukool|sahayak|supportive|ho sak\w*|may|possible|potentially)\b/iu.test(text);
 const prefix=/^([^.!?;\n]{1,100}?)\s+ki\s+pakki\s+(?:event date|tareekh)\s+nahi,\s*lekin\s+(.+)$/iu.exec(answer);
 if(prefix&&qualified(prefix[2]))answer=prefix[1]+' ke liye '+prefix[2];
 // Captured focused-trial suffixes add no meaning after a qualified window.
 // Restrict this extension to the new trial; preserve absolute or quoted claims.
 if(focused) {
  const redundant=/(?:[;.!?,—–]\s*)(?:(?:yeh|ye)\s+(?:ek\s+)?(?:estimated(?:\s+opportunity)?\s+window\s+hai|mumkin\s+mauka\s+hai,\s*pakki\s+ghatna\s+ya\s+tareekh\s+nahi)|pakki\s+(?:ghatna\s+ya\s+tareekh|guarantee)\s+nahi)[.!?]?\s*$/iu.exec(answer);
  if(redundant) {
   const retained=answer.slice(0,redundant.index).trim();
   if(qualified(retained)&&! /\b(?:pakka|pakki|guaranteed|certain|zaroor)\b/iu.test(retained))answer=retained+'.';
  }
  const fixedDate=/(?:[,;.!?—–]\s*)(?:(?:lekin|par|but|however)\s+)?(?:(?:exact|fixed|pakki)\s+(?:event\s+)?(?:date|tareekh)\s+(?:tay\s+|confirm\s+|fixed\s+)?nahi(?:\s+hai)?|(?:this|it)\s+is\s+not\s+(?:an?\s+)?(?:exact|fixed|guaranteed)\s+(?:event\s+)?date)[.!?]?\s*$/iu.exec(answer);
  if(fixedDate) {
   const retained=answer.slice(0,fixedDate.index).trim();
   if(qualified(retained)&&! /\b(?:pakka|pakki|guaranteed|certain|zaroor)\b/iu.test(retained))answer=retained+'.';
  }
  const exactDay=/(?:[,;.!?—–]\s*)(?:chart\s+se\s+)?exact\s+din(?:\s+chart\s+se)?\s+nahi\s+diya\s+gaya\s+hai[.!?]?\s*$/iu.exec(answer);
  if(exactDay) {
   const retained=answer.slice(0,exactDay.index).trim();
   if(qualified(retained)&&! /\b(?:pakka|pakki|guaranteed|certain|zaroor)\b/iu.test(retained))answer=retained+'.';
  }
 }
 const suffix=/(?:[;.!?]\s*|,\s*)(?:(?:(?:yeh|ye)\s+(?:andazati samay hai|estimated window hai)|ise sambhavana samjhein)\s*,\s*)?pakki\s+(?:event date|tareekh)\s+nahi[.!?]?\s*$/iu;
 const match=suffix.exec(answer);
 if(!match)return answer;
 const retained=answer.slice(0,match.index).trim();
 if(!qualified(retained))return answer;
 return retained+'.';
}

// A style edit must not invalidate checked date evidence or create another
// reading. Catch the mechanical phrasing seen in captured Hinglish replies
// even when the model reviewer overlooks it.
export function eventWindowPresentationIssue(reply,timing,value) {
 if(!timing?.selected||value.language!=='hinglish')return null;
 const answer=reply.split(/\n\s*\n/u)[0];
 if(/\b(?:(?:estimated|specific|exact)(?: timing)? window|pakki (?:event date|tareekh)|pakka event date)\b/iu.test(answer))
  return 'Keep both checked month/year boundaries and their natural uncertainty. Use everyday Hinglish such as samay rather than English window terminology; remove the extra fixed-date disclaimer. Preserve every checked reason. This is a wording edit only.';
 return null;
}
