import { periodFallback } from './period-fallback.mjs';
import { isSpecificReturnQuestion } from './pilot-bubbles.mjs';

const hindiPlanets = {
  Sun: 'सूर्य', Moon: 'चंद्र', Mars: 'मंगल', Mercury: 'बुध',
  Jupiter: 'गुरु', Venus: 'शुक्र', Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु',
};

// Reuse the existing subject/date validation. Render the validated schedule
// separately so a generative rewrite cannot turn it into an event deadline.
export function pilotScheduleBubble(results, language, query, asOf) {
  if (isSpecificReturnQuestion(query)) return '';
  const rows = results.flatMap(raw => {
    try {
      const row = JSON.parse(raw);
      return row?.engine === 'local-sweph-v2' && !row.isError ? [row] : [];
    } catch { return []; }
  });
  if (rows.some(row => row.event_windows?.length)) return '';
  const schedule = periodFallback(rows, 'english', asOf);
  const upcoming = /^The calculated (\w+) sub-period runs (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\.$/u.exec(schedule);
  const current = /^The calculated (\w+) sub-period ends on (\d{4}-\d{2}-\d{2})\./u.exec(schedule);
  if (!upcoming && !current) return '';
  const date = value => new Intl.DateTimeFormat(language === 'hindi' ? 'hi-IN' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
  const lord = (upcoming ?? current)[1];
  if (language === 'hindi') {
    const line = upcoming
      ? `आपकी ${hindiPlanets[lord]} अंतर्दशा ${date(upcoming[2])} से ${date(upcoming[3])} तक चलेगी।`
      : `आपकी ${hindiPlanets[lord]} अंतर्दशा ${date(current[2])} तक चल रही है।`;
    return line + ' यह ग्रह-दशा का समय है, घटना की तय तारीख नहीं।';
  }
  if (language === 'english') {
    return (upcoming
      ? `Your ${lord} sub-period runs from ${date(upcoming[2])} to ${date(upcoming[3])}.`
      : `Your ${lord} sub-period continues until ${date(current[2])}.`) +
      ' This is the planetary schedule, not an event deadline.';
  }
  return (upcoming
    ? `Aapki ${lord} antardasha ${date(upcoming[2])} se ${date(upcoming[3])} tak chalegi.`
    : `Aapki ${lord} antardasha ${date(current[2])} tak chal rahi hai.`) +
    ' Yeh dasha ka samay hai, ghatna ki deadline nahi.';
}
