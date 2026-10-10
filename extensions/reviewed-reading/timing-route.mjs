import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createReadingHandler } from "./route.mjs";
import { validateTopicInput } from "./topic-route.mjs";

export function validateTimingInput(value) {
  if (value?.topic === "separation") {
    if (!["overview", "timing", "detail", "brief"].includes(value.intent ?? "overview")) {
      throw new Error("Invalid separation intent");
    }
    validateTopicInput({ ...value, topic: "marriage" });
    return value;
  }
  return validateTopicInput(value);
}

export function validTimingResult(result, value) {
  const request = Object.fromEntries(
    ["dob", "intent", "language", "place", "tob", "topic"].map((key) => [
      key,
      value[key] ?? (key === "intent" ? "overview" : "english"),
    ]),
  );
  const canonical = JSON.stringify(request).replace(
    /[\u0080-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return (
    result?.schema === "reviewed-timing-v1" &&
    typeof result.text === "string" &&
    result.text.length > 0 &&
    result.text.length <= 16000 &&
    result.model_calls === 0 &&
    result.model_tokens === 0 &&
    result.language === request.language &&
    result.intent === request.intent &&
    result.request_fingerprint === createHash("sha256").update(canonical).digest("hex") &&
    result.evidence?.schema === "timing-evidence-v1" &&
    result.evidence.rules_revision === "combined-timing-screen-v1" &&
    result.evidence.topic === request.topic &&
    result.assessment?.interpretation === "traditional_screen_not_calibrated" &&
    result.assessment?.legal_finalization === "not_predictable" &&
    result.assessment?.private_actions === "not_predictable" &&
    result.assessment?.shadbala === "not_computed" &&
    result.evidence.transits?.length === 105
  );
}

export function calculateTiming(value, run = execFile) {
  return new Promise((resolve, reject) => {
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
        "--timing-topic",
        value.topic,
        "--reading-language",
        value.language ?? "english",
        "--topic-intent",
        value.intent ?? "overview",
      ],
      { timeout: 30_000, maxBuffer: 128 * 1024, windowsHide: true },
      (error, stdout) => {
        try {
          if (error) {
            throw error;
          }
          const result = JSON.parse(stdout);
          if (!validTimingResult(result, value)) {
            throw new Error("Invalid timing result");
          }
          resolve(result);
        } catch {
          reject(new Error("Timing calculation unavailable"));
        }
      },
    );
  });
}

export const createTimingHandler = (calculate = calculateTiming) =>
  createReadingHandler(calculate, validateTimingInput);
