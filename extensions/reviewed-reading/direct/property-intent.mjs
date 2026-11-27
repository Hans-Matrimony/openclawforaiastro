// Recognize a purchase/ownership subject without interpreting it as a request
// for astrology. Practical advice and a requested forecast have separate routes.
export function isPropertyQuestion(query,{lenderDecision=false}={}) {
  return (lenderDecision&&/\b(?:ghar|makaan|makan|home|house)\b[^.!?\n]{0,55}\b(?:bank\s+)?(?:loan|mortgage)\b/iu.test(query))||
    /\b(?:property|real estate|home ownership|home purchase)\b/iu.test(query)||
    /\b(?:buy\w*|purchas\w*|own\w*|sell\w*|sold|build\w*|construct\w*)\b[^.!?\n]{0,55}\b(?:home|house|flat|apartment|land)\b/iu.test(query)||
    /\b(?:home|house|flat|apartment|land)\b[^.!?\n]{0,55}\b(?:buy\w*|purchas\w*|own\w*|sell\w*|sold|build\w*|construct\w*)\b/iu.test(query)||
    /\b(?:ghar|makaan|makan|zameen|zamin)\b[^.!?\n]{0,55}\b(?:kha?r[ie]*d\w*|len[aei]|lunga|lungi|banwa\w*|bech\w*|bik\w*)\b/iu.test(query)||
    /\b(?:kha?r[ie]*d\w*)\b[^.!?\n]{0,55}\b(?:ghar|makaan|makan|zameen|zamin)\b/iu.test(query)||
    /(?:घर|मकान|ज़मीन|जमीन)[^।.!?\n]{0,55}(?:खरीद|लूँ|लूं|लेना|बनवा|बेच|बिक)|(?:खरीद)[^।.!?\n]{0,55}(?:घर|मकान|ज़मीन|जमीन)/u.test(query);
}

export function propertyEventKind(query,options) {
 if(!isPropertyQuestion(query,options))return null;
 if(/\b(?:loan|mortgage|bank)\b[^.!?\n]{0,70}\b(?:approv\w*|reject\w*|sanction\w*)\b|लोन[^।.!?\n]{0,50}(?:मंजूर|मंज़ूर|स्वीकृत)/iu.test(query))return 'lender_decision';
 const goals=[
  ['purchase',/\b(?:buy\w*|purchas\w*|own\w*|kha?r[ie]*d\w*|len[aei]|lunga|lungi)\b|खरीद|लूँ|लूं|लेना/u],
  ['sale',/\b(?:sell\w*|sold|bech\w*|bik\w*)\b|बेच|बिक/u],
  ['construction',/\b(?:build\w*|construct\w*|banwa\w*)\b|बनवा|निर्माण/u],
 ].filter(([,pattern])=>pattern.test(query.toLowerCase()));
 return goals.length===1?goals[0][0]:null;
}
