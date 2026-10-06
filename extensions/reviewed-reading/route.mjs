import { execFile } from "node:child_process";
import path from "node:path";

const MAX_BODY = 4096;
const MAX_CONCURRENT = 2;

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
    evidence.rules_revision === "reviewed-placements-v1" &&
    evidence.settings?.ayanamsa === "LAHIRI" &&
    evidence.settings?.house_system === "whole_sign" &&
    evidence.settings?.engine === "pyswisseph" &&
    evidence.settings?.node === "true" &&
    evidence.settings?.dasha_year_days === 365.25 &&
    typeof evidence.input_fingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(evidence.input_fingerprint) &&
    evidence.period_interpretation_available === false &&
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
    !["career", "education", "marriage"].includes(value.topic) ||
    !["english", "hinglish"].includes(value.language ?? "english") ||
    !["overview", "timing"].includes(value.intent ?? "overview") ||
    (value.intent === "timing" && value.topic !== "marriage")
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
