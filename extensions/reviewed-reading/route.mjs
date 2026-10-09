import { execFile } from "node:child_process";
import path from "node:path";
import { periodStatus, validWindowRule, revisions } from "./period-rules.mjs";

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

function validLegacyResult(result, value) {
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

export function validPredictionAssessment(assessment, topic) {
  const statuses = ["supportive", "adverse", "mixed", "limited", "conditional", "unsupported"];
  return (
    assessment?.schema === "prediction-assessment-v1" &&
    assessment.topic === topic &&
    ["supportive", "adverse", "mixed", "limited", "conditional"].includes(
      assessment.conclusion?.status,
    ) &&
    ["supportive", "adverse", "mixed", "limited"].includes(assessment.natal?.status) &&
    Array.isArray(assessment.natal.reasons) &&
    assessment.natal.reasons.length <= 3 &&
    assessment.natal.reasons.every(
      (reason) =>
        reason &&
        typeof reason.id === "string" &&
        ["supportive", "adverse"].includes(reason.status) &&
        reason.fact &&
        typeof reason.fact === "object",
    ) &&
    statuses.includes(assessment.current_period?.status) &&
    ["conditional", "unsupported", "uncertain_birth"].includes(assessment.event?.status) &&
    Array.isArray(assessment.event.windows) &&
    assessment.event.windows.length <= 2 &&
    (assessment.event.status === "conditional") === assessment.event.windows.length > 0 &&
    assessment.event.windows.every(
      (window) =>
        window &&
        window.kind === "traditional_candidate" &&
        validWindowRule(window, true) &&
        [1, 2].includes(window.priority) &&
        /^\d{4}-\d{2}-\d{2}T.*Z$/u.test(window.start) &&
        /^\d{4}-\d{2}-\d{2}T.*Z$/u.test(window.end) &&
        Number.isFinite(Date.parse(window.start)) &&
        Number.isFinite(Date.parse(window.end)) &&
        Date.parse(window.start) < Date.parse(window.end),
    ) &&
    (topic === "marriage" || assessment.event.windows.length === 0)
  );
}

export function validOutcomeEvidence(evidence, topic) {
  if (!validPredictionAssessment(evidence?.prediction_assessment, topic)) {
    return false;
  }
  if (!revisions.includes(evidence.rules_revision)) return false;
  const extended = evidence.rules_revision === "reviewed-outcomes-v3";
  const assessment = evidence.prediction_assessment;
  const scopes = {
    marriage: "relationship_quality",
    career: "career_indications",
    education: "learning_conditions",
    finance: "financial_indications",
  };
  const rules = {
    SaturnIn7thNotLagnaLord: ["adverse", "Saturn", 7, undefined],
    JupiterInHouse7: ["supportive", "Jupiter", 7, undefined],
    House7LordInHouse4: ["supportive", null, 4, 7],
    House10LordInHouse8: ["adverse", null, 8, 10],
    House10LordInHouse12: ["adverse", null, 12, 10],
    House10LordInHouse11: ["supportive", null, 11, 10],
  };
  const planets = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
  const natalSource =
    "https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/HoroscopeDataList.xml";
  const periodSource =
    "https://github.com/VedAstro/VedAstro/blob/master/Library/XMLData/EventDataList.xml";
  const instant = (value) => {
    if (typeof value !== "string") {
      throw new Error("Invalid timestamp");
    }
    const match =
      /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d{1,6}))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
        value,
      );
    const parsed = Date.parse(value);
    if (
      !match ||
      !Number.isFinite(parsed) ||
      value.startsWith("0000") ||
      new Date(Date.parse(match[1] + "T00:00:00Z")).toISOString().slice(0, 10) !== match[1]
    ) {
      throw new Error("Invalid timestamp");
    }
    return BigInt(parsed) * 1000n + BigInt((match[2] ?? "").padEnd(6, "0").slice(3));
  };
  try {
    if (
      !Object.hasOwn(scopes, topic) ||
      assessment.conclusion.scope !== scopes[topic] ||
      assessment.natal.scope !==
        (topic === "marriage" ? "relationship_quality" : "topic_indications") ||
      assessment.event.scope !==
        (topic === "marriage" ? "selected_marriage_period_rules" : "event_timing_not_reviewed")
    ) {
      return false;
    }
    const asc = SIGNS.indexOf(evidence.chart_facts?.lagna);
    if (asc < 0) {
      return false;
    }
    const allowedReasons = {
      marriage: ["SaturnIn7thNotLagnaLord", "JupiterInHouse7", "House7LordInHouse4"],
      career: ["House10LordInHouse8", "House10LordInHouse12", "House10LordInHouse11"],
      education: [], finance: [],
    };
    const seenReasons = new Set();
    for (const reason of assessment.natal.reasons) {
      if (!allowedReasons[topic].includes(reason.id) || seenReasons.has(reason.id)) {
        return false;
      }
      seenReasons.add(reason.id);
      const [status, planet, house, ruler] = rules[reason.id],
        fact = reason.fact;
      if (
        !fact ||
        Array.isArray(fact) ||
        reason.source !== natalSource ||
        reason.status !== status ||
        !planets.has(fact.planet) ||
        (planet && fact.planet !== planet) ||
        !Number.isInteger(fact.house) ||
        fact.house !== house ||
        fact.rules_house !== ruler ||
        !SIGNS.includes(fact.sign) ||
        ((SIGNS.indexOf(fact.sign) - asc + 12) % 12) + 1 !== house
      ) {
        return false;
      }
    }
    const natalDirections = new Set(assessment.natal.reasons.map(reason => reason.status));
    const natalStatus = natalDirections.size === 2 ? "mixed" : [...natalDirections][0] ?? "limited";
    if (assessment.natal.status !== natalStatus) return false;
    const directions = new Set([natalStatus, assessment.current_period.status]);
    const conclusion = directions.has("mixed") || (directions.has("supportive") && directions.has("adverse")) ? "mixed" :
      directions.has("supportive") ? "supportive" : directions.has("adverse") ? "adverse" :
      directions.has("conditional") ? "conditional" : "limited";
    if (assessment.conclusion.status !== conclusion) return false;
    const period = assessment.current_period,
      majors = Object.entries(evidence.current_period.mahadashas);
    if (majors.length !== 1) {
      return false;
    }
    const [major, data] = majors[0],
      minors = Object.entries(data.antardashas);
    if (minors.length !== 1) {
      return false;
    }
    const [minor, dates] = minors[0],
      when = instant(evidence.as_of_utc),
      start = instant(period.start),
      end = instant(period.end);
    if (
      major !== period.mahadasha ||
      minor !== period.antardasha ||
      instant(dates.start) !== start ||
      instant(dates.end) !== end ||
      when < start ||
      when >= end
    ) {
      return false;
    }
    if (period.status === "unsupported") {
      if (period.rule_id !== null || period.source !== null) {
        return false;
      }
    } else if (
      periodStatus(major, minor, topic, extended) === undefined ||
      period.rule_id !== major + minor + "PD2" ||
      period.source !== periodSource
    ) {
      return false;
    }
    if (period.status !== (periodStatus(major, minor, topic, extended) ?? "unsupported")) return false;
    const horizon = instant(assessment.event.search_end),
      seen = new Set();
    if (horizon <= when) {
      return false;
    }
    for (const window of assessment.event.windows) {
      const first = instant(window.start),
        last = instant(window.end);
      if (
        seen.has(window.rule_id) ||
        window.source !== periodSource ||
        !validWindowRule(window, extended) ||
        first < when ||
        first >= horizon ||
        instant(window.period_start) > first ||
        first >= last ||
        (window.priority === 2 &&
          (window.antardasha !== "Jupiter" ||
            !assessment.natal.reasons.some((reason) => reason.id === "JupiterInHouse7")))
      ) {
        return false;
      }
      seen.add(window.rule_id);
    }
    const ordered = [...assessment.event.windows].sort((a,b)=>b.priority-a.priority || a.start.localeCompare(b.start));
    if (ordered.some((window,index)=>window !== assessment.event.windows[index])) return false;
    return true;
  } catch {
    return false;
  }
}

