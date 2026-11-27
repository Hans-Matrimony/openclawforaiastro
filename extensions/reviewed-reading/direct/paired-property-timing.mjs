import {isPropertyQuestion,propertyEventKind} from './property-intent.mjs';
import {asksForTiming} from './reading-intent.mjs';
import {projectedTiming} from './event-window-evidence.mjs';

// A current explicit comparison is distinct from an abbreviated follow-up.
// Keep this limited to two independently supported self topics; another
// person's details or a declined topic must not inherit the selected profile.
export function pairedPropertyTimingRequest(query) {
 if(!isPropertyQuestion(query)||propertyEventKind(query)!=='purchase'||
  !/\b(?:career|job|naukri|promotion)\b|करियर|नौकरी/iu.test(query)||
  /\b(?:sister|brother|mother|father|friend|girlfriend|boyfriend|behen|bhai|dost)\b/iu.test(query))return false;
 return /\b(?:same|similar|overlap\w*|dono|both|ek\s+(?:hi|jaise)|ek\s+jais[aei])\b|एक ही|एक जैसे|दोनों/iu.test(query)||
  (asksForTiming(query)&&((query.match(/\b(?:kab|when)\b|कब/giu)??[]).length>1));
}

const names={english:['career','buying your home'],hinglish:['career','ghar kharidne'],hindi:['करियर','घर खरीदने']};
const planetNames={Saturn:['Saturn','Shani','शनि'],Mars:['Mars','Mangal','मंगल'],Venus:['Venus','Shukra','शुक्र'],Sun:['Sun','Surya','सूर्य'],Moon:['Moon','Chandra','चंद्र'],Mercury:['Mercury','Budh','बुध'],Jupiter:['Jupiter','Guru','गुरु']};
const month=(date,lang)=>new Intl.DateTimeFormat(lang==='hindi'?'hi-IN':'en-US',{month:'long',year:'numeric',timeZone:'UTC'})
 .format(new Date(date+'-01T00:00:00Z'));

// This reply is rendered from two separately validated calculations. It never
// accepts old assistant dates, relabels a career window, or forces varied dates.
export function pairedPropertyTimingReply(row,careerResult,propertyResult,value) {
 const career=projectedTiming({...row,event_timing:careerResult},'career');
 const property=projectedTiming({...row,event_timing:propertyResult},'property');
 const lang=value.language==='english'?'english':value.language==='hindi'?'hindi':'hinglish';
 const render=(timing,label)=>{
  const window=timing?.selected;
  if(!window)return lang==='english'?`No timing range was identified for ${label}.`:
   lang==='hindi'?`${label} के लिए समय की अवधि नहीं मिली है।`:`${label} ke liye samay ki avadhi nahi mili hai.`;
  const from=month(window.from,lang),to=month(window.to,lang);
  return lang==='english'?`The chart points to opportunities for ${label} from ${from} to ${to}.`:
   lang==='hindi'?`कुंडली में ${label} के लिए ${from} से ${to} तक अवसर के संकेत हैं।`:
   `Kundli mein ${label} ke liye ${from} se ${to} tak avsar ke sanket hain.`;
 };
 const same=career?.selected&&property?.selected&&career.selected.from===property.selected.from&&career.selected.to===property.selected.to;
 const explanation=lang==='english'?
  `These are separate calculations: career uses tenth-house links; property uses fourth-house links and the property divisional chart.${same?' Their independently calculated periods overlap here.':''}`:
  lang==='hindi'?`दोनों की गणना अलग है: करियर में दसवें घर के संबंध देखे गए हैं, जबकि घर के लिए चौथे घर और संपत्ति के अलग वर्ग कुंडली के संबंध देखे गए हैं।${same?' इस कुंडली में दोनों के लिए एक ही अवधि निकली है।':''}`:
  `Dono ki ganana alag hai: career mein dasve ghar ke sambandh dekhe gaye hain, jabki ghar ke liye chauthe ghar aur property ke alag chart ke sambandh dekhe gaye hain.${same?' Is kundli mein dono ke liye ek hi avadhi nikli hai.':''}`;
 const caution=property?.selected?.basis.property.rasi_fourth_lord;
 const p=planetNames[caution?.lord]?.[lang==='english'?0:lang==='hindi'?2:1]??caution?.lord;
 const adverse=caution?.adverse_natal_condition?(lang==='english'?` The adverse condition of ${p}, the property fourth lord, still indicates obstacles.`:
  lang==='hindi'?` संपत्ति के चौथे घर के स्वामी ${p} की प्रतिकूल स्थिति से रुकावट के संकेत भी हैं।`:
  `Property ke chauthe ghar ke swami ${p} ki pratikool sthiti se rukawat ke sanket bhi hain.`):'';
 return [render(career,names[lang][0]),render(property,names[lang][1]),explanation+adverse].join('\n\n');
}
