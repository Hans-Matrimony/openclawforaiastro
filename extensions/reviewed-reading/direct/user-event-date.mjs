// A user's concrete schedule is conversation context, not chart evidence.
// Questions, hoped-for dates and old assistant predictions never qualify.
export function userEventDate(reply, query = '') {
  const years = reply.match(/\b(?:19|20)\d{2}\b/gu) ?? [];
  if (!years.length || !years.every(year => query.includes(year))) return false;
  const preparation = /\b(?:prepare|preparation|tayari|taiyari)\b/iu.test(query) && /\b(?:my|meri|mera|mere)\b/iu.test(query);
  if ((/[?？]/u.test(query) && !preparation) || /\b(?:will|when|kab|hoga|hogi|hope|wish|maybe|shayad|predict|prediction|you said)\b/iu.test(query)) return false;
  const event = /\b(?:job|interview|wedding|exam|appointment|shaadi|shadi|naukri)\b/iu;
  const kind = query.match(event)?.[0]?.toLowerCase();
  if (!kind || !new RegExp(`\\b${kind}\\b`, 'iu').test(reply)) return false;
  if (!preparation && !/\b(?:scheduled|booked|fixed|confirmed|start|starts|starting|is in|is on|hai|tay)\b/iu.test(query)) return false;
  // Echoing a year does not license a changed month or a positive prediction.
  const months = reply.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/giu) ?? [];
  return months.every(month => query.toLowerCase().includes(month.toLowerCase())) &&
    !/\b(?:will|hoga|hogi|pakka|guarantee|likely|favourable|favorable|dasha|antardasha|Jupiter|Saturn|Rahu|Ketu|kundli|horoscope)\b/iu.test(reply);
}