function validOutcomeResult(result, value) {
  const evidence = result?.evidence;
  const current =
    result?.schema === "reviewed-reading-v2" &&
    evidence?.schema === "topic-reading-v2" &&
    revisions.includes(evidence.rules_revision) &&
    typeof evidence.period_interpretation_available === "boolean" &&
    validOutcomeEvidence(evidence, value.topic) &&
    evidence.period_interpretation_available ===
      (evidence.prediction_assessment.current_period.status !== "unsupported");
  return (
    current &&
    validReadingProvider(evidence) &&
    (evidence.timing_context === undefined ||
      validReadingTimingContext({ ...evidence, period_interpretation_available: true })) &&
    evidence.settings?.ayanamsa === "LAHIRI" &&
    evidence.settings?.house_system === "whole_sign" &&
    evidence.settings?.node === "true" &&
    evidence.settings?.dasha_year_days === 365.25 &&
    (result.style ?? "standard") === (value.style ?? "standard") &&
    (result.follow_up ?? true) === (value.follow_up ?? true) &&
    typeof result.text === "string" &&
    result.text.trim().length > 0 &&
    result.text.length <= 16000 &&
    result.model_calls === 0 &&
    result.model_tokens === 0 &&
    typeof evidence.input_fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(evidence.input_fingerprint) &&
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
    result.intent === (value.intent ?? "overview")
  );
}

export function validReadingResult(result, value) {
  return result?.schema === "reviewed-reading-v2"
    ? validOutcomeResult(result, value)
    : validLegacyResult(result, value);
}

export function validateReadingInput(value, contractVersion = 1) {
  if (![1, 2].includes(contractVersion)) {
    throw new Error("Unsupported reading contract");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        !["dob", "tob", "place", "topic", "language", "intent", "style", "follow_up"].includes(key),
    ) ||
    !["career", "education", "marriage", "finance"].includes(value.topic) ||
    (contractVersion === 1 && value.topic === "finance") ||
    !["english", "hinglish"].includes(value.language ?? "english") ||
    !["overview", "timing"].includes(value.intent ?? "overview") ||
    (value.style !== undefined && !["brief", "standard", "detailed"].includes(value.style)) ||
    (value.follow_up !== undefined && typeof value.follow_up !== "boolean") ||
    (value.intent === "timing" &&
      contractVersion === 1 &&
      !["marriage", "career"].includes(value.topic))
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

export function calculateReading(value, run = execFile, contractVersion = 1) {
  return new Promise((resolve, reject) => {
    if (![1, 2].includes(contractVersion)) {
      return reject(new Error("Unsupported reading contract"));
    }
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
        "--reading-contract",
        String(contractVersion),
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
          if (
            !validReadingResult(result, value) ||
            result.schema !== `reviewed-reading-v${contractVersion}`
          ) {
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
      const header = req.headers?.["x-astro-reading-contract"];
      const contractVersion = header === "2" ? 2 : 1;
      try {
        if (header !== undefined && !["1", "2"].includes(header)) {
          throw new Error("Unsupported reading contract");
        }
        value = validate(JSON.parse(Buffer.concat(chunks).toString("utf8")), contractVersion);
      } catch {
        send(400, { error: "invalid_reading_request" });
        return;
      }
      try {
        send(200, await calculate(value, undefined, contractVersion));
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
