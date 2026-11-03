// Input provenance belongs at the tool boundary, outside the chart calculators.
export function birthKey(birth) {
  const date = String(birth?.date ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(date);
  const parts = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[3], +dmy[2], +dmy[1]] : [];
  const [y, m, d] = parts;
  const day = new Date(Date.UTC(y, m - 1, d));
  const clock = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i.exec(String(birth?.time ?? '').trim());
  if (!clock || day.getUTCFullYear() !== y || day.getUTCMonth() + 1 !== m || day.getUTCDate() !== d ||
      +clock[2] > 59 || (clock[3] ? +clock[1] < 1 || +clock[1] > 12 : +clock[1] > 23)) return null;
  const hour = clock[3] ? +clock[1] % 12 + (clock[3].toLowerCase() === 'pm' ? 12 : 0) : +clock[1];
  const place = String(birth?.location_name ?? birth?.place ?? '').trim().toLowerCase().replace(/\s*,\s*/g, ',');
  if (!place || place === 'unknown') return null;
  return {date: `${y}-${m}-${d}`, time: `${hour}:${+clock[2]}`, place};
}

export function sameBirth(a, b) {
  const x = birthKey(a), y = birthKey(b);
  return !!x && !!y && x.date === y.date && x.time === y.time && x.place === y.place;
}

export function suppliedBirth(birth, text) {
  const key = birthKey(birth);
  if (!key || typeof text !== 'string' || text.length > 8000) return false;
  // Negative/correction examples are not affirmative birth facts. Ambiguity asks
  // for confirmation rather than silently selecting one of several profiles.
  if (/\b(?:not|wrong|incorrect|galat|example|suppose|assume|imagine)\b/i.test(text)) return false;
  const dates = [...text.matchAll(/\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/g)];
  const clocks = [...text.matchAll(/\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?\b/gi)];
  if (dates.length !== 1 || clocks.length !== 1) return false;
  const candidate = birthKey({date: dates[0][0], time: clocks[0][0], location_name: birth.location_name ?? birth.place});
  if (!candidate || candidate.date !== key.date || candidate.time !== key.time) return false;
  // A full line or a labelled field is required: a casual mention of a city
  // elsewhere in the sentence is insufficient, as is a conflicting qualifier.
  const places = text.split(/[\n;]/).map(line => line.trim().toLowerCase()
    .replace(/^(?:place of birth|birth\s*place|location|pob|place|city)\s*[:=]\s*/, '')
    .replace(/\s*,\s*/g, ','));
  return places.includes(key.place);
}

export function matchingEvidence(args, {birth, gender, query = '', history = []}) {
  const texts = [...history.filter(t => t.role === 'user').map(t => t.text), query];
  if (/\b(?:new|another|different|dusri|dusra|alag)\s+(?:partner|girlfriend|boyfriend|gf|bf|wife|husband)\b/i.test(query)) return false;
  // A newer complete form supersedes older partner inputs. Do not select an
  // earlier person's valid dates just because they are still in chat history.
  const forms = texts.filter(text => /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})\b/.test(text) && /\b\d{1,2}:\d{2}\b/.test(text));
  const recent = forms.slice(-(['male', 'female'].includes(gender) && birthKey(birth) ? 1 : 2));
  return ['male', 'female'].every(person => {
    const candidate = {date: args[`${person}_birth_date`], time: args[`${person}_birth_time`], location_name: args[`${person}_location_name`]};
    return (gender === person && sameBirth(candidate, birth)) || recent.some(text => suppliedBirth(candidate, text));
  }) && (() => {
    const male = {date: args.male_birth_date, time: args.male_birth_time, location_name: args.male_location_name};
    const female = {date: args.female_birth_date, time: args.female_birth_time, location_name: args.female_location_name};
    // Identical details are legitimate only with independent evidence for the
    // second person, never by copying the account profile into both roles.
    return !sameBirth(male, female) ||
      (['male', 'female'].includes(gender) && sameBirth(male, birth) && texts.some(text =>
        /\b(?:partner|girlfriend|boyfriend|gf|bf|wife|husband|her|his)\b/i.test(text) && suppliedBirth(male, text))) ||
      texts.filter(text => suppliedBirth(male, text)).length >= 2 &&
        texts.some(text => /\b(?:partner|girlfriend|boyfriend|gf|bf|wife|husband|her|his)\b/i.test(text));
  })();
}

export function invalidGunaScore(reply, results) {
  const claims = [
    ...reply.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\/|out\s+of|of|mein\s+se)\s*36\b/gi),
    ...reply.matchAll(/\b(?:total\s+gu(?:n|na)|guna(?:\s+milan)?(?:\s+score)?|gun\s+score)\s*(?:[:=]|is|hai|hain)?\s*(\d+(?:\.\d+)?)\b/gi),
    ...reply.matchAll(/\b(\d+(?:\.\d+)?)\s+gu(?:n|na)\s+(?:hai|hain|mile|milte)\b/gi),
  ];
  if (!claims.length) return false;
  const scores = results.flatMap(raw => {
    try {
      const g = JSON.parse(raw)?.guna_milan;
      return g?.status === 'ok' && g.score_max === 36 && Number.isFinite(g.score_points) && g.score_points >= 0 && g.score_points <= 36 ? [g.score_points] : [];
    } catch { return []; }
  });
  return scores.length !== 1 || claims.some(match => +match[1] !== scores[0]);
}
