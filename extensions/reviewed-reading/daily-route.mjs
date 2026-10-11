import { execFile } from "node:child_process";
import path from "node:path";
import { createReadingHandler } from "./route.mjs";

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
const SEVEN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const PLANETS = [...SEVEN, "Rahu", "Ketu"];
const REVISION = "40763952742f76369a505d8db2e9e9fa67f75d78";
const sameKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).toSorted().join(",") ===
    [...keys].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",");

export function validateDailyInput(value, contractVersion = 1) {
  if (contractVersion !== 1) {
    throw new Error("Unsupported daily contract");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["dob", "tob", "place", "language", "date"].includes(key)) ||
    !["english", "hinglish"].includes(value.language ?? "english")
  ) {
    throw new Error("Invalid daily request");
  }
  for (const key of ["dob", "tob", "place"]) {
    if (
      typeof value[key] !== "string" ||
      !value[key].trim() ||
      value[key].length > 160 ||
      // eslint-disable-next-line no-control-regex -- reject control characters deliberately
      /[\u0000-\u001f]/u.test(value[key])
    ) {
      throw new Error("Invalid birth details");
    }
  }
  if (value.date !== undefined) {
    if (
      typeof value.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(value.date) ||
      !Number.isFinite(Date.parse(value.date + "T12:00:00Z")) ||
      new Date(value.date + "T12:00:00Z").toISOString().slice(0, 10) !== value.date
    ) {
      throw new Error("Invalid daily date");
    }
  }
  return value;
}

export function validDailyEvidence(e, value, now = Date.now()) {
  try {
    const stamp = Date.parse(e.as_of_utc);
    const s = e.native_settings;
    if (
      e.schema !== "reviewed-daily-evidence-v1" ||
      e.provider !== "vedastro-local" ||
      e.source_revision !== REVISION ||
      e.verified_against !== "pyswisseph" ||
      e.model_calls !== 0 ||
      e.event_prediction_available !== false ||
      e.obstruction_evaluated !== false ||
      e.transit_house_reference !== "natal_moon_whole_sign" ||
      e.kaksha_validation !== "native_source_type_range_and_lord_geometry" ||
      !/^[a-f0-9]{64}$/u.test(e.input_fingerprint) ||
      !Number.isFinite(stamp) ||
      stamp % 60000 !== 0 ||
      (value.date
        ? stamp !== Date.parse(value.date + "T12:00:00Z")
        : Math.abs(now - stamp) > 120000) ||
      !sameKeys(s, ["ayanamsa", "node", "dasha_year_days", "house_system", "engine"]) ||
      s.ayanamsa !== "LAHIRI" ||
      s.node !== "true" ||
      s.dasha_year_days !== 365.25 ||
      s.house_system !== "vedastro_bhava" ||
      s.engine !== "VedAstro.Library" ||
      !sameKeys(e.natal.planets, PLANETS) ||
      !sameKeys(e.transits, PLANETS) ||
      !sameKeys(e.kakshas, SEVEN)
    ) {
      return false;
    }
    for (const row of Object.values(e.natal.planets)) {
      if (
        typeof row.longitude !== "number" ||
        !Number.isFinite(row.longitude) ||
        row.longitude < 0 ||
        row.longitude >= 360 ||
        row.sign !== SIGNS[Math.floor(row.longitude / 30)]
      ) {
        return false;
      }
    }
    const moon = Math.floor(e.natal.planets.Moon.longitude / 30);
    for (const row of Object.values(e.transits)) {
      if (
        typeof row.longitude !== "number" ||
        !Number.isFinite(row.longitude) ||
        row.longitude < 0 ||
        row.longitude >= 360 ||
        row.sign !== SIGNS[Math.floor(row.longitude / 30)] ||
        !Number.isInteger(row.house_from_natal_moon) ||
        row.house_from_natal_moon !== ((Math.floor(row.longitude / 30) - moon + 12) % 12) + 1
      ) {
        return false;
      }
    }
    for (const row of Object.values(e.kakshas)) {
      for (const [key, max] of [
        ["kaksha_score", 1],
        ["bhinna_ashtakavarga", 8],
        ["sarva_ashtakavarga", 56],
      ]) {
        if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] > max) {
          return false;
        }
      }
    }
    return (
      PLANETS.includes(e.current_period.mahadasha) &&
      PLANETS.includes(e.current_period.antardasha) &&
      e.current_period.year_days === 365.25 &&
      e.timing_context.event_prediction_available === false &&
      e.timing_context.obstruction_evaluated === false &&
      e.timing_context.as_of_utc === e.as_of_utc
    );
  } catch {
    return false;
  }
}

export function calculateDaily(value, run = execFile) {
  return new Promise((resolve, reject) => {
    if (process.env.VEDASTRO_DAILY_ENABLED !== "1") {
      return reject(new Error("Daily reading disabled"));
    }
    run(
      "python3",
      [
        path.join(
          process.env.OPENCLAW_STATE_DIR || "/app/.openclaw",
          "skills/horoscope/calculate.py",
        ),
        "--dob",
        value.dob,
        "--tob",
        value.tob,
        "--place",
        value.place,
        "--language",
        value.language ?? "english",
        ...(value.date ? ["--date", value.date] : []),
      ],
      { timeout: 30000, maxBuffer: 128 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          return reject(new Error("Daily calculation unavailable"));
        }
        try {
          const result = JSON.parse(stdout);
          if (
            result.error ||
            result.language !== (value.language ?? "english") ||
            typeof result.prediction !== "string" ||
            !result.prediction.trim() ||
            result.prediction.length > 8000 ||
            !validDailyEvidence(result.evidence, value)
          ) {
            throw new Error("Invalid daily evidence");
          }
          resolve({
            schema: "reviewed-daily-reading-v1",
            text: result.prediction,
            language: result.language,
            model_calls: 0,
            model_tokens: 0,
            evidence: result.evidence,
          });
        } catch {
          reject(new Error("Daily calculation unavailable"));
        }
      },
    );
  });
}

export function createDailyHandler(calculate = calculateDaily, { concurrency } = {}) {
  return createReadingHandler(calculate, { validate: validateDailyInput, concurrency });
}
