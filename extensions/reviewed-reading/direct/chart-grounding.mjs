import { chartClaimConflicts } from './chart-claims.mjs';

const planets = 'Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu';
const housePattern = /\bhouse\s+(\d{1,2})\b|\b(\d{1,2})(?:ve|ven|va|we|th|st|nd|rd)?\s+(?:ghar|house)\b/gi;
const houses = text => [...text.matchAll(housePattern)].map(m=>Number(m[1]||m[2])).filter(h=>h>=1&&h<=12);
const unique = values => [...new Set(values)];
const rowsFrom = results => results.flatMap(raw=>{try{const r=JSON.parse(raw);return r.engine==='local-sweph-v2'?[r]:[];}catch{return [];}});
function chartFrom(rows) {
  const charts=rows.filter(r=>r.birth_chart).map(r=>r.birth_chart);
  return unique(charts.map(c=>JSON.stringify(c))).length===1?charts[0]:null;
}
export const isChartClarification = query => /\b(?:verify|clarif\w*|strength|basis|natal|badal|changed?|different|alag)\b/iu.test(query) &&
  /\b(?:chart|kundli|ghar|house)\b/iu.test(query);

function careerCautionConflicts(reply, rows, query) {
  if (!/\b(?:career|job|work|naukri|promotion)\b/iu.test(query)) return [];
  const signals = rows.flatMap(row => Array.isArray(row.verdict_signals) ? row.verdict_signals : [])
    .filter(signal => signal?.area === 'career' && Array.isArray(signal.negative));
  if (!signals.length) return [];
  const negative = signals.flatMap(signal => signal.negative).filter(factor => typeof factor === 'string');
  const checked = negative.join('\n');
  const currentLords = rows.flatMap(row => [row.dasha?.current_mahadasha?.lord, row.dasha?.current_antardasha?.lord]).filter(Boolean);
  const indirectPeriodCaution = /\bcurrent dasha lords\b.*\b(?:linked nahi|not (?:directly )?linked)\b/iu.test(checked);
  const subjects = `(${planets})(?:\\s+(?:and|aur)\\s+(?:${planets}))*`;
  const claim = new RegExp(`\\b(${subjects})\\s+(?:(?:is|are|be|may|can|could|might)\\s+)*(?:weakens?|reduces?|blocks?|weakening|reducing|blocking|causes?|causing)\\s+(?:the\\s+)?(?:support|career|progress|delays?|obstacles?)\\b`, 'giu');
  const conflicts = [];
  const prose = reply.replace(/```[^]*?```|[“"][^”"]*[”"]/gu, '');
  for (const clause of prose.split(/[.!?\n;]+/u)) {
    const internalTrait = new RegExp(`\\b(?:${planets})\\b[^,;.!?]{0,60}\\b(?:adds?|brings?|means?|creates?|indicates?|gives?)\\s+(?:an?\\s+)?internal caution\\b`, 'iu').exec(clause);
    if (internalTrait && !/\binternal caution\b/iu.test(checked) &&
        !/\b(?:not|no|never|earlier|previously|said|claimed)\b/iu.test(clause.slice(0, clause.toLowerCase().indexOf('internal caution')))) {
      conflicts.push({type:'unsupported_career_consequence',reason:'The returned career factors do not establish internal caution or a personality trait. Keep the actual supported limitation; do not replace it with an invented psychological meaning.'});
    }
    for (const planet of unique([...clause.matchAll(new RegExp(`\\b(${planets})\\b`, 'giu'))].map(match => match[1]))) {
      const delayFactor = negative.some(factor => new RegExp(`\\b${planet}\\b`, 'iu').test(factor) && /\b(?:delay\w*|atkaav|rukawat\w*)\b/iu.test(factor));
      if (delayFactor && /\b(?:affects?|influences?)\s+(?:only\s+)?relationships?\b/iu.test(clause) &&
          /\bnot\s+(?:your\s+)?(?:career|work|progress|inner drive)\b/iu.test(clause) &&
          !/\b(?:earlier|previously|said|claimed)\b/iu.test(clause)) {
        conflicts.push({type:'denied_career_caution',planet,reason:'The returned career caution cannot be reassigned exclusively to relationships. Preserve the qualified career factor.'});
      }
      if (delayFactor && /\bnot delays?\b/iu.test(clause) && !/\b(?:earlier|previously|said|claimed)\b/iu.test(clause))
        conflicts.push({type:'denied_career_caution',planet,reason:'The returned career factor includes a possible delay or obstacle. Preserve that qualified limitation instead of denying it or substituting an unsupported internal trait; it is not a guaranteed outcome.'});
    }
    if (/\b(?:not|never|nahi|nahin|earlier|previously|said|claimed)\b/iu.test(clause)) continue;
    for (const match of clause.matchAll(claim)) {
      for (const planet of unique([...match[1].matchAll(new RegExp(`\\b(${planets})\\b`, 'giu'))].map(item => item[1]))) {
        const supported = new RegExp(`\\b${planet}\\b`, 'iu').test(checked) ||
          (indirectPeriodCaution && currentLords.some(lord => String(lord).toLowerCase() === planet.toLowerCase()));
        if (!supported) conflicts.push({type:'unsupported_career_caution',planet,
          reason:'A natal placement alone does not establish this career caution. Attribute a weakening effect only to the returned career negative factors or their explicitly linked current period lords; omit the unsupported extra cause and retain the checked support and uncertainty.'});
      }
    }
  }
  return conflicts;
}

// Check returned facts only. This does not calculate aspects or house scores.
export function chartGroundingConflicts(reply, results, value = {}) {
  const rows=rowsFrom(results), chart=chartFrom(rows), conflicts=[];
  if (!chart) return conflicts;
  conflicts.push(...careerCautionConflicts(reply, rows, value.query ?? ''));
  for (const clause of reply.split(/[.!?\n;]+/)) {
    const mentioned=unique(houses(clause));
    if (mentioned.length!==1) continue;
    const house=mentioned[0], source=chart.ashtakavarga_house_bindus?.[`house_${house}`];
    if (Number.isFinite(source?.bindus)) {
      const numericClaims=[...clause.matchAll(/\b(\d{1,2})(?:\/(\d{1,3}))?\s+(?:points?|bindus?)\b|\b(?:points?|bindus?)\s+(?:sirf\s+)?(\d{1,2})(?:\/(\d{1,3}))?\b/gi)];
      for(const match of numericClaims) {
        // A quoted earlier error may be acknowledged without reasserting it.
        const earlier=/\b(?:pehle|earlier|previously|old)\b/i.test(clause.slice(0,match.index)) &&
          /\b(?:kaha|bataya|claimed|said|incorrect|galat)\b/i.test(clause.slice(match.index));
        const claimed=Number(match[1]||match[3]),scale=match[2]||match[4];
        if (!earlier && (claimed!==source.bindus || (scale && Number(scale)!==48)))
          conflicts.push({type:'house_points',house,expected:source.bindus,claimed});
      }
    }
    if (isChartClarification(value.query??'') && !/\b(?:transit|gochar|gochara|not|nahi|nahin)\b/i.test(clause)) {
      const aspectSubjects=new RegExp(`\\b(${planets})(?:\\s+(?:aur|and)\\s+(${planets}))?\\s+(?:(?:ki|ka)\\s+)?(?:drishti|aspects?)\\b`,'gi');
      const names=unique([...clause.matchAll(aspectSubjects)].flatMap(m=>[m[1],m[2]].filter(Boolean)));
      const factors=rows.flatMap(r=>(Array.isArray(r.verdict_signals)?r.verdict_signals:[]).flatMap(s=>
        [...(Array.isArray(s?.positive)?s.positive:[]),...(Array.isArray(s?.negative)?s.negative:[])]));
      for(const planet of names) {
        const checked=factors.some(f=>new RegExp(`\\b${planet}\\b.*(?:drishti|aspect).*house ${house}\\b`,'i').test(f));
        if(!checked)conflicts.push({type:'unverified_natal_aspect',planet,house,reason:'The returned factors do not verify this natal aspect. Omit the claim; do not infer it from a period lord or a transit placement.'});
      }
    }
  }
  for(const sentence of reply.split(/[.!?\n]+/)) {
    if(!/\b(?:overestimated|underestimated)\b/i.test(sentence)) continue;
    for(const match of sentence.matchAll(new RegExp(`\\b(${planets})\\b`,'gi'))) {
      const checkedCorrection=(value.history??[]).filter(t=>t.role==='assistant'&&typeof t.text==='string').some(t=>
        chartClaimConflicts(t.text,results).some(c=>[c.planet,c.claimed].some(p=>String(p).toLowerCase()===match[1].toLowerCase())));
      if(!checkedCorrection)conflicts.push({type:'unsupported_reading_revision',planet:match[1],reason:'An older interpretation being overestimated is not established by the current chart. State the current checked facts without inventing why a prior answer differed.'});
    }
  }
  return conflicts;
}

function monthYear(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))return null;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value
    ?d.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}):null;
}

