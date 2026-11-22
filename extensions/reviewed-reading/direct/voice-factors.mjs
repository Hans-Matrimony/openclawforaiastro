import {fallbackFactor} from './fallback-factors.mjs';

const planet='(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)';
const house='(1[0-2]|[1-9])';
const names={Sun:'Surya',Moon:'Chandra',Mars:'Mangal',Mercury:'Budh',Jupiter:'Guru',Venus:'Shukra',Saturn:'Shani',Rahu:'Rahu',Ketu:'Ketu'};
const strong='(?:Exalted \\(uccha\\)|Own/Mooltrikona \\(strong\\)|Own sign \\(strong\\))';
const rule=pattern=>new RegExp('^'+pattern+'$');

// Exact phrases emitted by the checked local engine, not a general translator.
// Unknown claims retain the full agent. Other delivery surfaces keep their
// existing renderer. Do not infer a future event from a natal/current factor.
export function voiceFactor(source, english) {
  if(typeof source!=='string')return null;
  let m=rule(`house ${house} lord ${planet} ${strong}, ${house}th house mein`).exec(source);
  if(m)return english?`${m[2]}, which rules house ${m[1]}, is strong in your birth chart`:`${m[1]}ve ghar ke swami ${names[m[2]]} ki janam kundli mein sthiti majboot hai`;
  m=rule(`house ${house} lord ${planet} DEBILITATED, ${house}th house mein — real challenge signal`).exec(source);
  if(m)return english?`${m[2]}, which rules house ${m[1]}, has a weak placement in your birth chart`:`${m[1]}ve ghar ke swami ${names[m[2]]} ki janam kundli mein sthiti kamzor hai`;
  m=rule(`house ${house} lord ${planet} combust \\(Sun ke paas\\) — power weak`).exec(source);
  if(m)return english?`${m[2]}, which rules house ${m[1]}, has a limiting placement in your birth chart`:`${m[1]}ve ghar ke swami ${names[m[2]]} ki sthiti ka sahyog kam hai`;
  m=rule(`karak ${planet} ${strong}, ${house}th house mein`).exec(source);
  if(m)return english?`${m[1]} is strong in your birth chart and supports this area`:`${names[m[1]]} ki janam kundli mein majboot sthiti is maamle mein sahyog deti hai`;
  m=rule(`karak ${planet} DEBILITATED \\((?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\\) — karak weak`).exec(source);
  if(m)return english?`${m[1]}'s weak placement is a limiting factor for this reading`:`${names[m[1]]} ki kamzor sthiti is maamle mein sahyog kam karti hai`;
  m=rule(`karak ${planet} combust — results delayed`).exec(source);
  if(m)return english?`${m[1]}'s placement indicates possible delays`:`${names[m[1]]} ki sthiti deri ka sanket deti hai`;
  m=rule(`(Jupiter|Saturn|Mars) ki drishti house ${house} par — (protection|pressure/delay)`).exec(source);
  if(m&&((m[1]==='Jupiter')===(m[3]==='protection')))return english?
    `${m[1]}'s influence on house ${m[2]} ${m[1]==='Jupiter'?'is supportive':'indicates pressure or possible delays'}`:
    `${names[m[1]]} ki ${m[2]}ve ghar par drishti ${m[1]==='Jupiter'?'sahyog':'dabav aur deri'} ka sanket deti hai`;
  if(rule(`current dasha/antardasha lord \\(${planet}(?:\\+${planet})?\\) is area se linked hai — period ACTIVE hai`).test(source))
    return english?'Your current planetary period is linked to this area':'Maujooda dasha ka is sawaal se sambandh hai';
  const known = rule(`(?:benefic|malefic) ${planet} house ${house} mein(?: baitha hai)?`).test(source) ||
    rule(`${planet} retrograde(?: [—–-])? results me Atkaav`).test(source) ||
    /^current dasha lords is area se directly linked nahi(?: [—–-])? external push kam$/.test(source);
  const strength = rule(`house ${house} \\((?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\\) bindus (?:sirf )?(\\d{1,2})/48 [—–-] (?:strong|weak) support`).exec(source);
  if(!known&&!(strength&&Number(strength[2])<=48))return null;
  const rendered=fallbackFactor(source,english);
  return rendered&&rendered!==source?rendered:null;
}
