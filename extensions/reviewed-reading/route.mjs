import { execFile } from "node:child_process";
import path from "node:path";

const MAX_BODY = 4096;
const MAX_CONCURRENT = 2;
const VEDASTRO_REVISION = "40763952742f76369a505d8db2e9e9fa67f75d78";
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

export function validReadingTimingContext(evidence) {
  const context = evidence?.timing_context;
  if (context === undefined) {
    return evidence?.period_interpretation_available === false;
  }
  try {
    const skyMinute = Date.parse(context.as_of_utc);
    const readingMinute = Date.parse(evidence.as_of_utc);
    const periods = Object.entries(evidence.current_period.mahadashas);
    const [major, period] = periods[0];
    const minorPeriods = Object.keys(period.antardashas);
    const ratings = context.period_ratings;
    const moonSign = SIGNS.indexOf(evidence.chart_facts.moon_sign);
    if (
      evidence.period_interpretation_available !== true ||
      evidence.settings.engine !== "VedAstro.Library" ||
      context.schema !== "reviewed-timing-context-v1" ||
      context.period_rule_source_revision !== VEDASTRO_REVISION ||
      context.verified_against !== "pyswisseph" ||
      context.transit_reference !== "natal_moon_sign" ||
      context.obstruction_evaluated !== false ||
      context.event_prediction_available !== false ||
      !Number.isFinite(skyMinute) ||
      skyMinute % 60000 !== 0 ||
      !Number.isFinite(readingMinute) ||
      Math.floor(readingMinute / 60000) !== skyMinute / 60000 ||
      periods.length !== 1 ||
      minorPeriods.length !== 1 ||
      context.period_rule_id !== major + minorPeriods[0] + "PD2" ||
      !ratings ||
      Object.keys(ratings).toSorted().join(",") !== "family,relationship,study" ||
      Object.values(ratings).some((value) => !["Good", "Neutral", "Bad"].includes(value)) ||
      JSON.stringify(context) !== JSON.stringify(evidence.provider.timing_context) ||
      moonSign < 0 ||
      Object.keys(context.transits).toSorted().join(",") !== "Jupiter,Saturn"
    ) {
      return false;
    }
    return Object.values(context.transits).every(
      (row) =>
        typeof row.longitude === "number" &&
        Number.isFinite(row.longitude) &&
        row.longitude >= 0 &&
        row.longitude < 360 &&
        row.sign === SIGNS[Math.floor(row.longitude / 30)] &&
        Number.isInteger(row.house_from_natal_moon) &&
        row.house_from_natal_moon === ((Math.floor(row.longitude / 30) - moonSign + 12) % 12) + 1,
    );
  } catch {
    return false;
  }
}

export function validReadingProvider(evidence) {
  if (evidence?.settings?.engine === "pyswisseph") {
    return evidence.provider === undefined;
  }
  const provider = evidence?.provider;
  const strength = provider?.strength;
  const components = strength?.components_virupas;
  if (
    !components ||
    Object.keys(components).toSorted().join(",") !==
      "PlanetChestaBala,PlanetDigBala,PlanetDrikBala,PlanetKalaBala,PlanetNaisargikaBala,PlanetSthanaBala" ||
    Object.values(components).some((part) => typeof part !== "number" || !Number.isFinite(part))
  ) {
    return false;
  }
  const sum = Object.values(components).reduce((total, part) => total + part, 0);
  return (
    evidence?.settings?.engine === "VedAstro.Library" &&
    evidence.settings.source_revision === VEDASTRO_REVISION &&
    provider?.name === "vedastro-local" &&
    provider.source_revision === VEDASTRO_REVISION &&
    provider.verified_against === "pyswisseph" &&
    provider.topic === evidence.topic &&
    provider.native_settings?.engine === "VedAstro.Library" &&
    provider.native_settings.ayanamsa === "LAHIRI" &&
    provider.native_settings.house_system === "vedastro_bhava" &&
    provider.native_settings.node === "true" &&
    provider.native_settings.dasha_year_days === 365.25 &&
    Object.keys(provider.native_settings).length === 5 &&
    provider.strength?.native_house_system === "vedastro_bhava" &&
    provider.strength.planet === provider.topic_ruler &&
    typeof provider.strength.total_virupas === "number" &&
    Number.isFinite(provider.strength.total_virupas) &&
    provider.strength.total_virupas > 0 &&
    Math.abs(sum - strength.total_virupas) <= 0.011 &&
    typeof strength.total_rupas === "number" &&
    Math.abs(strength.total_rupas - strength.total_virupas / 60) <= 0.000001 &&
    typeof strength.meets_engine_strength_test === "boolean" &&
    evidence.advanced?.topic_ruler?.planet === provider.topic_ruler &&
    evidence.advanced?.event_timing_available === false
  );
}

