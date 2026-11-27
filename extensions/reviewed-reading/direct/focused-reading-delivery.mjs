const names={Sun:['Surya','सूर्य'],Moon:['Chandra','चंद्र'],Mars:['Mangal','मंगल'],Mercury:['Budh','बुध'],
  Jupiter:['Guru','गुरु'],Venus:['Shukra','शुक्र'],Saturn:['Shani','शनि'],Rahu:['Rahu','राहु'],Ketu:['Ketu','केतु']};
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const hindiMonths=['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
const language=value=>value.language==='hindi'?'hindi':value.language==='english'?'english':'hinglish';
const planet=(name,lang)=>lang==='english'?name:names[name]?.[lang==='hindi'?1:0]??name;
const month=(date,lang)=>/^20\d{2}-(?:0[1-9]|1[0-2])$/u.test(date??'')?
  (lang==='hindi'?hindiMonths:months)[Number(date.slice(5))-1]+' '+date.slice(0,4):null;

function inventsDifficultyFromNeutral(reply,plan) {
  if(plan.assessment_method!=='returned-natal-house-strength-summary-v1' ||
    !plan.reasons?.neutral?.length || plan.reasons.opposing?.length)return false;
  // Ignore quoted wording; a correction of the inference is allowed. Check
  // contrasting clauses separately so a correction cannot hide a new claim.
  const clauses=reply.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’/gu,'')
    .split(/[.!?\n।]+|\b(?:but|however|lekin|magar)\b|लेकिन/iu);
  return clauses.some(clause=>{
    if(/\b(?:does not|doesn't|cannot|can't)\s+(?:by itself\s+)?(?:mean|imply|establish)\b|\bmatlab\b[^.!?\n]{0,55}\bnahi\b|\bapne\s+aap(?:\s+mein)?\s+(?:rukawat|badha)(?:\s+ka\s+sanket)?\s+nahi\b|मतलब[^।.!?\n]{0,40}नहीं/iu.test(clause))return false;
    return /\b(?:rukawat\w*|badha\w*|delay\w*|obstacles?|difficult\w*|challeng\w*|complicat\w*)\b|\bnot\s+(?:be\s+)?(?:(?:entirely|fully|completely)\s+)?(?:straightforward|smooth)\b|\b(?:poori|puri)\s+tarah\s+(?:seedh[ai]|aasaan|sahaj)[^.!?\n]{0,20}\bnahi\b|रुकावट|बाधा|कठिन|मुश्किल|जटिल|देरी|पूरी तरह[^।.!?\n]{0,20}(?:सीध|सरल|आसान)[^।.!?\n]{0,15}नहीं/iu.test(clause);
  });
}

