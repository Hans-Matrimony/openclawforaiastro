// Local Vedic astrology engine v2 — Swiss Ephemeris (WASM) + judgment layer
// Calculations AND verdict signals (Ashtakavarga bindus, dignity, sade-sati, antardasha, area rules) — zero network.
// Same tool names as VedAstro MCP so the system prompt needs no changes.
import sweph from "sweph";

const C = sweph.constants;
sweph.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);
const FLAGS = C.SEFLG_MOSEPH | C.SEFLG_SPEED | C.SEFLG_SIDEREAL;

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const SIGN_LORDS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const NAK_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const PLANETS = [
  ["Sun", C.SE_SUN], ["Moon", C.SE_MOON], ["Mercury", C.SE_MERCURY], ["Venus", C.SE_VENUS],
  ["Mars", C.SE_MARS], ["Jupiter", C.SE_JUPITER], ["Saturn", C.SE_SATURN], ["Rahu", C.SE_TRUE_NODE],
];
const BENEFICS = ["Jupiter", "Venus", "Mercury", "Moon"];
const MALEFICS = ["Saturn", "Mars", "Sun", "Rahu", "Ketu"];

const OWN_SIGN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };
const EXALT = { Sun: [0, 10], Moon: [1, 3], Mars: [9, 28], Mercury: [5, 15], Jupiter: [3, 5], Venus: [11, 27], Saturn: [6, 20] }; // [signIndex, degree]
const MOOLTRIKONA = { Sun: [4], Moon: [1], Mars: [0], Mercury: [5], Jupiter: [8], Venus: [6], Saturn: [10] };
const COMBUSTION = { Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15 };

// Ashtakavarga ShortcutTable — PORTED VERBATIM from VedAstro repo (Library/Logic/Calculate/Ashtakavarga.cs)
// Same numbers, same rotation => same Sarvashtakavarga as VedAstro (grand total 337 by construction)
const SHORTCUT_TABLE = {
  Sun:       [3, 3, 3, 3, 2, 3, 4, 5, 3, 5, 7, 2],
  Moon:      [2, 3, 5, 2, 2, 5, 2, 2, 2, 3, 7, 1],
  Mars:      [4, 5, 3, 4, 3, 3, 4, 4, 4, 6, 7, 2],
  Mercury:   [3, 1, 5, 2, 6, 6, 1, 2, 5, 5, 7, 3],
  Jupiter:   [2, 1, 1, 2, 3, 4, 2, 4, 2, 4, 7, 4],
  Venus:     [2, 3, 3, 3, 4, 4, 2, 3, 4, 3, 6, 3],
  Saturn:    [3, 2, 4, 4, 4, 3, 3, 4, 4, 4, 6, 1],
  Ascendant: [5, 3, 5, 5, 2, 6, 1, 2, 2, 6, 7, 1],
};

const norm360 = d => ((d % 360) + 360) % 360;
const signOf = lon => SIGNS[Math.floor(norm360(lon) / 30)];
const lordOf = lon => SIGN_LORDS[Math.floor(norm360(lon) / 30)];
const signIndex = lon => Math.floor(norm360(lon) / 30);
const nakOf = lon => {
  const i = Math.floor(norm360(lon) / (360 / 27));
  return { name: NAKSHATRAS[i], lord: NAK_LORDS[i % 9], pada: Math.floor((norm360(lon) % (360 / 27)) / (360 / 108)) + 1 };
};

function julianDay(utcDate) {
  return sweph.julday(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, utcDate.getUTCDate(),
    utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600, C.SE_GREG_CAL);
}

function planetPositions(jd) {
  const out = [];
  for (const [name, id] of PLANETS) {
    const r = sweph.calc_ut(jd, id, FLAGS);
    if (r.error) throw new Error(name + ": " + r.error);
    const lon = norm360(r.data[0]);
    const p = {
      name, longitude: +lon.toFixed(4), sign: signOf(lon), signLord: lordOf(lon),
      nakshatra: nakOf(lon), speed: +r.data[3].toFixed(5), retrograde: r.data[3] < 0,
    };
    if (name === "Rahu") {
      const klon = norm360(lon + 180);
      out.push(p, { name: "Ketu", longitude: +klon.toFixed(4), sign: signOf(klon), signLord: lordOf(klon), nakshatra: nakOf(klon), speed: p.speed, retrograde: true });
    } else out.push(p);
  }
  return out;
}

