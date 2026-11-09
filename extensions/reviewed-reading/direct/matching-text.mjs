// Normalize explicit user-authored forms only. This does not select a person,
// geocode a city, infer AM/PM, save a profile or supply missing birth details.
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const datePattern =
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*,?\s*\d{4}\b/gi;
const numericDate = /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/g;
const clock = /\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?\b/gi;

export function matchingFormText(text) {
  if (typeof text !== "string" || text.length > 8000) {
    return "";
  }
  const normalized = text
    .replace(datePattern, (date) => {
      const parts = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?\s*,?\s*(\d{4})$/i.exec(date);
      return `${parts[1]}/${months.indexOf(parts[2].slice(0, 3).toLowerCase()) + 1}/${parts[3]}`;
    })
    .replace(/\b(\d{1,2})\.(\d{2})\s*(am|pm)\b/gi, "$1:$2 $3")
    .replace(/\b(?<![:.\d])(\d{1,2})\s*(am|pm)\b/gi, "$1:00 $2");
  const dates = [...normalized.matchAll(numericDate)],
    times = [...normalized.matchAll(clock)];
  if (dates.length !== 1 || times.length !== 1) {
    return normalized;
  }
  // A one-line form may contain a name before its date and a literal city after
  // its time. Keep every original word so negations/examples remain rejected.
  const date = dates[0],
    time = times[0];
  const between = normalized.slice(date.index + date[0].length, time.index);
  const suffix = normalized
    .slice(time.index + time[0].length)
    .trim()
    .replace(/^,\s*/, "");
  if (
    time.index < date.index ||
    !/^[\s,;]*(?:(?:time|tob)\s*[:=]\s*)?$/i.test(between) ||
    !suffix ||
    suffix.includes("\n") ||
    suffix.includes(";") ||
    !/^[\p{L}\p{M}][\p{L}\p{M} .'’,-]{0,160}$/u.test(suffix)
  ) {
    return normalized;
  }
  return normalized.slice(0, date.index) + date[0] + "\n" + time[0] + "\n" + suffix;
}
