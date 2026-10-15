import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createReadingHandler } from "../reviewed-reading/route.mjs";

const keys = [
  "dob",
  "tob",
  "place",
  "topic",
  "language",
  "subject_key",
  "profile_revision",
  "time_precision",
];

export function reservedSubjects(config) {
  // Existing Tarot binding identities come from trusted gateway configuration,
  // not a client-supplied mode, assistant text or duplicated phone-number list.
  return new Set(
    (config?.bindings ?? [])
      .filter((b) => b.agentId === "tarot_reader")
      .map((b) => String(b.match?.peer?.id ?? "").replace(/\D/g, ""))
      .filter(Boolean)
      .map((id) => createHash("sha256").update(id).digest("hex")),
  );
}

export function validateEvidenceRequest(value, reserved = new Set()) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![keys.length, keys.length + 1].includes(Object.keys(value).length) ||
    Object.keys(value).some((key) => !keys.includes(key) && key !== "scope") ||
    keys.some((k) => !Object.hasOwn(value, k)) ||
    !["career", "education", "relationship", "marriage", "finance"].includes(value.topic) ||
    (Object.hasOwn(value, "scope") &&
      !["overview", "why", "simple", "detail", "periods", "chart", "transits", "timing_context", "marriage_why", "marriage_simple", "marriage_detail"].includes(
        value.scope,
      )) ||
    !["english", "hinglish"].includes(value.language) ||
    value.time_precision !== "exact" ||
    reserved.has(value.subject_key)
  ) {
    throw new Error("Unsupported request");
  }
  if (["marriage_why", "marriage_simple", "marriage_detail"].includes(value.scope) && value.topic !== "marriage") {
    throw new Error("Unsupported marriage scope");
  }
  for (const k of ["subject_key", "profile_revision"]) {
    if (typeof value[k] !== "string" || !/^[a-f0-9]{64}$/u.test(value[k])) {
      throw new Error("Invalid binding");
    }
  }
  for (const k of ["dob", "tob", "place"]) {
    if (
      typeof value[k] !== "string" ||
      !value[k].trim() ||
      value[k].length > 160 ||
      Array.from(value[k]).some((char) => char.codePointAt(0) < 32)
    ) {
      throw new Error("Invalid birth field");
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.dob) || !/^\d{2}:\d{2}(?::\d{2})?$/u.test(value.tob)) {
    throw new Error("Unresolved time");
  }
  return value;
}

export function calculateEvidence(value, run = execFile) {
  return new Promise((resolve, reject) => {
    const directory =
      process.env.ASTROFRIEND_RESPONSE_SKILL_DIR || "/app/astrology-response/kundli";
    const child = run(
      process.env.ASTROFRIEND_RESPONSE_PYTHON || "python3",
      [path.join(directory, "response_evidence.py")],
      {
        timeout: 8_000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: "1",
          // Keep legacy process settings intact; the isolated calculator owns
          // its ephemeris path and the cache manifest must describe that path.
          SE_EPHE_PATH: "",
          KUNDLI_NATAL_CACHE_PATH: process.env.ASTROFRIEND_RESPONSE_NATAL_CACHE_PATH || "",
        },
      },
      (error, stdout) => {
        try {
          if (error) {
            throw error;
          }
          const result = JSON.parse(stdout);
          if (
            result.schema !== "astrology-evidence-v1" ||
            result.model_calls !== 0 ||
            result.model_tokens !== 0 ||
            result.subject_key !== value.subject_key ||
            result.profile_revision !== value.profile_revision
          ) {
            throw new Error("Invalid evidence");
          }
          resolve(result);
        } catch {
          reject(new Error("Evidence unavailable"));
        }
      },
    );
    // Birth data is JSON on stdin, never a shell argument or log message.
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify(value));
  });
}

export const createEvidenceHandler = (calculate = calculateEvidence, reserved = new Set()) =>
  createReadingHandler(calculate, (value) => validateEvidenceRequest(value, reserved));