function dignityOf(name, lon) {
  const si = signIndex(lon), deg = norm360(lon) % 30;
  if (EXALT[name]) {
    if (si === EXALT[name][0] && Math.abs(deg - EXALT[name][1]) <= 1) return "Exalted (uccha)";
    if (si === (EXALT[name][0] + 6) % 12) return "Debilitated (neecha)";
  }
  if (OWN_SIGN[name]?.includes(si)) {
    return MOOLTRIKONA[name]?.includes(si) ? "Own/Mooltrikona (strong)" : "Own sign (strong)";
  }
  return "";
}

function chartAt(jd, lat, lon) {
  const h = sweph.houses(jd, lat, lon, "P").data; // tropical — subtract ayanamsa for sidereal
  const ayan = sweph.get_ayanamsa_ut(jd);
  const ascSid = norm360(h.points[0] - ayan);
  const mcSid = norm360(h.points[1] - ayan);
  const ascSignIndex = signIndex(ascSid);
  const sunLon = null;
  const planets = planetPositions(jd).map(p => {
    const house = ((signIndex(p.longitude) - ascSignIndex + 12) % 12) + 1;
    const d = p.name in EXALT ? dignityOf(p.name, p.longitude) : "";
    let combust = false;
    if (p.name in COMBUSTION) {
      const sun = planetPositions(jd).find(x => x.name === "Sun"); // recomputed per planet — fine, WASM is fast
      if (sun) combust = Math.abs(norm360(p.longitude - sun.longitude + 180) - 180) < COMBUSTION[p.name];
    }
    return { ...p, house, ...(d ? { dignity: d } : {}), ...(combust ? { combust: true } : {}) };
  });
  return {
    ayanamsa: "LAHIRI", ayanamsa_value: +ayan.toFixed(4),
    ascendant: { longitude: +ascSid.toFixed(4), sign: SIGNS[ascSignIndex], signLord: lordOf(ascSid) },
    midheaven: { longitude: +mcSid.toFixed(4), sign: signOf(mcSid) },
    planets,
    ascSignIndex,
  };
}

function vimshottari(moonLon, utcDate, nowDate) {
  const nak = nakOf(moonLon);
  const lordIndex = DASHA_ORDER.indexOf(nak.lord);
  const nakSpan = 360 / 27;
  const traversed = (norm360(moonLon) % nakSpan) / nakSpan;
  const periods = [];
  let start = new Date(utcDate);
  let idx = lordIndex;
  let len = DASHA_YEARS[DASHA_ORDER[idx % 9]] * (1 - traversed); // balance of first lord
  for (let i = 0; i < 10; i++) {
    const lord = DASHA_ORDER[idx % 9];
    const end = new Date(start.getTime() + len * 365.25 * 86400000);
    periods.push({ lord, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), years: +len.toFixed(2) });
    idx++;
    start = end;
    len = DASHA_YEARS[DASHA_ORDER[idx % 9]]; // full years of the NEXT lord
  }
  const today = (nowDate || utcDate).toISOString().slice(0, 10);
  const current = periods.find(p => p.from <= today && p.to >= today) || periods[0];
  // antardasha (sub-periods) inside current mahadasha
  const mahaStart = new Date(current.from), mahaEnd = new Date(current.to);
  const mahaMs = mahaEnd - mahaStart;
  const antars = [];
  let aStart = new Date(mahaStart);
  const aIdx = DASHA_ORDER.indexOf(current.lord);
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(aIdx + i) % 9];
    const aMs = mahaMs * (DASHA_YEARS[lord] / 120);
    const aEnd = new Date(aStart.getTime() + aMs);
    antars.push({ lord, from: aStart.toISOString().slice(0, 10), to: aEnd.toISOString().slice(0, 10) });
    aStart = aEnd;
  }
  const currentAntar = antars.find(p => p.from <= today && p.to >= today) || antars[0];
  return { birth_nakshatra: nak, periods, current_mahadasha: current, current_antardasha: currentAntar, antardashas: antars };
}

