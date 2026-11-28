const lossSubject=/\b(?:wife|husband|spouse|mother|father|sister|brother|partner|papa|mummy|maa|pati|patni)\b|पत्नी|पति|माँ|माता|पिता/iu;
const completedLoss=/\b(?:passed\s+away|died)\b|\bdeath\b[^.!?\n]{0,75}\b(?:ho\s+ga[yi]+[ae]?|hui|hua)\b|(?:निधन|मृत्यु|देहांत)[^.!?\n]{0,50}(?:हो\s*ग[यई]|हुई|हुआ)/iu;
const negatedLoss=/\b(?:not|never|hasn.t|didn.t)\s+(?:died|passed\s+away)|\bdeath\b[^.!?\n]{0,30}\b(?:nahi|nahin)\b|(?:निधन|मृत्यु|देहांत)[^.!?\n]{0,20}नहीं/iu;

export function disclosesBereavement(query) {
  return lossSubject.test(query)&&completedLoss.test(query)&&!negatedLoss.test(query)&&
    /\b(?:my|meri|mera|mere)\b|^(?:wife|husband|papa|mummy|maa|pati|patni)\b|मेरी|मेरे|मेरा/iu.test(query)&&
    !/\b(?:if|suppose|imagine|hypothetical|example|dream|movie|story)\b|अगर|उदाहरण|सपने/iu.test(query);
}

export function lifeEventContextInstruction(value) {
  const loss=[...(value.history??[]),{role:'user',text:value.query}].filter(t=>t.role==='user').findLast(t=>disclosesBereavement(t.text??''));
  if(!loss)return '';
  return '\nThe user explicitly disclosed a bereavement. Respect that reported loss; never describe the deceased person as currently ill, recovering or returning to life. A later remarriage or career question is a new, intelligible request. Answer that current topic, without repeating condolences or requiring the user to restate it. Do not turn the disclosed death date into a predicted event, a death deadline or the user\'s birth date.\n';
}

// Applied only by the focused pilot before any model/tool call. A chart result
// cannot authorize a medical recovery date or override a reported death.
export function lifeEventBoundary(value) {
  if(value.reply_surface!=='whatsapp')return null;
  const q=value.query.trim();
  if(/^nfm_reply$/iu.test(q))return {kind:'form_control_reply',reply:value.language==='english'
    ?'You can write your question here.' : value.language==='hindi'?'आप अपना सवाल यहीं लिख सकते हैं।':'Aap apna sawaal yahin likh sakte hain.'};
  if(disclosesBereavement(q)&&! /\b(?:remarr\w*|dus(?:ra|ri)\s+sha+di|second\s+marriage|career|carrer|naukri)\b|दूसरी\s*शादी|पुनर्विवाह|करियर/iu.test(q)) {
    const incorrectRecovery=(value.history??[]).some(t=>t.role==='assistant'&&/\b(?:health|recover\w*|sudhar|sehat)\b/iu.test(t.text??'')&&/\b20\d{2}\b/iu.test(t.text??''));
    return {kind:'bereavement_acknowledgement',reply:value.language==='english'
      ?"I'm sorry for your loss."+(incorrectRecovery?' My earlier recovery prediction was wrong.':'')+' What concerns you most about life ahead?'
      :value.language==='hindi'?'आपके इस नुकसान का मुझे अफसोस है।'+(incorrectRecovery?' मैंने पहले स्वास्थ्य सुधरने का जो समय बताया था, वह गलत था।':'')+' आगे को लेकर इस समय आपकी सबसे बड़ी चिंता क्या है?'
      :'Aapke is nuksaan ka mujhe afsos hai.'+(incorrectRecovery?' Maine pehle health sudharne ka jo samay bataya tha, woh galat tha.':'')+' Aage ko lekar is waqt aapki sabse badi chinta kya hai?'};
  }
  if(/\b(?:health|illness|disease|sehat|tabiyat|bimari|beemari|recover\w*|cure)\b|सेहत|स्वास्थ्य|बीमारी|ठीक/iu.test(q)&&
     /\b(?:recover\w*|cure\w*|th[ie]+k|better|improv\w*|sudhar|sahi)\b|ठीक|सुधार/iu.test(q)&&
     /\b(?:kab|kb|kub|when|timing|how\s+long|how\s+soon)\b|कब/iu.test(q)) {
    return {kind:'medical_recovery_boundary',reply:value.language==='english'
      ?'A birth chart cannot establish a medical recovery date. What has the treating doctor said about recovery?'
      :value.language==='hindi'?'कुंडली से स्वास्थ्य ठीक होने की तारीख नहीं बताई जा सकती। इलाज कर रहे डॉक्टर ने सुधार के बारे में क्या बताया है?'
      :'Kundli se health theek hone ki tareekh nahi batayi ja sakti. Ilaaj kar rahe doctor ne sudhar ke baare mein kya bataya hai?'};
  }
  if(/^(?:(?:meri|mera|my)\s+)?(?:dusra|dusri|doosra|doosri|second)\s+(?:sha+di|marriage)\s+(?:kab|kb|kub|when)(?:\s+tak)?[?!.\s]*$|^when\s+(?:will|can)\s+i\s+(?:remarry|get\s+married\s+again)[?!.\s]*$/iu.test(q)) {
    // The existing marriage calculator does not distinguish a remarriage date.
    return {kind:'remarriage_timing_limit',reply:value.language==='english'
      ?'You’re asking when you might remarry. I don’t have a reliable date for that. Are you considering someone, or starting to think about remarriage?'
      :value.language==='hindi'?'आप दूसरी शादी के समय के बारे में पूछ रहे हैं। इसके लिए मेरे पास अभी कोई भरोसेमंद तारीख नहीं है। क्या किसी से रिश्ते की बात चल रही है, या अभी इस बारे में सोच रहे हैं?'
      :'Aap doosri shaadi ke samay ke baare mein pooch rahe hain. Iske liye mere paas abhi koi bharosemand tareekh nahi hai. Kya kisi se rishte ki baat chal rahi hai, ya abhi is baare mein soch rahe hain?'};
  }
  return null;
}
