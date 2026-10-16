import { execFile } from "node:child_process";
import path from "node:path";
import { createReadingHandler } from "./route.mjs";

export function summaryEnabled(env = process.env) {
  return (
    env.VEDASTRO_SUMMARY_DEV_ENABLED === "1" && env.VEDASTRO_SUMMARY_ENVIRONMENT === "development"
  );
}

export function validateSummaryInput(value) {
  const keys = ["location_name", "birth_date", "birth_time", "query_text"];
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => typeof value[key] !== "string" || !value[key].trim()) ||
    value.location_name.length < 2 ||
    value.location_name.length > 160 ||
    value.query_text.length > 2000 ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(value.birth_date) ||
    !/^\d{2}:\d{2}$/.test(value.birth_time)
  ) {
    throw new Error("Invalid summary request");
  }
  return value;
}

export function calculateSummary(value, run = execFile) {
  return new Promise((resolve, reject) => {
    if (!summaryEnabled()) {
      return reject(new Error("Summary disabled"));
    }
    const child = run(
      "python3",
      [
        path.join(
          process.env.OPENCLAW_STATE_DIR || "/app/.openclaw",
          "skills/vedastro/summary_client.py",
        ),
      ],
      { timeout: 30_000, maxBuffer: 128 * 1024, windowsHide: true },
      (error, stdout) => {
        try {
          if (error) {
            throw error;
          }
          const result = JSON.parse(stdout);
          if (
            result?.provider !== "vedastro-hosted-subagent" ||
            result.locally_verified !== false ||
            result.calculation_settings_verified !== false ||
            result.website_answer_parity_verified !== false ||
            result.interpretation?.query !== value.query_text ||
            typeof result.interpretation.summary !== "string" ||
            !result.interpretation.summary.trim() ||
            result.interpretation.summary.length > 8000 ||
            !Array.isArray(result.interpretation.drivers)
          ) {
            throw new Error("Invalid summary");
          }
          resolve(result);
        } catch {
          reject(new Error("Provider summary unavailable"));
        }
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(value));
  });
}

export function createSummaryHandler(
  calculate = calculateSummary,
  { env = process.env, ...options } = {},
) {
  const handler = createReadingHandler(calculate, {
    ...options,
    validate: validateSummaryInput,
    maxBody: 8192,
    failureStatus: 503,
    failureCode: "provider_summary_unavailable",
  });
  return async (req, res) => {
    if (!summaryEnabled(env)) {
      res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    return handler(req, res);
  };
}