// ---------- Ashtakavarga (VedAstro's shortcut-table method, exact port) ----------
function ashtakavarga(planets, ascLon) {
  const pos = { Ascendant: signIndex(ascLon) };
  for (const p of planets) if (p.name !== "Ketu") pos[p.name] = signIndex(p.longitude);
  const rows = {};
  const sarva = new Array(12).fill(0);
  for (const [key, row] of Object.entries(SHORTCUT_TABLE)) {
    const d = pos[key];
    if (d === undefined) continue;
    const L = row.length + 1; // mirrors VedAstro's C#: shortcutRow.Skip(L - d).Concat(shortcutRow.Take(L - d))
    const shifted = row.slice(L - d).concat(row.slice(0, L - d));
    rows[key] = shifted;
    for (let i = 0; i < 12; i++) sarva[i] += shifted[i];
  }
  return { rows, sarvashtaka: sarva, grand_total: sarva.reduce((a, b) => a + b, 0) };
}

function binduVerdict(n) {
  if (n >= 30) return "very strong (bahut positive)";
  if (n >= 28) return "strong (positive)";
  if (n >= 25) return "average/mixed";
  if (n >= 22) return "weak (negative)";
  return "very weak (bahut negative)";
}

// house-wise bindus for a chart: house h = sign (ascSignIndex + h - 1) % 12
function houseBindus(sarva, ascSignIndex) {
  const out = {};
  for (let h = 1; h <= 12; h++) {
    const si = (ascSignIndex + h - 1) % 12;
    out["house_" + h] = { sign: SIGNS[si], bindus: sarva[si], verdict: binduVerdict(sarva[si]) };
  }
  return out;
}

// ---------- Sade Sati / dhaiya ----------
function sadeSati(natalMoonSign, saturnSignNow) {
  const fromMoon = ((signIndex2(saturnSignNow) - signIndex2(natalMoonSign)) + 12) % 12;
  if (fromMoon === 11) return { active: true, phase: "1st phase (Saturn 12th from Moon) — budget/health pressure period" };
  if (fromMoon === 0) return { active: true, phase: "2nd phase (Saturn over Moon) — peak pressure, care needed" };
  if (fromMoon === 1) return { active: true, phase: "3rd phase (Saturn 2nd from Moon) — family/finance strain, easing after" };
  if (fromMoon === 3) return { active: true, phase: "Ardha-kantaka dhaiya (Saturn 4th from Moon)" };
  if (fromMoon === 7) return { active: true, phase: "Kantaka dhaiya (Saturn 8th from Moon)" };
  return { active: false, note: `Saturn ${SIGNS[signIndex2(saturnSignNow)]} mein hai, Moon se ${fromMoon} houses away — sade-sati active NAHI hai` };
}
const signIndex2 = name => SIGNS.indexOf(name);

// ---------- life-area verdict signals ----------
function aspectsHouse(planetName, house, planets) {
  const p = planets.find(x => x.name === planetName);
  if (!p) return false;
  const fromP = ((house - p.house) + 12) % 12 + 1; // house distance counted inclusively
  if (planetName === "Jupiter") return [5, 7, 9].includes(fromP);
  if (planetName === "Saturn") return [3, 7, 10].includes(fromP);
  if (planetName === "Mars") return [4, 7, 8].includes(fromP);
  return fromP === 7; // others aspect 7th from self
}

