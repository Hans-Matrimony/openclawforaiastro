// Match-only input handling: no guessed partner data, substring geocoding,
// calendar rollover or fixed-offset approximation for cities observing DST.
const REGIONS = [
  ["Delhi|New Delhi", ["Delhi", "New Delhi", "NCT of Delhi"]],
  ["Mumbai|Pune|Nagpur|Thane|Navi Mumbai|Kalyan|Nashik|Aurangabad|Solapur", ["Maharashtra"]],
  ["Bangalore|Bengaluru|Mysore|Mysuru|Hubli|Mangalore", ["Karnataka"]],
  ["Chennai|Coimbatore|Madurai|Salem", ["Tamil Nadu", "Tamilnadu"]],
  ["Hyderabad|Warangal", ["Telangana"]],
  ["Ahmedabad|Surat|Vadodara|Rajkot", ["Gujarat"]],
  ["Jaipur|Jodhpur|Udaipur|Ajmer|Bikaner|Kota", ["Rajasthan"]],
  ["Kolkata|Howrah|Durgapur|Asansol|Siliguri", ["West Bengal"]],
  ["Lucknow|Kanpur|Varanasi|Agra|Meerut|Ghaziabad|Noida|Allahabad|Prayagraj|Mathura|Vrindavan", ["Uttar Pradesh", "UP"]],
  ["Faridabad|Gurugram|Gurgaon|Karnal|Panipat|Rohtak|Hisar", ["Haryana"]],
  ["Indore|Bhopal|Gwalior|Jabalpur", ["Madhya Pradesh"]],
  ["Patna|Gaya", ["Bihar"]],
  ["Amritsar|Ludhiana", ["Punjab"]],
  ["Chandigarh", ["Chandigarh"]],
  ["Kochi|Thiruvananthapuram|Trivandrum", ["Kerala"]],
  ["Jamshedpur|Ranchi", ["Jharkhand"]],
  ["Bhubaneswar", ["Odisha", "Orissa"]],
  ["Guwahati", ["Assam"]],
  ["Dehradun|Haridwar|Rishikesh", ["Uttarakhand"]],
  ["Vijayawada|Visakhapatnam|Tirupati", ["Andhra Pradesh"]],
  ["Srinagar|Jammu", ["Jammu and Kashmir", "Jammu & Kashmir"]],
  ["Shimla", ["Himachal Pradesh"]],
  ["Raipur|Bilaspur|Bhilai", ["Chhattisgarh"]],
];
const INTERNATIONAL = {
  London: ["Europe/London", ["UK", "United Kingdom", "England"]],
  "New York": ["America/New_York", ["USA", "US", "United States", "New York", "NY"]],
  Dubai: ["Asia/Dubai", ["UAE", "United Arab Emirates", "Dubai"]],
  Singapore: ["Asia/Singapore", ["Singapore"]],
  Sydney: ["Australia/Sydney", ["Australia", "New South Wales", "NSW"]],
  Toronto: ["America/Toronto", ["Canada", "Ontario", "ON"]],
  Kathmandu: ["Asia/Kathmandu", ["Nepal", "Bagmati"]],
  Colombo: ["Asia/Colombo", ["Sri Lanka", "Western Province"]],
};

function localClock(date, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

function zonedBirth(wallTime, timezone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  // Sample either side of a transition, then round-trip each possible offset.
  // Two matching instants are an ambiguous fall-back time; none is a DST gap.
  const offsets = new Set([-36, 0, 36].map(hours => {
    const sample = wallTime + hours * 3600000;
    return localClock(new Date(sample), formatter) - sample;
  }));
  const candidates = [...offsets].map(offset => wallTime - offset)
    .filter(instant => localClock(new Date(instant), formatter) === wallTime);
  if (candidates.length !== 1) {
    throw new Error("Birth time is ambiguous or nonexistent in the birthplace timezone; confirm the exact local time and UTC offset");
  }
  const offsetSeconds = (wallTime - candidates[0]) / 1000;
  const absolute = Math.abs(offsetSeconds);
  const pad = value => String(value).padStart(2, "0");
  const tzOffset = `${offsetSeconds < 0 ? "-" : "+"}${pad(Math.floor(absolute / 3600))}:${pad(Math.floor(absolute / 60) % 60)}${absolute % 60 ? ":" + pad(absolute % 60) : ""}`;
  return { utc: new Date(candidates[0]), tzOffset };
}

export function matchingBirth(date, time, place, geocode) {
  if (![date, time, place].every(value => typeof value === "string" && value.trim() && value.length <= 200)) {
    throw new Error("Both partners need their own exact birth date, time and birthplace");
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const dmy = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(date.trim());
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[4], +dmy[3], +dmy[1]] : [];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day || year < 1900 || check > new Date()) {
    throw new Error("Invalid birth date; use a real past date in DD/MM/YYYY or YYYY-MM-DD format (1900 onward)");
  }
  const clock = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(time.trim());
  let hour = clock ? +clock[1] : NaN;
  if (!clock || +clock[2] > 59 || (clock[3] ? hour < 1 || hour > 12 : hour > 23)) {
    throw new Error("Invalid birth time; an exact HH:MM local time is required");
  }
  if (clock[3]) hour = hour % 12 + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  const labels = place.split(",").map(value => value.trim().toLowerCase());
  const loc = geocode(labels[0]);
  if (!loc || loc.name.toLowerCase() !== labels[0]) throw new Error("Birthplace must be a supported exact city, not a guessed nearby location");
  const international = INTERNATIONAL[loc.name];
  const region = REGIONS.find(([cities]) => cities.toLowerCase().split("|").includes(labels[0]));
  const qualifiers = international?.[1] || (region ? ["India", "IN", ...region[1]] : []);
  if (!qualifiers.length || labels.length > 3 || labels.slice(1).some(label => !qualifiers.some(value => value.toLowerCase() === label))) {
    throw new Error("Birthplace region or country is unsupported or conflicts with the selected city; confirm it");
  }
  const timezone = international?.[0] || "Asia/Kolkata";
  const { utc, tzOffset } = zonedBirth(Date.UTC(year, month - 1, day, hour, +clock[2]), timezone);
  return { utc, loc: { ...loc, timezone, tzOffset } };
}
