// Deterministic North Indian Ashtakoota base scores, independently implemented
// from published matching tables. See docs/astrology/guna-milan.md for the
// selected convention, sources, orientation and deliberate exclusions.
const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const LORDS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const STARS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const VARNAS = ["Shudra", "Vaishya", "Kshatriya", "Brahmin"];
const VASHYAS = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"];
const YONIS = ["Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat", "Cow", "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion"];
const GANAS = ["Deva", "Manushya", "Rakshasa"];
const NADIS = ["Adi", "Madhya", "Antya"];
const STAR_YONI = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
const STAR_GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
const STAR_NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
// All matrices use bride/female rows and groom/male columns. Gana and Varna
// are directional: exchanging the supplied calculation roles can change them.
const VASHYA_POINTS = [[2, 1, 1, 0, 1], [1, 2, 1, 0, 1], [1, 1, 2, 1, 1], [0, 0, 1, 2, 0], [1, 1, 1, 0, 2]];
const GANA_POINTS = [[6, 5, 1], [6, 6, 0], [1, 0, 6]];
const YONI_POINTS = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const MAITRI_POINTS = [
  [5, 5, 5, 4, 5, 0, 0],
  [5, 5, 4, 1, 4, 0.5, 0.5],
  [5, 4, 5, 0.5, 5, 3, 0.5],
  [4, 1, 0.5, 5, 0.5, 5, 4],
  [5, 4, 5, 0.5, 5, 0.5, 3],
  [0, 0.5, 3, 5, 0.5, 5, 5],
  [0, 0.5, 0.5, 4, 3, 5, 5],
];

function sectorIndex(longitude, sectors) {
  let index = Math.min(sectors - 1, Math.floor(longitude * sectors / 360));
  // Correct multiplication rounding at an adjacent representable boundary;
  // never round the supplied longitude or add a tolerance across a boundary.
  if (index > 0 && longitude < index * 360 / sectors) index--;
  else if (index < sectors - 1 && longitude >= (index + 1) * 360 / sectors) index++;
  return index;
}

export function moonAttributes(longitude) {
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360) {
    throw new Error("A calculated sidereal Moon longitude in [0, 360) is required for each partner");
  }
  const sign = Math.floor(longitude / 30);
  const star = sectorIndex(longitude, 27);
  const pada = sectorIndex(longitude, 108) % 4 + 1;
  const degree = longitude - sign * 30;
  const varna = [2, 1, 0, 3][sign % 4];
  const vashya = sign === 8 ? (degree < 15 ? 1 : 0)
    : sign === 9 ? (degree < 15 ? 0 : 2)
    : [0, 0, 1, 2, 3, 1, 1, 4, null, null, 1, 2][sign];
  return {
    longitude, sign_index: sign, sign: SIGNS[sign], sign_degree: degree,
    nakshatra_index: star, nakshatra: STARS[star], pada, moon_lord: LORDS[sign],
    varna: VARNAS[varna], varna_rank: varna,
    vashya: VASHYAS[vashya], vashya_index: vashya,
    yoni: YONIS[STAR_YONI[star]], yoni_index: STAR_YONI[star],
    gana: GANAS[STAR_GANA[star]], gana_index: STAR_GANA[star],
    nadi: NADIS[STAR_NADI[star]],
  };
}

export function gunaMilan(maleMoonLongitude, femaleMoonLongitude) {
  const male = moonAttributes(maleMoonLongitude);
  const female = moonAttributes(femaleMoonLongitude);
  const maleToFemale = (female.nakshatra_index - male.nakshatra_index + 27) % 27 + 1;
  const femaleToMale = (male.nakshatra_index - female.nakshatra_index + 27) % 27 + 1;
  const taraHalf = count => [3, 5, 7].includes(count % 9) ? 0 : 1.5;
  const signDistance = (female.sign_index - male.sign_index + 12) % 12 + 1;
  const factors = [
    { id: "varna", name: "Varna", score: male.varna_rank >= female.varna_rank ? 1 : 0, max_score: 1, male: male.varna, female: female.varna },
    { id: "vashya", name: "Vashya", score: VASHYA_POINTS[female.vashya_index][male.vashya_index], max_score: 2, male: male.vashya, female: female.vashya },
    { id: "tara", name: "Tara", score: taraHalf(maleToFemale) + taraHalf(femaleToMale), max_score: 3, male_to_female_count: maleToFemale, female_to_male_count: femaleToMale },
    { id: "yoni", name: "Yoni", score: YONI_POINTS[female.yoni_index][male.yoni_index], max_score: 4, male: male.yoni, female: female.yoni },
    { id: "graha_maitri", name: "Graha Maitri", score: MAITRI_POINTS[PLANETS.indexOf(female.moon_lord)][PLANETS.indexOf(male.moon_lord)], max_score: 5, male: male.moon_lord, female: female.moon_lord },
    { id: "gana", name: "Gana", score: GANA_POINTS[female.gana_index][male.gana_index], max_score: 6, male: male.gana, female: female.gana },
    { id: "bhakoot", name: "Bhakoot", score: [2, 5, 6, 8, 9, 12].includes(signDistance) ? 0 : 7, max_score: 7, male: male.sign, female: female.sign },
    { id: "nadi", name: "Nadi", score: male.nadi === female.nadi ? 0 : 8, max_score: 8, male: male.nadi, female: female.nadi },
  ];
  const score = factors.reduce((sum, item) => sum + item.score, 0);
  return {
    status: "ok", system: "North Indian Ashtakoota", ruleset: "astrofriend-north-base-v1",
    score_points: score, score_max: 36, display_score: `${score}/36`, factors,
    male_moon: male, female_moon: female,
    doshas: { nadi: factors[7].score === 0, bhakoot: factors[6].score === 0 },
    exceptions_applied: false,
    interpretation_scope: "Base Guna Milan score, not a probability of relationship success. Dosha cancellations, Manglik and other chart assessments are separate and are not added to this total. Traditional tables can differ between schools.",
  };
}