function areaSignals(chart, dasha, sarva) {
  const planets = chart.planets;
  const P = n => planets.find(p => p.name === n);
  const houseSignIdx = h => (chart.ascSignIndex + h - 1) % 12;
  const lordOfHouse = h => SIGN_LORDS[houseSignIdx(h)];
  const today = new Date().toISOString().slice(0, 10);
  const dashaLords = new Set([dasha.current_mahadasha.lord, dasha.current_antardasha.lord]);

  function area(areaName, houses, karakas) {
    const pos = [], neg = [];
    let binduSum = 0, binduN = 0;
    for (const h of houses) {
      const si = houseSignIdx(h);
      const b = sarva[si];
      binduSum += b; binduN++;
      if (b >= 29) pos.push(`house ${h} (${SIGNS[si]}) bindus ${b}/48 — strong support`);
      if (b <= 24) neg.push(`house ${h} (${SIGNS[si]}) bindus sirf ${b}/48 — weak support`);
      const lord = lordOfHouse(h);
      const L = P(lord);
      const d = L?.dignity || "";
      if (d.includes("Exalted") || d.includes("Own")) pos.push(`house ${h} lord ${lord} ${d}, ${L.house}th house mein`);
      if (d.includes("Debilitated")) neg.push(`house ${h} lord ${lord} DEBILITATED, ${L?.house}th house mein — real challenge signal`);
      if (L?.combust) neg.push(`house ${h} lord ${lord} combust (Sun ke paas) — power weak`);
      for (const mal of ["Saturn", "Mars", "Rahu", "Ketu"]) {
        if (P(mal)?.house === h) neg.push(`malefic ${mal} house ${h} mein baitha hai`);
      }
      for (const ben of ["Jupiter", "Venus", "Mercury", "Moon"]) {
        if (P(ben)?.house === h) pos.push(`benefic ${ben} house ${h} mein`);
      }
      for (const asp of ["Jupiter", "Saturn", "Mars"]) {
        if (aspectsHouse(asp, h, planets)) {
          if (BENEFICS.includes(asp)) pos.push(`Jupiter ki drishti house ${h} par — protection`);
          else neg.push(`${asp} ki drishti house ${h} par — pressure/delay`);
        }
      }
    }
    for (const k of karakas) {
      const K = P(k);
      if (!K) continue;
      const d = K.dignity || "";
      if (d.includes("Exalted") || d.includes("Own")) pos.push(`karak ${k} ${d}, ${K.house}th house mein`);
      if (d.includes("Debilitated")) neg.push(`karak ${k} DEBILITATED (${K.sign}) — karak weak`);
      if (K.combust) neg.push(`karak ${k} combust — results delayed`);
      if (K.retrograde && k !== "Rahu" && k !== "Ketu") neg.push(`${k} retrograde — results me Atkaav`);
    }
    const active = [...dashaLords].filter(l => houses.some(h => lordOfHouse(h) === l) || karakas.includes(l));
    if (active.length) pos.push(`current dasha/antardasha lord (${[...dashaLords].join("+")}) is area se linked hai — period ACTIVE hai`);
    else neg.push(`current dasha lords is area se directly linked nahi — external push kam`);
    const avgB = (binduSum / binduN).toFixed(1);
    const trend = neg.length > pos.length + 1 ? "NEGATIVE" : pos.length > neg.length + 1 ? "POSITIVE" : "MIXED";
    return { area: areaName, houses, trend, bindu_avg: avgB, positive: [...new Set(pos)].slice(0, 6), negative: [...new Set(neg)].slice(0, 6) };
  }

  return [
    area("marriage", [7], ["Venus"]),
    area("career", [10], ["Saturn", "Sun"]),
    area("money", [2, 11], ["Jupiter"]),
    area("health", [6, 8], ["Saturn"]),
  ];
}

