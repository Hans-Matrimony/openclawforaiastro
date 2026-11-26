// These boundaries describe missing input or missing calculated capability.
// They never infer an outcome from the absence of a result.
export function pilotBirthClarification(reply, profile, language, memoryFacts = []) {
  if (profile.status === 'READY' || memoryFacts.length) return null;
  if (!/\b(?:birth|janam|janm)\b|जन्म/iu.test(reply) ||
      !/\b(?:need|share|provide|details|zaroorat|zarurat|bata|date|time|place)\b|तिथि|समय|स्थान/iu.test(reply)) return null;
  const fields = profile.fields ?? {};
  const missing = ['date','time','location_name'].filter(key => !fields[key]);
  const labels = language === 'english'
    ? {date:'birth date',time:'exact birth time',location_name:'birthplace'}
    : language === 'hindi'
      ? {date:'जन्म तिथि',time:'जन्म का सही समय',location_name:'जन्म स्थान'}
      : {date:'janam tithi',time:'janam ka exact samay',location_name:'janam sthan'};
  const names=missing.map(key=>labels[key]);
  const conjunction=language === 'english' ? ' and ' : language === 'hindi' ? ' और ' : ' aur ';
  const details=names.length > 1 ? names.slice(0,-1).join(', ') + conjunction + names.at(-1) : names[0];
  if (!details) return null;
  return language === 'english' ? `Please share your ${details} so I can check your chart.`
    : language === 'hindi' ? `कुंडली देखने के लिए कृपया ${details} बताइए।`
    : `Kundli dekhne ke liye ${details} bata dijiye.`;
}

export function pilotEducationBoundary(results, language) {
  const rows=results.flatMap(raw=>{
    try { const row=JSON.parse(raw);return row?.engine === 'local-sweph-v2' && !row.isError ? [row] : []; }
    catch { return []; }
  });
  if (!rows.length) return null;
  const hasEducation = rows.some(row =>
    row.verdict_signals?.some(signal => signal.area === 'education' && ['POSITIVE','NEGATIVE','MIXED'].includes(signal.trend)) ||
    row.event_windows?.some(window => window.topic === 'education' || window.area === 'education'));
  if (hasEducation) return null;
  return language === 'english'
    ? 'These calculated results do not include a separate education or exam assessment. They do not establish an exam outcome or a best study period.'
    : language === 'hindi'
      ? 'इन गणनाओं में पढ़ाई या परीक्षा का अलग आकलन नहीं मिला। इनसे परीक्षा का नतीजा या पढ़ाई का सबसे अच्छा समय तय नहीं होता।'
      : 'In gananaon mein padhai ya exam ka alag aakalan nahi mila. Inse exam ka result ya padhai ka sabse achha samay tay nahi hota.';
}
