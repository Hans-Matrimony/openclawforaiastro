const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function indiaToday(asOf = new Date()) {
  return asOf.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function futureDateInstruction(asOf) {
  return `Today in India is ${indiaToday(asOf)}. For future-event questions, never present an expired date or ended window as upcoming. Select only a supported ongoing or future window from the actual tool evidence. For an ongoing period, explicitly say it is already running; future opportunities start from today, without changing its calculated boundaries. Never shift a past date to a new year or invent a replacement date. Birth dates and explicitly historical dates remain unchanged. Earlier assistant predictions are not current evidence.`;
}

// Compare the end of each dated forecast clause, not birth dates or the start
// of an ongoing range. Month/year precision lasts through that month/year.
export function pastPrediction(reply, asOf = new Date()) {
  const today = indiaToday(asOf);
  return String(reply).split(/[.!?\n]+/u).some(sentence => {
    if (!/\b(?:will|upcoming|window|peak|yog|hogi|hoga|honge|aayegi|aayega|milegi|milega|sambhavit|sambhavna|sambhavana|likely|opportunity|opportunities|favourable|favorable)\b/iu.test(sentence)) return false;
    // Historical quotations are allowed only when explicitly rejected.
    if (/\b(?:previous|earlier|pehle|purani|pichhl\w*)\b/iu.test(sentence) && /\b(?:incorrect|wrong|galat|expired|beet|reject\w*)\b/iu.test(sentence)) return false;
    const ends = [];
    const remaining = sentence.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/gu, (_, y, m, d) => {
      const date = `${y}-${m}-${d}`;
      if (!Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) ends.push(date);
      return '';
    });
    for (const match of remaining.matchAll(/\b(20\d{2})\b/gu)) {
      const before = remaining.slice(0, match.index);
      const month = before.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+(\d{1,2})(?:st|nd|rd|th)?,?)?\s*$/iu);
      const index = month ? months.findIndex(name => name.startsWith(month[1].toLowerCase())) : -1;
      const precedingDay = month && before.slice(0, month.index).match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*$/iu);
      const day = month?.[2] || precedingDay?.[1];
      const end = index < 0 ? `${match[1]}-12-31` : day ? `${match[1]}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}` : new Date(Date.UTC(Number(match[1]), index + 1, 0)).toISOString().slice(0, 10);
      ends.push(end);
    }
    return ends.length > 0 && ends.every(end => end < today);
  });
}