// ---------- geocoding (bundled cities) ----------
const CITIES = [
  ["Mumbai", 19.076, 72.8777, "+05:30"], ["Delhi", 28.6139, 77.209, "+05:30"], ["New Delhi", 28.6139, 77.209, "+05:30"],
  ["Bangalore", 12.9716, 77.5946, "+05:30"], ["Bengaluru", 12.9716, 77.5946, "+05:30"], ["Hyderabad", 17.385, 78.4867, "+05:30"],
  ["Chennai", 13.0827, 80.2707, "+05:30"], ["Kolkata", 22.5726, 88.3639, "+05:30"], ["Pune", 18.5204, 73.8567, "+05:30"],
  ["Ahmedabad", 23.0225, 72.5714, "+05:30"], ["Jaipur", 26.9124, 75.7873, "+05:30"], ["Lucknow", 26.8467, 80.9462, "+05:30"],
  ["Kanpur", 26.4499, 80.3319, "+05:30"], ["Nagpur", 21.1458, 79.0882, "+05:30"], ["Indore", 22.7196, 75.8577, "+05:30"],
  ["Bhopal", 23.2599, 77.4126, "+05:30"], ["Patna", 25.5941, 85.1376, "+05:30"], ["Surat", 21.1702, 72.8311, "+05:30"],
  ["Varanasi", 25.3176, 82.9739, "+05:30"], ["Agra", 27.1767, 78.0081, "+05:30"], ["Amritsar", 31.634, 74.8723, "+05:30"],
  ["Chandigarh", 30.7333, 76.7794, "+05:30"], ["Kochi", 9.9312, 76.2673, "+05:30"], ["Coimbatore", 11.0168, 76.9558, "+05:30"],
  ["Jamshedpur", 22.8046, 86.2029, "+05:30"], ["Ranchi", 23.3441, 85.3096, "+05:30"], ["Bhubaneswar", 20.2961, 85.8245, "+05:30"],
  ["Guwahati", 26.1445, 91.7362, "+05:30"], ["Dehradun", 30.3165, 78.0322, "+05:30"], ["Jodhpur", 26.2389, 73.0243, "+05:30"],
  ["Udaipur", 24.5854, 73.7125, "+05:30"], ["Gwalior", 26.2183, 78.1828, "+05:30"], ["Ludhiana", 30.901, 75.8573, "+05:30"],
  ["Nashik", 19.9975, 73.7898, "+05:30"], ["Aurangabad", 19.8762, 75.3433, "+05:30"], ["Solapur", 17.6599, 75.9064, "+05:30"],
  ["Vadodara", 22.3072, 73.1812, "+05:30"], ["Rajkot", 22.3039, 70.8022, "+05:30"], ["Meerut", 28.9845, 77.7064, "+05:30"],
  ["Faridabad", 28.4089, 77.3178, "+05:30"], ["Ghaziabad", 28.6692, 77.4538, "+05:30"], ["Noida", 28.5355, 77.391, "+05:30"],
  ["Gurugram", 28.4595, 77.0266, "+05:30"], ["Gurgaon", 28.4595, 77.0266, "+05:30"], ["Howrah", 22.5958, 88.2636, "+05:30"],
  ["Allahabad", 25.4358, 81.8463, "+05:30"], ["Prayagraj", 25.4358, 81.8463, "+05:30"], ["Vijayawada", 16.5062, 80.648, "+05:30"],
  ["Visakhapatnam", 17.6868, 83.2185, "+05:30"], ["Madurai", 9.9252, 78.1198, "+05:30"], ["Mysore", 12.2958, 76.6394, "+05:30"],
  ["Mysuru", 12.2958, 76.6394, "+05:30"], ["Hubli", 15.3647, 75.124, "+05:30"], ["Mangalore", 12.9148, 74.856, "+05:30"],
  ["Thiruvananthapuram", 8.5241, 76.9366, "+05:30"], ["Trivandrum", 8.5241, 76.9366, "+05:30"], ["Srinagar", 34.0837, 74.7973, "+05:30"],
  ["Shimla", 31.1048, 77.1734, "+05:30"], ["Haridwar", 29.9457, 78.1642, "+05:30"], ["Rishikesh", 30.0869, 78.2676, "+05:30"],
  ["Mathura", 27.4924, 77.6737, "+05:30"], ["Vrindavan", 27.5802, 77.698, "+05:30"], ["Ajmer", 26.4499, 74.6399, "+05:30"],
  ["Tirupati", 13.6288, 79.4192, "+05:30"], ["Salem", 11.6643, 78.146, "+05:30"], ["Warangal", 17.9689, 79.5941, "+05:30"],
  ["Gaya", 24.7914, 85.0002, "+05:30"], ["Jabalpur", 23.1815, 79.9864, "+05:30"], ["Raipur", 21.2514, 81.6296, "+05:30"],
  ["Bilaspur", 22.0797, 82.1409, "+05:30"], ["Durgapur", 23.5204, 87.3119, "+05:30"], ["Asansol", 23.6839, 86.9661, "+05:30"],
  ["Siliguri", 26.7271, 88.3953, "+05:30"], ["Jammu", 32.7266, 74.857, "+05:30"], ["Karnal", 29.6909, 76.9736, "+05:30"],
  ["Panipat", 29.3909, 76.9635, "+05:30"], ["Rohtak", 28.8955, 76.6066, "+05:30"], ["Hisar", 29.1492, 75.7217, "+05:30"],
  ["Bikaner", 28.0229, 73.3119, "+05:30"], ["Kota", 25.2138, 75.8648, "+05:30"], ["Bhilai", 21.2094, 81.447, "+05:30"],
  ["Kalyan", 19.2403, 73.1305, "+05:30"], ["Thane", 19.2183, 72.9781, "+05:30"], ["Navi Mumbai", 19.033, 73.0297, "+05:30"],
  ["London", 51.5074, -0.1278, "+00:00"], ["New York", 40.7128, -74.006, "-05:00"], ["Dubai", 25.2048, 55.2708, "+04:00"],
  ["Singapore", 1.3521, 103.8198, "+08:00"], ["Sydney", -33.8688, 151.2093, "+10:00"], ["Toronto", 43.6532, -79.3832, "-05:00"],
  ["Kathmandu", 27.7172, 85.324, "+05:45"], ["Colombo", 6.9271, 79.8612, "+05:30"],
];

