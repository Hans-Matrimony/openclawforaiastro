const missingValue=value=>typeof value!=='string'||!value.trim()||/^(?:unknown|none|null|please update|guest|anonymous)$/iu.test(value.trim());

// Rendering consumes confirmed fields only; it never parses or invents input.
export function profileCollectionFormat(profile,language,{name,gender}={}) {
  const fields=profile.fields??{};
  const missing=[...(missingValue(name)?['name']:[]),
    ...['date','time','location_name'].filter(key=>missingValue(fields[key])),...(!['male','female'].includes(gender)?['gender']:[])];
  if(!missing.length)return null;
  const copy={
    english:{intro:'Could you please share your details:',name:'Name:',date:'Date of Birth:',time:'Time:',location_name:'Place of Birth:',gender:'Gender:',religion:'Religion (Optional):'},
    hindi:{intro:'कृपया अपनी जानकारी यहाँ साझा करें:',name:'नाम:',date:'जन्म तिथि:',time:'समय:',location_name:'जन्म स्थान:',gender:'लिंग:',religion:'धर्म (वैकल्पिक):'},
    hinglish:{intro:'Kripya apni details yahan share karein:',name:'Naam:',date:'Janam Tithi:',time:'Samay:',location_name:'Janam Sthaan:',gender:'Gender:',religion:'Dharam (Religion) (Optional):'},
    marathi:{intro:'कृपया तुमचे तपशील येथे सांगा:',name:'नाव:',date:'जन्मतारीख:',time:'वेळ:',location_name:'जन्मस्थान:',gender:'लिंग:',religion:'धर्म (ऐच्छिक):'},
    bengali:{intro:'আপনার তথ্য এখানে শেয়ার করুন:',name:'নাম:',date:'জন্মতারিখ:',time:'সময়:',location_name:'জন্মস্থান:',gender:'লিঙ্গ:',religion:'ধর্ম (ঐচ্ছিক):'}
  };
  const aliases={en:'english',hi:'hindi',mr:'marathi',bn:'bengali'};
  const text=copy[aliases[language]??language]??copy.english;
  // Keep the original optional line on the initial full form only. Religion
  // never enters missing/required fields and cannot keep collection pending.
  return text.intro+'\n\n'+[...missing.map(key=>text[key]),...(missing.length===5?[text.religion]:[])].join('\n');
}
