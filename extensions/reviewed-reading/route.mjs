import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const MAX_BODY = 4096;
const MAX_CONCURRENT = 2;

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
        ["VenusMarsPD2", "VenusJupiterPD2"].includes(window.rule_id) &&
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

export function validReadingResult(result, value) {
  if (value.topic === "separation") {
    const request = {
      dob: value.dob,
      intent: value.intent ?? "overview",
      language: value.language ?? "english",
      place: value.place,
      tob: value.tob,
      topic: "separation",
    };
    const canonical = JSON.stringify(request).replace(
      /[\u0080-\uffff]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    const evidence = result?.evidence;
    return (
      result?.schema === "reviewed-separation-v1" &&
      typeof result.text === "string" &&
      result.text.trim().length > 0 &&
      result.text.length <= 16000 &&
      result.model_calls === 0 &&
      result.model_tokens === 0 &&
      result.request_fingerprint === createHash("sha256").update(canonical).digest("hex") &&
      result.language === request.language &&
      result.intent === request.intent &&
      evidence?.schema === "separation-assessment-v1" &&
      evidence.topic === "separation" &&
      evidence.rules_revision === "selected-separation-conditions-v1" &&
      /^[a-f0-9]{64}$/u.test(evidence.input_fingerprint ?? "") &&
      evidence.assessment?.event_timing === "not_established" &&
      evidence.assessment?.legal_finalization === "not_evaluated" &&
      Array.isArray(evidence.assessment?.windows) &&
      evidence.assessment.windows.length === 0 &&
      ["not_established", "strain_indication", "separation_indication"].includes(
        evidence.assessment?.status,
      ) &&
      evidence.positions &&
      Object.keys(evidence.positions).length === 9
    );
  }
  const evidence = result?.evidence;
  const legacy =
    result?.schema === "reviewed-reading-v1" &&
    evidence?.schema === "topic-reading-v1" &&
    evidence.rules_revision === "reviewed-placements-v1" &&
    evidence.period_interpretation_available === false;
  const current =
    result?.schema === "reviewed-reading-v2" &&
    evidence?.schema === "topic-reading-v2" &&
    evidence.rules_revision === "reviewed-outcomes-v2" &&
    typeof evidence.period_interpretation_available === "boolean" &&
    validPredictionAssessment(evidence.prediction_assessment, value.topic) &&
    evidence.period_interpretation_available ===
      (evidence.prediction_assessment.current_period.status !== "unsupported");
  return (
    (legacy || current) &&
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

export function validateReadingInput(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !["dob", "tob", "place", "topic", "language", "intent"].includes(key),
    ) ||
    !["career", "education", "marriage", "finance", "separation"].includes(value.topic) ||
    !["english", "hinglish"].includes(value.language ?? "english") ||
    !["overview", "timing"].includes(value.intent ?? "overview")
  ) {
    throw new Error("Invalid request");
  }
  for (const key of ["dob", "tob", "place"]) {
    if (
      typeof value[key] !== "string" ||
      !value[key].trim() ||
      value[key].length > 160 ||
      Array.from(value[key]).some((character) => character.charCodeAt(0) < 32)
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
        "--reading-language",
        value.language ?? "english",
        "--reading-intent",
        value.intent ?? "overview",
        "--reading-contract",
        String(contractVersion),
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
            (value.topic !== "separation" &&
              result.schema !== `reviewed-reading-v${contractVersion}`)
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
  validate = validateReadingInput,
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
        if (size > MAX_BODY) {
          send(413, { error: "request_too_large" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      clearTimeout(timer);
      let value;
      const contractHeader = req.headers?.["x-astro-reading-contract"];
      const contractVersion = contractHeader === "2" ? 2 : 1;
      try {
        if (contractHeader !== undefined && !["1", "2"].includes(contractHeader)) {
          throw new Error("Unsupported reading contract");
        }
        value = validate(JSON.parse(Buffer.concat(chunks).toString("utf8")));
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