export function geocode(name) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  const exact = CITIES.find(c => c[0].toLowerCase() === q);
  if (exact) return { name: exact[0], latitude: exact[1], longitude: exact[2], tzOffset: exact[3] };
  const partial = CITIES.find(c => c[0].toLowerCase().includes(q) || q.includes(c[0].toLowerCase()));
  if (partial) return { name: partial[0], latitude: partial[1], longitude: partial[2], tzOffset: partial[3] };
  return null;
}

function parseBirth(dateStr, timeStr, locationName) {
  const loc = geocode(locationName);
  if (!loc) throw new Error("Location not found in city database: " + locationName + " — ask user for nearest big city");
  const m = String(dateStr).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  const t = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m || !t) throw new Error("Bad date/time format (need DD/MM/YYYY and HH:MM)");
  const [_, dd, mm, yyyy] = m.map(Number);
  const hh = Number(t[1]), mi = Number(t[2]);
  const tz = loc.tzOffset || "+05:30";
  const [tzH, tzM] = tz.split(":").map(Number);
  const sign = tz.startsWith("-") ? -1 : 1;
  const utc = new Date(Date.UTC(yyyy, mm - 1, dd, hh - sign * tzH, mi - sign * tzM));
  return { utc, loc };
}

function fmtChart(r, label) {
  return {
    label,
    location_used: r.loc,
    utc_time: r.utc.toISOString(),
    ascendant: r.chart.ascendant,
    planets: r.chart.planets.map(p => `${p.name}: ${p.sign} ${p.longitude.toFixed(2)}° | house ${p.house} | ${p.nakshatra.name} (${p.nakshatra.lord}) pada ${p.nakshatra.pada}${p.retrograde ? " | RETROGRADE" : ""}${p.dignity ? " | " + p.dignity : ""}${p.combust ? " | COMBUST" : ""}`),
    ashtakavarga_house_bindus: r.houseBindus,
  };
}

function runChart(dateStr, timeStr, locationName) {
  const { utc, loc } = parseBirth(dateStr, timeStr, locationName);
  const jd = julianDay(utc);
  const chart = chartAt(jd, loc.latitude, loc.longitude);
  const moon = chart.planets.find(p => p.name === "Moon");
  const dasha = vimshottari(moon.longitude, utc, new Date());
  const av = ashtakavarga(chart.planets, chart.ascendant.longitude);
  return { utc, loc, chart, dasha, av, houseBindus: houseBindus(av.sarvashtaka, chart.ascSignIndex) };
}

