// These house groups already belong to the app's education/travel context.
// Summarize returned natal strength labels only; never borrow another area's
// verdict or turn this summary into a scored probability or an event date.
const housesByTopic={education:[4,5,9],abroad:[9,12]};

export function focusedTopicSignal(chart,topic) {
  const houses=housesByTopic[topic];
  if(!houses)return null;
  const positive=[],negative=[],neutral=[];
  for(const house of houses) {
    const entry=chart?.ashtakavarga_house_bindus?.['house_'+house];
    if(typeof entry?.verdict!=='string')return null;
    const strength=/weak/iu.test(entry.verdict)?'weak':/strong/iu.test(entry.verdict)?'strong':
      /average|mixed/iu.test(entry.verdict)?'mixed':null;
    if(!strength)return null;
    const factor={kind:'house_strength',house,sign:entry.sign,strength};
    (strength==='strong'?positive:strength==='weak'?negative:neutral).push(factor);
  }
  return {area:topic,houses,trend:positive.length&&!negative.length?'POSITIVE':
    negative.length&&!positive.length?'NEGATIVE':'MIXED',positive,negative,neutral,
    method:'returned-natal-house-strength-summary-v1'};
}
