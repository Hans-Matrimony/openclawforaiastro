export function studyWorkComparison(query) {
  return /\b(?:abroad|overseas|videsh)\b|विदेश/iu.test(query)&&
    /\b(?:masters?|study|studies|education|padhai)\b|पढ़ाई/iu.test(query)&&
    /\b(?:career|job|naukri)\b|नौकरी/iu.test(query)&&
    /\b(?:versus|vs|or|ya|aur|compare|comparison|which|kis\s+taraf|zyada|better)\b|या|तुलना/iu.test(query);
}

export function studyWorkComparisonIssue(reply,plan) {
  if(!plan.comparison_outlooks)return null;
  if(!/\b(?:abroad|overseas|videsh|masters?)\b|विदेश|मास्टर्स/iu.test(reply)||
    !/\b(?:career|job|naukri)\b|करियर|नौकरी/iu.test(reply))
    return 'Answer both sides of the requested foreign-study versus current-job comparison. Use each supplied outlook; do not replace the comparison with a single travel prediction or invent a ranking.';
  return null;
}

export function studyWorkComparisonFallback(plan,value) {
  if(!plan.comparison_outlooks)return null;
  // These natal assessments have no common scoring or calibrated ranking.
  // Preserve both views without inventing a winner from unrelated indicators.
  const option=(key,label)=>{
    const item=plan.comparison_outlooks.find(row=>row.topic===key);
    const support=item?.favorable?.length>0,pressure=item?.adverse?.length>0;
    if(value.language==='english')return `${label}: ${support?'supporting indicators are present':'no clear support is established'}${pressure?', alongside opposing indicators':''}.`;
    if(value.language==='hindi')return `${label}: ${support?'सहयोग के संकेत हैं':'स्पष्ट सहयोग तय नहीं होता'}${pressure?', साथ में रुकावट के संकेत भी हैं':''}।`;
    return `${label}: ${support?'sahyog ke sanket hain':'saaf sahyog tay nahi hota'}${pressure?', saath mein rukawat ke sanket bhi hain':''}.`;
  };
  if(value.language==='english')return `${option('education','Studying abroad')} ${option('career','Continuing your job')}\n\nThese separate indicators do not establish that one option is better. Compare the actual course, its total cost and your current role before choosing.`;
  if(value.language==='hindi')return `${option('education','विदेश में मास्टर्स')} ${option('career','नौकरी जारी रखना')}\n\nइन अलग संकेतों से किसी एक विकल्प को बेहतर तय नहीं किया जा सकता। फैसले में कोर्स, उसका कुल खर्च और मौजूदा नौकरी का अवसर साथ देखिए।`;
  return `${option('education','Abroad masters')} ${option('career','Job continue karna')}\n\nIn alag sanketon se kisi ek option ko behtar tay nahi kiya ja sakta. Faisle mein course, uska poora kharcha aur current role ke mauke saath dekhiye.`;
}