function timelineNote(dasha) {
  return `Abhi ${dasha.current_mahadasha.lord} mahadasha (${dasha.current_mahadasha.from} se ${dasha.current_mahadasha.to}) + ${dasha.current_antardasha.lord} antardasha (${dasha.current_antardasha.from} se ${dasha.current_antardasha.to}) chal rahi hai. Yeh numbers tool se aaye hain — inhi ke hisaab se timing batao, apne andaze se nahi.`;
}

// ---------- the 4 tool implementations ----------

export function get_horoscope_predictions({ birth_date, birth_time, location_name }) {
  const r = runChart(birth_date, birth_time, location_name);
  const now = new Date();
  const nowJd = julianDay(now);
  const transits = chartAt(nowJd, r.loc.latitude, r.loc.longitude);
  const natalMoon = r.chart.planets.find(p => p.name === "Moon");
  const saturnNow = transits.planets.find(p => p.name === "Saturn");
  const areas = areaSignals(r.chart, r.dasha, r.av.sarvashtaka);
  return { content: [{ type: "text", text: JSON.stringify({
    engine: "local-sweph-v2", source: "LOCAL (Swiss Ephemeris, Lahiri, Ashtakavarga)",
    birth_chart: fmtChart(r, "natal"),
    ashtakavarga: { sarvashtaka_by_sign: r.av.sarvashtaka, grand_total: r.av.grand_total },
    dasha: { current_mahadasha: r.dasha.current_mahadasha, current_antardasha: r.dasha.current_antardasha },
    timeline_note: timelineNote(r.dasha),
    sade_sati: sadeSati(natalMoon.sign, saturnNow.sign),
    verdict_signals: areas,
    instruction: "verdict_signals ke positive/negative factors ka USE karke seedha verdict do — negative factors zyada hain to NEGATIVE bolo, mix hai to MIXED. Bindus aur dasha numbers ke bina koi claim nahi.",
  }) }] };
}

export function get_current_transits({ birth_date, birth_time, location_name }) {
  const r = runChart(birth_date, birth_time, location_name);
  const now = new Date();
  const nowJd = julianDay(now);
  const transits = chartAt(nowJd, r.loc.latitude, r.loc.longitude);
  const natalMoonSign = r.chart.planets.find(p => p.name === "Moon").sign;
  const saturnNow = transits.planets.find(p => p.name === "Saturn");
  const jupNow = transits.planets.find(p => p.name === "Jupiter");
  const transitList = transits.planets.map(p => {
    const overHouse = ((signIndex(p.longitude) - r.chart.ascSignIndex + 12) % 12) + 1;
    const b = r.av.sarvashtaka[signIndex(p.longitude)];
    return {
      planet: p.name, sign: p.sign, over_natal_house: overHouse,
      transited_sign_bindus: b, bindu_verdict: binduVerdict(b),
      natal_house: r.chart.planets.find(x => x.name === p.name).house,
      retrograde: p.retrograde,
    };
  });
  return { content: [{ type: "text", text: JSON.stringify({
    engine: "local-sweph-v2", source: "LOCAL (Swiss Ephemeris, Lahiri, Ashtakavarga)",
    as_of_utc: now.toISOString(),
    natal_ascendant: r.chart.ascendant,
    natal_moon_sign: natalMoonSign,
    current_mahadasha: r.dasha.current_mahadasha,
    current_antardasha: r.dasha.current_antardasha,
    sade_sati: sadeSati(natalMoonSign, saturnNow.sign),
    gochara: transitList,
    highlight: `Saturn ${saturnNow.sign} mein, Jupiter ${jupNow.sign} mein. Bindus kam wale signs mein graha ja rahe hain = pressure wahan.`,
    instruction: "Gochara + sade_sati + bindus se current phase ka verdict do — negative dikh raha hai to seedha negative bolo.",
  }) }] };
}