export function chartClarificationFallback(results, language, query) {
  if(!isChartClarification(query))return null;
  const rows=rowsFrom(results),chart=chartFrom(rows),requested=unique(houses(query));
  if(!chart||requested.length!==1)return null;
  const house=requested[0],english=language==='english';
  const occupants=(Array.isArray(chart.planets)?chart.planets:[]).flatMap(p=>{
    const m=new RegExp(`^(${planets}):.*?\\| house ${house}\\b`,'i').exec(p);return m?[m[1]]:[];
  });
  const strength=chart.ashtakavarga_house_bindus?.[`house_${house}`]?.verdict;
  const facts=[];
  if(occupants.length)facts.push(english?`The natal chart places ${occupants.join(' and ')} in house ${house}.`:`Janam kundli mein ${house}ve ghar mein ${occupants.join(' aur ')} hain.`);
  if(/weak|strong/i.test(strength??'')){
    const weak=/weak/i.test(strength);
    facts.push(english?`Its separate house-strength indicator is ${weak?'weak':'strong'}.`:`Is ghar ka alag strength sanket ${weak?'kamzor':'mazboot'} hai.`);
  }
  if(!facts.length)return null;
  const requestedPlanets=unique([...query.matchAll(new RegExp(`\\b(${planets})\\b`,'gi'))].map(m=>m[1].toLowerCase()));
  const schedules=rows.filter(r=>r.dasha).map(r=>r.dasha);
  let periodText='';
  if(requestedPlanets.length===1&&unique(schedules.map(s=>JSON.stringify(s))).length===1){
    const s=schedules[0],p=[s.current_antardasha,...(s.upcoming_antardashas??[])].find(p=>p?.lord?.toLowerCase()===requestedPlanets[0]);
    const from=monthYear(p?.from),to=monthYear(p?.to),major=s.current_mahadasha;
    if(from&&to&&p.from<p.to){
      const parent=major&&p.from>=major.from&&p.to<=major.to?major.lord:null;
      periodText=english?`${p.lord} antardasha runs ${from} to ${to}${parent?` within ${parent} mahadasha`:''}.`:
        `${parent?parent+' mahadasha ke andar ':''}${p.lord} antardasha ${from} se ${to} tak hai.`;
    }
  }
  return facts.join(' ')+(periodText?'\n\n'+periodText:'');
}
