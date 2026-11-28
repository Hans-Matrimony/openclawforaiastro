// Intent and requested fields come from the schema-validated LLM decision.
// Values come only from the selected app profile, never old chat or Mem0 facts.
export function selectedProfileRecall(value,intent) {
  if(intent?.scope!=='profile_recall'||intent.subject!=='self'||!intent.profile_fields?.length)return null;
  const values={name:value.user_name,birth_date:value.birth?.date,birth_time:value.birth?.time,
    birth_place:value.birth?.location_name,gender:value.user_gender};
  const language=value.language==='hindi'?'hindi':value.language==='hinglish'?'hinglish':'english';
  const labels=language==='hindi'?{name:'नाम',birth_date:'जन्म तिथि',birth_time:'जन्म समय',birth_place:'जन्मस्थान',gender:'लिंग'}:
    language==='hinglish'?{name:'Naam',birth_date:'Janam tareekh',birth_time:'Janam samay',birth_place:'Janam sthan',gender:'Gender'}:
    {name:'Name',birth_date:'Birth date',birth_time:'Birth time',birth_place:'Birthplace',gender:'Gender'};
  const missing=language==='hindi'?'अभी उपलब्ध नहीं है':language==='hinglish'?'abhi available nahi hai':'not available right now';
  const prefix=language==='hindi'?'आपकी प्रोफ़ाइल में ये जानकारी है:':language==='hinglish'?'Aapki profile mein yeh details hain:':'Here are the details in your profile:';
  const clean=v=>typeof v==='string'&&v.trim()&&!/^(?:unknown|none|null)$/iu.test(v.trim())?v.replace(/\s+/gu,' ').trim():missing;
  return prefix+'\n'+intent.profile_fields.map(field=>labels[field]+': '+clean(values[field])).join('\n');
}