export function get_horary_prediction({ horary_number, question_text, birth_date, birth_time, location_name, query_date, query_time, query_location_name }) {
  const now = query_date && query_time ? new Date(query_date + "T" + query_time + "Z") : new Date();
  const qloc = geocode(query_location_name || location_name || "Mumbai") || { name: "Mumbai", latitude: 19.076, longitude: 72.8777 };
  const nowJd = julianDay(now);
  const chart = chartAt(nowJd, qloc.latitude, qloc.longitude);
  const av = ashtakavarga(chart.planets, chart.ascendant.longitude);
  const num = Number(horary_number) || (100 + Math.floor(Math.random() * 900));
  const risingIndex = (num - 1) % 12;
  const moon = chart.planets.find(p => p.name === "Moon");
  const lagnaLord = SIGN_LORDS[risingIndex];
  const lagnaLordP = chart.planets.find(p => p.name === lagnaLord);
  const moonNakLord = moon.nakshatra.lord;
  const karakasOk = [lagnaLordP?.dignity, moonNakLord].join(",");
  return { content: [{ type: "text", text: JSON.stringify({
    engine: "local-sweph-v2", source: "LOCAL (Swiss Ephemeris, Lahiri, Ashtakavarga)",
    horary_number: num, question: question_text || "(not provided)",
    method: "Prashna: lagna number se seeded, planets query-moment par",
    prashna_lagna: { sign: SIGNS[risingIndex], lord: lagnaLord, lord_condition: lagnaLordP ? (lagnaLordP.dignity || "neutral") + ", house " + lagnaLordP.house : "unknown" },
    moon: { sign: moon.sign, nakshatra: moon.nakshatra.name, nakshatra_lord: moonNakLord },
    judgment: `Prashna rule: lagna lord ${lagnaLord} strong (${lagnaLordP?.dignity || "neutral"}) + Moon benefic nakshatra lord (${moonNakLord}) mein = positive; weak/debilitated = negative. Sarvashtaka total moment chart: ${av.grand_total}.`,
    moment_bindus_by_sign: av.sarvashtaka,
    instruction: "Lagna lord ki condition + Moon ke nakshatra lord se yes/no verdict do — strong = YES, weak/debilitated = NO. Ghusa mat, seedha bolo.",
  }) }] };
}

export function get_match_report({ male_birth_date, male_birth_time, male_location_name, female_birth_date, female_birth_time, female_location_name }) {
  const m = runChart(male_birth_date, male_birth_time, male_location_name);
  const f = runChart(female_birth_date, female_birth_time, female_location_name);
  const mMoon = m.chart.planets.find(p => p.name === "Moon");
  const fMoon = f.chart.planets.find(p => p.name === "Moon");
  const mIdx = NAKSHATRAS.indexOf(mMoon.nakshatra.name), fIdx = NAKSHATRAS.indexOf(fMoon.nakshatra.name);
  const tara = ((fIdx - mIdx + 27) % 27) + 1;
  const m7 = m.houseBindus.house_7, f7 = f.houseBindus.house_7;
  return { content: [{ type: "text", text: JSON.stringify({
    engine: "local-sweph-v2", source: "LOCAL (Swiss Ephemeris, Lahiri, Ashtakavarga)",
    male_chart: fmtChart(m, "male"), female_chart: fmtChart(f, "female"),
    compatibility: {
      male_moon: { sign: mMoon.sign, nakshatra: mMoon.nakshatra.name, lord: mMoon.nakshatra.lord },
      female_moon: { sign: fMoon.sign, nakshatra: fMoon.nakshatra.name, lord: fMoon.nakshatra.lord },
      tara_count: tara, same_nakshatra: mIdx === fIdx,
      male_7th_house: m7, female_7th_house: f7,
      male_dasha: m.dasha.current_mahadasha, female_dasha: f.dasha.current_mahadasha,
      note: "7th house bindus kam (<25) = rishte mein real friction. Dono charts ke verdict_signals bhi dekho.",
    },
    instruction: "Bindus + moon matching se seedha compatibility verdict do — kamzor signal hai to NEGATIVE bolo, softening nahi.",
  }) }] };
}
