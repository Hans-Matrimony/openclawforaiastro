const missingValue=value=>typeof value!=='string'||!value.trim()||/^(?:unknown|none|null|please update|guest|anonymous)$/iu.test(value.trim());

// Rendering consumes confirmed fields only; it never parses or invents input.
export function profileCollectionFormat(profile,language,{name,gender}={}) {
  const fields=profile.fields??{};
  const missing=[...(missingValue(name)?['name']:[]),...(!['male','female'].includes(gender)?['gender']:[]),
    ...['date','time','location_name'].filter(key=>missingValue(fields[key]))];
  if(!missing.length)return null;
  const copy={
    english:{intro:'Please fill in the missing details below:',name:'Name:',gender:'Gender:',date:'Date of birth: DD Month YYYY',time:'Birth time: HH:MM AM/PM',location_name:'Birthplace: City, State, Country'},
    hindi:{intro:'कृपया नीचे केवल बाकी जानकारी भरकर भेजिए:',name:'नाम:',gender:'लिंग:',date:'जन्म तिथि: DD Month YYYY',time:'जन्म का सही समय: HH:MM AM/PM',location_name:'जन्म स्थान: शहर, राज्य, देश'},
    hinglish:{intro:'Kundli dekhne ke liye neeche sirf baaki details bharkar bhej dijiye:',name:'Naam:',gender:'Gender:',date:'janam tithi: DD Month YYYY',time:'janam ka exact samay: HH:MM AM/PM',location_name:'janam sthan: City, State, Country'},
    marathi:{intro:'कृपया खाली फक्त उरलेले तपशील भरून पाठवा:',name:'नाव:',gender:'लिंग:',date:'जन्मतारीख: DD Month YYYY',time:'जन्मवेळ: HH:MM AM/PM',location_name:'जन्मस्थान: शहर, राज्य, देश'},
    bengali:{intro:'নিচে শুধু বাকি তথ্যগুলো পূরণ করে পাঠান:',name:'নাম:',gender:'লিঙ্গ:',date:'জন্মতারিখ: DD Month YYYY',time:'জন্মের সময়: HH:MM AM/PM',location_name:'জন্মস্থান: শহর, রাজ্য, দেশ'}
  };
  const aliases={en:'english',hi:'hindi',mr:'marathi',bn:'bengali'};
  const text=copy[aliases[language]??language]??copy.english;
  return text.intro+'\n\n'+missing.map(key=>text[key]).join('\n');
}
