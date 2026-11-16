// Compare explicit dignity labels already returned by the calculator. Never
// calculate dignity, infer an outcome, or confuse a transit with a natal fact.
const aliases={Sun:'Sun|Surya',Moon:'Moon|Chandra',Mars:'Mars|Mangal',Mercury:'Mercury|Budh',Jupiter:'Jupiter|Guru',Venus:'Venus|Shukra',Saturn:'Saturn|Shani',Rahu:'Rahu',Ketu:'Ketu'};
const dignity=text=>/\b(?:debilitated|debilitation|neecha|neech)\b/iu.test(text)?'debilitated':/\b(?:exalted|exaltation|uccha|uchcha)\b/iu.test(text)?'exalted':/\bown sign\b|\bswa(?:rashi|rashi)\b/iu.test(text)?'own sign':null;
export function planetDignityConflicts(reply,rows){
 const conflicts=[];
 for(const [planet,names] of Object.entries(aliases)){
  const checked=[...new Set(rows.flatMap(row=>(row.birth_chart?.planets??[]).filter(text=>new RegExp('^'+planet+':','iu').test(text)).map(dignity)).filter(Boolean))];
  if(checked.length!==1)continue;
  const claims=new RegExp('\\b(?:'+names+')\\s+(?:(?:is|natal|janam|kundli|mein|me|apni|in|its)\\s+)*(debilitated|neecha|neech|exalted|uccha|uchcha|own sign|swarashi)\\b','giu');
  for(const sentence of reply.split(/[.!?\n;]+/u)){
   if(/\b(?:transit|gochar|example|definition|pehle|earlier|previously|said|claimed)\b/iu.test(sentence))continue;
   for(const match of sentence.matchAll(claims)){
    const tail=sentence.slice(match.index+match[0].length);
    if(/^\s*(?:(?:hai|is)\s+)?(?:nahi|nahin|not)\b/iu.test(tail))continue;
    const claimed=dignity(match[1]);
    if(claimed!==checked[0])conflicts.push({type:'planet_dignity',planet,expected:checked[0],claimed,reason:'The returned natal chart explicitly labels this dignity differently. Use that checked label or omit the dignity claim; do not copy it from earlier replies.'});
   }
  }
 }
 return conflicts;
}
