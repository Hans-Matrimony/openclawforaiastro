import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createReadingHandler, validateReadingInput } from "./route.mjs";

export function validateTopicInput(value) {
  if (
    !value ||
    !["career", "education", "marriage", "relationship", "finance"].includes(value.topic) ||
    !["overview", "timing", "contact", "detail", "brief"].includes(value.intent ?? "overview") ||
    (value.intent === "contact" && value.topic !== "relationship")
  ) {
    throw new Error("Invalid topic request");
  }
  // Reuse the strict birth-field/control-character/key/language checks.
  validateReadingInput({ ...value, topic: "marriage", intent: "overview" });
  return value;
}

export function validTopicResult(result, value) {
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
  const e = result?.evidence;
  return (
    result?.schema === "reviewed-topic-v1" &&
    typeof result.text === "string" &&
    result.text.length > 0 &&
    result.text.length <= 16000 &&
    result.model_calls === 0 &&
    result.model_tokens === 0 &&
    result.language === request.language &&
    result.intent === request.intent &&
    result.request_fingerprint === createHash("sha256").update(canonical).digest("hex") &&
    e?.schema === "natal-topic-assessment-v1" &&
    e.rules_revision === "reviewed-natal-topic-themes-v1" &&
    e.topic === request.topic &&
    e.assessment?.status === "natal_themes_only" &&
    e.assessment.event_timing === "not_evaluated" &&
    Array.isArray(e.assessment.windows) &&
    e.assessment.windows.length === 0 &&
    e.positions &&
    Object.keys(e.positions).length === 9
  );
}

export function calculateTopic(value, run = execFile) {
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
        "--verified-topic",
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
          if (!validTopicResult(result, value)) {
            throw new Error("Invalid topic result");
          }
          resolve(result);
        } catch {
          reject(new Error("Topic calculation unavailable"));
        }
      },
    );
  });
}

export const createTopicHandler = (calculate = calculateTopic) =>
  createReadingHandler(calculate, validateTopicInput);