// Translate only chart vocabulary, before review.
// Preserve quoted wording and every factual condition or negation.
export function normalizeFocusedReadingLanguage(text,value) {
  if(value.language!=='hinglish')return text;
  return text.split(/("[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|`[^`\n]*`|https?:\/\/\S+)/gu).map((part,index)=>index%2?part:part
    .replace(/\b(combust|retrograde)\s+(Surya|Chandra|Mangal|Budh|Guru|Shukra|Shani)\b/giu,
      (_,condition,name)=>`${condition.toLowerCase()==='combust'?'ast':'vakri'} ${name}`)
    .replace(/\b(Surya|Chandra|Mangal|Budh|Guru|Shukra|Shani)\s+(combust|retrograde)\b/giu,
      (_,name,condition)=>`${name} ${condition.toLowerCase()==='combust'?'ast':'vakri'}`)
    .replace(/\bsanket\s+mixed\s+(?:hain|hai)\b/giu,'sanket mile-jule hain')
    .replace(/\b(\d{1,2})(?:st|nd|rd|th|ve|va)\s+(?:house|ghar)\s+mixed\s+hai\b/giu,'$1ve ghar ke sanket mile-jule hain')).join('');
}

export function removeRepeatedChoiceLimit(answer,reason) {
  const reference=/\b(?:kundli|chart|assessment|evidence)\b|कुंडली|कुण्डली|सामान्य\s+संबंध[ -]संकेत|इससे|इस\s+(?:बात|स्थिति)\s+से/iu;
  const limit=text=>reference.test(text)&&
    /\b(?:nahi|cannot|can't|not)\b|नहीं/iu.test(text)&&
    /\b(?:faisla|decision|return|laut\w*|feelings|timing|choice|wapas)\b|फैसला|निर्णय|लौट|वापस|भावना|सहमति|कदम|चुनाव/iu.test(text);
  if(!limit(answer)||/["“”‘’`]/u.test(reason))return reason;
  return reason.split(/(?<=[.!?।])\s+/u).map(sentence=>{
    if(!limit(sentence))return sentence;
    // Retain a reported circumstance joined to a repeated boundary rather
    // than deleting the whole sentence and losing useful listening context.
    const joined=/^(.*?)(?:,\s*|\s+)(?:और|लेकिन|मगर|and|but)\s+(.+)$/iu.exec(sentence);
    if(joined&&!limit(joined[1])&&limit(joined[2])) {
      const context=joined[1].trim();
      return /[.!?।]$/u.test(context)?context:context+(/[\u0900-\u097f]/u.test(context)?'।':'.');
    }
    return '';
  }).filter(Boolean).join(' ');
}

// Check the degree of certainty independently of the model reviewer. Never
// upgrade a measured natal strength into a measured real-world likelihood.
export function focusedReplyIssue(reply,plan) {
  const propertyCareerClaim=plan.topic==='property'&&reply.replace(/"[^"\n]*"|`[^`\n]*`/gu,'').split(/[.!?\n।]+/u).some(clause=>
    /\b(?:career|job|naukri|promotion)\b|करियर|नौकरी|पदोन्नति/iu.test(clause)&&
    !/\bcareer\b[^.!?\n]{0,80}(?:\blagu\s+nahi\b|\b(?:does not|doesn't) apply\b|\bnot applicable\b)/iu.test(clause));
  if(propertyCareerClaim)
    return 'Answer the current home/property question from its supplied property evidence. Do not substitute a career assessment, its tenth-house reasons or its timing window.';
  // A weak/pressured indicator is not a calculated pattern of alternating
  // income or savings. Check this separately from the model's style review.
  const volatility=/\butar[ -]chadh(?:av|aav)\b|\bfluctuat\w*\b|उतार[ -]चढ़ाव/iu;
  const volatilityClaim=reply.replace(/"[^"\n]*"|“[^”\n]*”|‘[^’\n]*’|`[^`\n]*`/gu,'')
    .split(/[.!?\n।]+|\b(?:but|however|lekin|magar)\b|लेकिन/iu)
    .some(clause=>volatility.test(clause)&&
      !/\b(?:do not|don't|does not|doesn't|cannot|can't)\s+(?:by itself\s+)?(?:mean|imply|establish|show)\b|\bno\s+(?:supplied\s+)?evidence\b|\butar[ -]chadh(?:av|aav)\b[^.!?\n]{0,30}\bnahi\b|उतार[ -]चढ़ाव[^।.!?\n]{0,30}नहीं/iu.test(clause));
  if(plan.topic==='money'&&volatilityClaim&&
    !volatility.test(JSON.stringify(plan.reasons??{})))
    return 'The supplied money factors establish support and obstacles, not fluctuations in income or savings. Remove the inferred utar-chadhav/fluctuation claim and explain the actual limiting factors instead.';
  if(plan.scope==='person_choice') {
    const unrelated=/\b(?:Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu|Shukra|Chandra|Mangal|Shani|Guru|dasha|antardasha|20\d{2})\b|(?<![\p{L}\p{M}])(?:सूर्य|चंद्र(?:मा)?|मंगल|बुध|गुरु|बृहस्पति|शुक्र|शनि|राहु|केतु|दशा|महादशा|अंतर्दशा|अंतरदशा)(?![\p{L}\p{M}])/iu.test(reply);
    const promise=/\b(?:woh|wo|she|he|they)\s+(?:(?:will(?:\s+not)?|won't|definitely|certainly|zaroor|pakka)\s+)?(?:wapas\s+(?:nahi\s+)?aa\w*|return|come back)|\b(?:haan|yes)\b[^.!?\n]{0,30}\b(?:wapas|return)\b/iu;
    const hindiPromise=/लौटेंगे|लौटेंगी|लौटेगा|लौटेगी|(?:वापस|लौट)\s+(?:नहीं\s+)?(?:आएंगे|आएंगी|आएगा|आएगी)|लौटने\s+(?:की\s+संभावना|के\s+योग)|वापस\s+आने\s+(?:की\s+संभावना|के\s+योग)|संपर्क\s+(?:बनने|होने|जुड़ने)[^।.!?\n]{0,25}(?:संकेत|योग|संभावना)/u;
    const claims=reply.split(/[.!?\n।]+|\b(?:but|however|lekin|magar)\b|लेकिन|मगर/iu);
    const asserted=claims.some(clause=>(promise.test(clause)||hindiPromise.test(clause))&&!
      /\b(?:nahi|nahin)\s+(?:bataya\s+ja\s+sakta|bata\s+sakte|keh\s+sakte|kaha\s+ja\s+sakta)\b|\b(?:cannot|can't|does not|doesn't)\s+(?:tell|know|establish|determine|confirm|show)\b|नहीं\s+(?:बताया\s+जा\s+सकता|कहा\s+जा\s+सकता|बता\s+सक(?:ता|ती|ते)|कह\s+सक(?:ता|ती|ते)|बताती|बताता|बताते|जान\s+सकते|जानती|जानता)|(?:फैसला|निर्णय|चुनाव)[^।.!?\n]{0,25}(?:तय|ज्ञात)\s+नहीं/u.test(clause));
    if(unrelated||asserted)
      return 'No supplied chart evidence establishes this person\'s decision. Remove the return promise, date and unrelated planet factors. Answer the unknown choice directly and respect their reported request not to be contacted.';
    return null;
  }
  if(inventsDifficultyFromNeutral(reply,plan))
    return 'The returned mixed house-strength indicator is neutral. Describe it as mixed without inferring difficulty, delays, obstacles or circumstances not being straightforward. Retain the actual favorable factors; do not replace this with a no-obstacles claim or a disclaimer.';
  if(plan.assessment_method==='returned-natal-house-strength-summary-v1'&&!plan.period_context_requested &&
    /\b(?:mahadasha|antardasha|dasha|major period|sub-period|planetary period|current period)\b|दशा/iu.test(reply))
    return 'Explain the selected house-strength indicators for this question. Remove the unrequested active-period inventory; do not replace it with another period claim or a disclaimer.';
  if(plan.assessment_method==='returned-natal-house-strength-summary-v1' &&
    /\bno\s+(?:(?:significant|major|particular|notable)\s+)?(?:obstacles?|problems?|hurdles?|afflictions?)\b|\b(?:obstacle|problem|hurdle)[- ]free\b|\bonly\s+(?:positive|favorable)\s+(?:factors?|indicators?)\b|\bkoi\b[^.!?\n]{0,35}\b(?:rukawat|badha|dosh|problem)\b[^.!?\n]{0,45}\b(?:nahi|nahin)\b|कोई[^।.!?\n]{0,25}(?:रुकावट|बाधा|दोष|समस्या)[^।.!?\n]{0,35}नहीं/iu.test(reply))
    return 'Explain the returned house-strength indicators directly. Their limited summary does not establish no significant obstacles, an obstacle-free chart or only favorable factors. Remove that unsupported absence claim without adding a disclaimer.';
  if(/\b(?:good|strong|high|excellent)\s+(?:chances?|probability|likelihood)|\b(?:chances?|sambhavana)\s+(?:bahut\s+)?(?:achh[ai]i?|zyada|high)|(?:संभावना|संभावनाएं)\s+(?:बहुत\s+)?(?:अच्छी|ज्यादा|ज़्यादा)|\b(?:guaranteed|definitely|certainly|100\s*%)\b/iu.test(reply))
    return 'State the chart-based outcome directly, retaining its obstacles. Do not claim good/strong/high chances, a probability or guaranteed results from natal factors.';
  const answer=reply.split(/\n\s*\n/u)[0];
  if(plan.timing?.status==='supplied_window'&&/\bsahayak (?:samay|ho sakta)|\bsupportive (?:time|period)|\banukool samay/iu.test(answer)&&
    !/\byog|\bprogress|\bpragati|\bimprov\w*|\bsudhar|\bsambhav\w*|\bpossible|\bavsar|\bmilne|\bsettle hone ke yog/iu.test(answer))
    return 'Answer the requested outcome first as a chart interpretation, with the supplied dates. A supportive-time label alone is incomplete. Keep all material reasons.';
  if(plan.topic==='abroad'&&!/\b(?:visa|settle\w*|immigr\w*|permanent)\b/iu.test(plan.subject)&&
    /\b(?:visa|permanent settlement)\b[^.!?\n]{0,70}\b(?:not|nahi|cannot|confirm)\b/iu.test(reply))
    return 'Answer the requested travel outlook and its chart reasons. Remove the unsolicited visa or permanent-settlement disclaimer; those separate outcomes were not asked.';
  if(plan.topic==='education'&&!/\b(?:prepar\w*|taiyar\w*|mehnat|performance)\b/iu.test(plan.subject)&&
    /\b(?:actual performance|taiyari)[^.!?\n]{0,50}\b(?:nirbhar|depend\w*)\b|\b(?:depend\w*)\b[^.!?\n]{0,50}\b(?:prepar\w*|performance)\b/iu.test(reply))
    return 'Keep the academic chart conclusion and actual chart reasons. Remove the unrequested generic exam-preparation/performance footer; do not replace it with a marks or admission promise.';
  return null;
}

function factorText(factor,lang) {
  if(factor?.kind==='house_strength') {
    const labels=lang==='english'?{strong:'strong',weak:'weak',mixed:'mixed'}:
      lang==='hindi'?{strong:'मज़बूत',weak:'कमज़ोर',mixed:'मिली-जुली'}:{strong:'mazboot',weak:'kamzor',mixed:'mili-juli'};
    return lang==='english'?`House ${factor.house} is ${labels[factor.strength]}.`:
      lang==='hindi'?`${factor.house}वें घर की स्थिति ${labels[factor.strength]} है।`:
      `${factor.house}ve ghar ki sthiti ${labels[factor.strength]} hai.`;
  }
  if(typeof factor!=='string')return null;
  const name=factor.match(/\b(?:Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\b/u)?.[0];
  if(!name)return null;
  const p=planet(name,lang);
  if(/retrograde/iu.test(factor))return lang==='english'?`${p} is retrograde, indicating obstacles.`:
    lang==='hindi'?`वक्री ${p} रुकावट के संकेत देते हैं।`:`Vakri ${p} rukawat dikhate hain.`;
  if(/combust/iu.test(factor))return lang==='english'?`${p} is combust, a limiting factor.`:
    lang==='hindi'?`${p} का अस्त होना एक बाधा है।`:`${p} ka ast hona ek badha hai.`;
  if(/Debilitated/iu.test(factor))return lang==='english'?`${p} is debilitated, a challenging factor.`:
    lang==='hindi'?`${p} की नीच स्थिति चुनौती दिखाती है।`:`${p} ki neech sthiti chunauti dikhati hai.`;
  const house=factor.match(/\bhouse (\d{1,2})\b/u)?.[1];
  if(house&&/drishti/iu.test(factor))return lang==='english'?`${p} aspects house ${house}, indicating ${name==='Jupiter'?'support':'pressure'}.`:
    lang==='hindi'?`${p} की ${house}वें घर पर दृष्टि ${name==='Jupiter'?'सहयोग':'दबाव'} दिखाती है।`:
    `${p} ki ${house}ve ghar par drishti ${name==='Jupiter'?'sahara':'dabav'} dikhati hai.`;
  if(house&&/benefic|malefic/iu.test(factor))return lang==='english'?`${p} occupies house ${house}, a ${/malefic/u.test(factor)?'challenging':'favorable'} factor.`:
    lang==='hindi'?`${house}वें घर में ${p} ${/malefic/u.test(factor)?'बाधा':'सहयोग'} दिखाते हैं।`:
    `${house}ve ghar mein ${p} ${/malefic/u.test(factor)?'badha':'sahara'} dikhate hain.`;
  return null;
}

function outcome(plan,lang) {
  const key=plan.guides?.[0]?.key;
  const topic=key==='career_growth'?'promotion':plan.topic;
  const subject={career:['career progress','career mein pragati','करियर में प्रगति'],promotion:['promotion','promotion','पदोन्नति'],
    marriage:['marriage','shaadi','शादी'],relationship:['a relationship','rishta banne','रिश्ता बनने'],
    money:['financial improvement','aarthik sudhar','आर्थिक सुधार'],education:['studies','padhai','पढ़ाई'],
    abroad:['overseas travel','videsh jaane','विदेश जाने'],property:['home ownership','ghar kharidne','घर खरीदने']}[topic];
  if(!subject)return null;
  const s=subject[lang==='english'?0:lang==='hindi'?2:1];
  const unfavorable=plan.outcome==='unfavorable_now',unclear=plan.outcome==='unclear';
  if(lang==='english')return unfavorable?`Your chart currently points to obstacles in ${s}.`:
    unclear?`Your chart gives mixed indications for ${s}.`:`Your chart indicates potential for ${s}.`;
  if(lang==='hindi')return unfavorable?`कुंडली में अभी ${s} के रास्ते में बाधाएं दिखती हैं।`:
    unclear?`कुंडली में ${s} के संकेत मिले-जुले हैं।`:`कुंडली में ${s} के योग दिखते हैं।`;
  return unfavorable?`Kundli mein abhi ${s} ke raaste mein badhayein dikhti hain.`:
    unclear?`Kundli mein ${s} ke sanket mile-jule hain.`:`Kundli mein ${s} ke yog dikhte hain.`;
}

// Code-owned fallback from the SAME typed plan: a rejected writer/reviewer
// must not replace a real supplied window with a false "no timing" claim.
export function focusedReadingFallback(plan,value) {
  if(plan.scope==='person_choice') {
    const lang=language(value);
    const answer=lang==='english'?"A chart cannot tell us their decision or when they will return.":lang==='hindi'?'कुंडली से उनके लौटने का फैसला या समय नहीं बताया जा सकता।':'Kundli se unke lautne ka faisla ya samay nahi bataya ja sakta.';
    const declined=/\bbaat\s+karne\s+se\s+mana\b|asked\s+not\s+to\s+(?:talk|contact)|बात\s*करने\s*से\s*मना/iu.test(value.query??'');
    return !declined?answer:answer+'\n\n'+(lang==='english'?"They have asked not to talk, so respect that boundary and avoid repeated messages.":lang==='hindi'?'उन्होंने अभी बात करने से मना किया है। उनकी बात का सम्मान कीजिए और बार-बार संदेश मत भेजिए।':'Unhone abhi baat karne se mana kiya hai. Unki baat ka samman kijiye aur baar-baar message mat bhejiye.');
  }
  const lang=language(value),answer=outcome(plan,lang);
  if(!answer)return null;
  const parts=[answer],window=plan.timing.status==='supplied_window'?plan.timing.windows?.[0]:null;
  if(window) {
    const from=month(window.from,lang),to=month(window.to,lang);if(!from||!to)return null;
    parts.push(lang==='english'?`The calculation points to opportunities from ${from} to ${to}.`:
      lang==='hindi'?`गणना में ${from} से ${to} तक अवसर के संकेत हैं।`:
      `Ganana mein ${from} se ${to} tak mauke ke sanket hain.`);
  } else if(plan.timing.status==='unavailable') {
    parts.push(plan.topic==='property'?(lang==='english'?'This reading does not establish a month or year for buying your home.':
      lang==='hindi'?'इस रीडिंग से घर खरीदने का महीना या साल नहीं निकलता।':'Is reading se ghar kharidne ka mahina ya saal nahi nikalta.'):
      lang==='english'?'The available calculation does not identify a timing range.':
      lang==='hindi'?'उपलब्ध गणना में समय की अवधि नहीं मिली है।':'Maujooda ganana mein samay ki avadhi nahi mili hai.');
  }
  const reasons=[...plan.reasons.supporting.slice(0,2),...plan.reasons.opposing.slice(0,3),...(plan.reasons.neutral??[]).slice(0,1)]
    .map(factor=>factorText(factor,lang)).filter(Boolean);
  if(window) {
    const supportLabels=[];
    for(const period of plan.reasons.period_roles??[]) {
      if(!period.supports_topic&&!period.pressure&&!period.adverse_natal_condition)continue;
      const p=planet(period.planet,lang),support=period.supports_topic&&!period.pressure&&!period.adverse_natal_condition;
      const role=lang==='english'?(period.role==='major'?'major period':'sub-period'):
        lang==='hindi'?(period.role==='major'?'महादशा':'अंतर्दशा'):(period.role==='major'?'mahadasha':'antardasha');
      if(support) supportLabels.push(lang==='english'?`${p}'s ${role}`:lang==='hindi'?`${p} की ${role}`:`${p} ki ${role}`);
      else reasons.push(lang==='english'?`${p}'s ${role} indicates pressure.`:
        lang==='hindi'?`${p} की ${role} दबाव दिखाती है।`:`${p} ki ${role} dabav dikhati hai.`);
    }
    const transit=plan.reasons.window_basis?.transit;
    if(transit?.activated_houses?.length)supportLabels.push(lang==='english'?"Jupiter's transit":lang==='hindi'?'गुरु का गोचर':'Guru ka gochar');
    if(supportLabels.length) {
      const joined=supportLabels.length===1?supportLabels[0]:supportLabels.slice(0,-1).join(', ')+(lang==='english'?' and ':lang==='hindi'?' और ':' aur ')+supportLabels.at(-1);
      reasons.push(lang==='english'?`${joined} ${supportLabels.length===1?'indicates':'indicate'} support during that time.`:
        lang==='hindi'?`${joined} से उस अवधि में सहयोग मिलता है।`:
        `${joined} se is daur mein sahara milta hai.`);
    }
    if(transit?.saturn_pressure_houses?.length)reasons.push(lang==='english'?"Saturn's pressure continues during that time.":
      lang==='hindi'?'उस अवधि में शनि का दबाव भी जारी रहता है।':'Us daur mein Shani ka dabav bhi jaari rehta hai.');
  }
  if(!reasons.length)return null;
  const reply=parts.join(' ')+'\n\n'+[...new Set(reasons)].join(' ');
  return reply.split(/\s+/u).length<=150?reply:null;
}
