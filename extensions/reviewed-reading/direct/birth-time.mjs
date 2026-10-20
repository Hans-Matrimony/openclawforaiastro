const ZONES = {
  London: "Europe/London",
  "New York": "America/New_York",
  Toronto: "America/Toronto",
  Sydney: "Australia/Sydney",
  Dubai: "Asia/Dubai",
  Singapore: "Asia/Singapore",
  Kathmandu: "Asia/Kathmandu",
  Colombo: "Asia/Colombo",
};

export class BirthTimeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// The vendored city catalogue is Indian apart from the explicitly mapped cities.
// Resolve offsets for the birth date, including historical daylight saving.
export function birthUtc(date, time, location) {
  const dm = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})(?:\s+([+-]\d{2}:\d{2}))?$/.exec(time);
  if (!dm || !tm) {
    throw new BirthTimeError("birth_time_invalid");
  }
  const [, day, month, year] = dm.map(Number);
  const hour = Number(tm[1]),
    minute = Number(tm[2]);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new BirthTimeError("birth_time_invalid");
  }
  const timeZone = ZONES[location.name] || (location.tzOffset === "+05:30" ? "Asia/Kolkata" : null);
  if (!timeZone) {
    throw new BirthTimeError("birth_timezone_unsupported");
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const localStamp = (instant) => {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  };
  const offsets = new Set(
    [-2, -1, 0, 1, 2].map((days) => {
      const sample = wall + days * 86400000;
      return localStamp(sample) - sample;
    }),
  );
  let candidates = [...offsets]
    .map((offset) => ({ instant: wall - offset, offset }))
    .filter(({ instant }) => localStamp(instant) === wall);
  if (!candidates.length) {
    throw new BirthTimeError("birth_time_nonexistent");
  }
  if (tm[3]) {
    const sign = tm[3][0] === "-" ? -1 : 1;
    const [hours, minutes] = tm[3].slice(1).split(":").map(Number);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
      throw new BirthTimeError("birth_time_invalid");
    }
    const supplied = sign * (hours * 60 + minutes) * 60000;
    candidates = candidates.filter(({ offset }) => offset === supplied);
    if (!candidates.length) {
      throw new BirthTimeError("birth_offset_mismatch");
    }
  }
  if (candidates.length !== 1) {
    throw new BirthTimeError("birth_time_ambiguous");
  }
  const offsetMinutes = candidates[0].offset / 60000;
  const seconds = Math.abs(Math.round(offsetMinutes * 60));
  const offsetText = `${offsetMinutes < 0 ? "-" : "+"}${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}${seconds % 60 ? ":" + String(seconds % 60).padStart(2, "0") : ""}`;
  return { utc: new Date(candidates[0].instant), timeZone, offsetMinutes, offsetText };
}
