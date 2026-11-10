// WhatsApp presentation only. Prior answers establish what we said, never
// whether a prediction is true. Calculation and evidence checks stay upstream.
const marriage = /\b(?:shaa?di|marriage|wedding|vivah)\b|शादी|विवाह/iu;
const career = /\b(?:career|job|naukri|promotion)\b|नौकरी|करियर/iu;
const changed = /\b(?:bad[al]+|chang\w*|contradic\w*|pehle|earlier|previous)\b|पहले|बदल/iu;
const acknowledged = /\b(?:inconsistent|conflicting|contradictory|my mistake|meri galti|alag.alag saal|pehle.*galat)\b|मेरी गलती|अलग-अलग साल/iu;
const profileEdit = /\b(?:dob|tob|birth|janam|profile)\b.{0,45}\b(?:update|correct|change|galat|wrong)\b|\b(?:update|correct|change)\b.{0,40}\b(?:dob|tob|birth|profile)\b/iu;
const detail = /\b(?:detail|detailed|thorough|full report|step.by.step)\b|विस्तार/iu;
const otherPerson = /\b(?:my|meri|mere)\s+(?:sister|brother|friend|behen|bhai|dost|daughter|son|beti|beta)\b|मेरी बहन|मेरे भाई/iu;

function prose(text) {
  if (/```|`|https?:\/\/|(?:^|\n)\s*\|/.test(text)) return false;
  try { JSON.parse(text); return false; } catch { return true; }
}

function scope(value) {
  if (marriage.test(value.query)) return marriage;
  if (career.test(value.query)) return career;
  if (!changed.test(value.query)) return null;
  const last = [...(value.history ?? [])].reverse().find(t => t.role === 'user' && (marriage.test(t.text) || career.test(t.text)));
  return last && (marriage.test(last.text) ? marriage : career);
}

function years(text) {
  // A quoted birth date must not look like a new prediction window.
  const prediction = text.replace(/\([^)]*\)/gu, '').replace(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/gu, '');
  return [...new Set(prediction.match(/\b20\d{2}\b/gu) ?? [])].sort().join(',');
}

export function needsWhatsAppCorrection(reply, value) {
  if (value.reply_surface !== 'whatsapp' || !prose(reply) || value.profile_update_status === 'saved') return false;
  if (otherPerson.test(value.query)) return false;
  const topic = scope(value);
  if (!topic) return false;
  const history = value.history ?? [];
  let lastEdit = -1;
  history.forEach((t, i) => { if (t.role === 'user' && profileEdit.test(t.text)) lastEdit = i; });
  let otherSubject = false;
  const readings = history.slice(lastEdit + 1).filter(t => {
    if (t.role === 'user' && topic.test(t.text)) otherSubject = otherPerson.test(t.text);
    return t.role === 'assistant' && !otherSubject && topic.test(t.text) && years(t.text);
  });
  if (!readings.length || acknowledged.test(reply) || acknowledged.test(readings.at(-1).text)) return false;
  const windows = new Set(readings.map(t => years(t.text)));
  // Different questions can legitimately discuss different periods. Require
  // the user to challenge timing or ask the same event's timing again.
  if (!changed.test(value.query) && !/\b(?:kab|when|timing|window|samay)\b|कब|समय/iu.test(value.query)) return false;
  if (topic.test(reply) && years(reply)) windows.add(years(reply));
  return windows.size > 1;
}

export function whatsappStyleInstruction(value) {
  if (value.reply_surface !== 'whatsapp') return '';
  return '\n# WhatsApp final wording\nUse the same PWA calculation and conversation rules. ' +
    (detail.test(value.query) ? 'The user requested detail; preserve the requested explanation. ' :
      'Use 20-30 words of explanation and a short verdict, at most 50 words before the companion. Put the exact timing window once; retain both month-year boundaries, opposing factors and uncertainty. Remove repeated explanations rather than cutting facts. ') +
    'Write complete conversational sentences, without orphaned point scores. Use the verified saved name naturally for a meaningful personal answer when it was not just used; never use it on every brief follow-up or after a request not to. ' +
    'History records your earlier answers. Never deny saying a date that appears there or invent a different profile as an excuse. When earlier same-topic answers conflict, acknowledge the inconsistency briefly and give only the currently checked result; do not copy unsupported old dates. The companion stage owns the one relevant follow-up.\n';
}

export function whatsappWordingIssue(reply, value) {
  if (value.reply_surface !== 'whatsapp' || detail.test(value.query) || !prose(reply)) return null;
  const parts = reply.trim().split(/\n\s*\n/u);
  if (/\bpoints?\s+(?:sirf\s+)?kamzor\b|\bki points?\b/iu.test(reply)) {
    return 'Replace the awkward orphaned point-score phrase with a complete natural sentence about the checked strength or limitation. Keep its adverse meaning and the supported dates.';
  }
  if (reply.trim().split(/\s+/u).length > 50 || parts.some(p => p.trim().split(/\s+/u).length > 35)) {
    return 'Reduce repeated wording: at most 35 words per paragraph and 50 words for the reading. Keep exact supported month-year boundaries, adverse factors and qualifications. Do not truncate a sentence or omit a needed caveat.';
  }
  return null;
}

export function finishWhatsAppReply(reply, value, {facts = []} = {}) {
  if (value.reply_surface !== 'whatsapp' || !prose(reply)) return reply;
  const language = /\b(?:reply|answer|respond) in (english|hindi)\b/iu.exec(value.query)?.[1]?.toLowerCase() ?? value.language;
  const note = /^(en|english|hi|hindi|hinglish)$/iu.test(language) && needsWhatsAppCorrection(reply, value)
    ? /^(en|english)$/iu.test(language) ? 'My earlier replies gave conflicting years; that was my mistake. '
      : /^(hi|hindi)$/iu.test(language) ? 'पहले मेरे जवाबों में अलग-अलग साल आए थे; यह मेरी गलती थी। '
        : 'Pehle mere jawabon mein alag-alag saal aaye the; yeh meri galti thi. '
    : '';
  let text = note + reply;
  const name = value.user_name;
  const recent = (value.history ?? []).filter(t => t.role === 'assistant').slice(-2);
  const preferences = [...facts.filter(t => typeof t === 'string'), ...(value.history ?? []).filter(t => t.role === 'user').map(t => t.text), value.query];
  let noName = false;
  for (const text of preferences) {
    if (/\b(?:(?:do not|don't|dont|never) (?:use|say|call|address).{0,35}(?:name|me)|(?:does not|doesn't|prefers not to).{0,40}(?:use|address|name)|(?:naam|name).{0,25}(?:mat|nahi|nahin|don't|do not))\b|नाम.{0,20}(?:मत|नहीं)/iu.test(text)) noName = true;
    else if (/\b(?:you (?:can|may)|please) use my name\b|\bnaam (?:le sak\w*|use kar sak\w*)\b/iu.test(text)) noName = false;
  }
  const personal = note || scope(value) || /\b(?:my|meri|mera|mujhe|I feel|khush|upset|lonely)\b|मेरा|मेरी|मुझे/iu.test(value.query);
  if (personal && !noName && typeof name === 'string' && name.length <= 80 &&
      /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name) &&
      !/^(?:unknown|user|guest|please update|anonymous)$/iu.test(name) &&
      !text.toLocaleLowerCase().includes(name.toLocaleLowerCase()) &&
      !recent.some(t => t.text.toLocaleLowerCase().includes(name.toLocaleLowerCase()))) {
    text = name + ', ' + text;
  }
  return text;
}