export function validReadingResult(result, value) {
  const evidence = result?.evidence;
  return (
    result?.schema === "reviewed-reading-v1" &&
    typeof result.text === "string" &&
    result.text.trim().length > 0 &&
    result.text.length <= 16000 &&
    result.model_calls === 0 &&
    result.model_tokens === 0 &&
    evidence?.schema === "topic-reading-v1" &&
    ["reviewed-placements-v1", "reviewed-placements-v2"].includes(evidence.rules_revision) &&
    evidence.settings?.ayanamsa === "LAHIRI" &&
    evidence.settings?.house_system === "whole_sign" &&
    validReadingProvider(evidence) &&
    evidence.settings?.node === "true" &&
    evidence.settings?.dasha_year_days === 365.25 &&
    typeof evidence.input_fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(evidence.input_fingerprint) &&
    validReadingTimingContext(evidence) &&
    Array.isArray(evidence.factors) &&
    evidence.factors.length >= 1 &&
    evidence.factors.length <= 3 &&
    evidence.factors.every(
      (factor) =>
        factor &&
        typeof factor.fact === "object" &&
        factor.fact !== null &&
        !Array.isArray(factor.fact) &&
        ["vedastro_classical", "local_house_symbolism"].includes(factor.source),
    ) &&
    evidence.topic === value.topic &&
    result.language === (value.language ?? "english") &&
    result.intent === (value.intent ?? "overview") &&
    (result.style === undefined || ["brief", "standard", "detailed"].includes(result.style)) &&
    (result.follow_up === undefined || typeof result.follow_up === "boolean") &&
    (result.style ?? "standard") === (value.style ?? "standard") &&
    (result.follow_up ?? true) === (value.follow_up ?? true)
  );
}

export function validateReadingInput(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        !["dob", "tob", "place", "topic", "language", "intent", "style", "follow_up"].includes(key),
    ) ||
    !["career", "education", "marriage"].includes(value.topic) ||
    !["english", "hinglish"].includes(value.language ?? "english") ||
    !["overview", "timing"].includes(value.intent ?? "overview") ||
    (value.style !== undefined && !["brief", "standard", "detailed"].includes(value.style)) ||
    (value.follow_up !== undefined && typeof value.follow_up !== "boolean") ||
    (value.intent === "timing" && !["marriage", "career"].includes(value.topic))
  ) {
    throw new Error("Invalid request");
  }
  for (const key of ["dob", "tob", "place"]) {
    // Reject control characters in user-provided birth details intentionally.
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
  return value;
}

export function calculateReading(value, run = execFile) {
  return new Promise((resolve, reject) => {
    // No shell, arbitrary script path, model call, retries or unbounded output.
    run(
      "python3",
      [
        path.join(process.env.OPENCLAW_STATE_DIR || "/app/.openclaw", "skills/kundli/calculate.py"),
        "--dob",
        value.dob,
        "--tob",
        value.tob,
        "--place",
        value.place,
        "--reading-topic",
        value.topic,
        "--render-reading",
        "--reading-language",
        value.language ?? "english",
        "--reading-intent",
        value.intent ?? "overview",
        "--reading-style",
        value.style ?? "standard",
        ...(value.follow_up === false ? ["--no-reading-follow-up"] : []),
      ],
      { timeout: 30_000, maxBuffer: 128 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          return reject(new Error("Chart calculation unavailable"));
        }
        try {
          const result = JSON.parse(stdout);
          if (!validReadingResult(result, value)) {
            throw new Error("Invalid calculated reading");
          }
          resolve(result);
        } catch {
          reject(new Error("Chart calculation unavailable"));
        }
      },
    );
  });
}

export function createReadingHandler(
  calculate = calculateReading,
  { validate = validateReadingInput, maxBody = MAX_BODY } = {},
) {
  let active = 0;
  return async (req, res) => {
    const send = (status, body) => {
      if (res.destroyed || res.writableEnded) {
        return;
      }
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      send(405, { error: "method_not_allowed" });
      return;
    }
    if (active >= MAX_CONCURRENT) {
      send(503, { error: "reading_busy" });
      return;
    }
    active += 1;
    const timer = setTimeout(() => {
      send(408, { error: "request_timeout" });
      req.destroy();
    }, 10_000);
    timer.unref();
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > maxBody) {
          send(413, { error: "request_too_large" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      clearTimeout(timer);
      let value;
      try {
        value = validate(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        send(400, { error: "invalid_reading_request" });
        return;
      }
      try {
        send(200, await calculate(value));
      } catch {
        // Never expose child output, birth details or filesystem information.
        send(422, { error: "birth_details_unresolved" });
      }
    } catch {
      send(400, { error: "invalid_reading_request" });
    } finally {
      clearTimeout(timer);
      active -= 1;
    }
  };
}
