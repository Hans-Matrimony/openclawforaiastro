import { createReadingHandler } from "./route.mjs";
import { directAnswer } from "./direct/agent.mjs";

export const directEnabled = (env = process.env) =>
  env.VEDASTRO_DIRECT_DEV_ENABLED === "1" && env.VEDASTRO_DIRECT_ENVIRONMENT === "development";

export function validateDirectInput(value) {
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => !["user_id", "query", "history", "birth", "language", "user_gender"].includes(k),
    ) ||
    typeof value.user_id !== "string" ||
    !/^[A-Za-z0-9+:_-]{1,128}$/.test(value.user_id) ||
    typeof value.query !== "string" ||
    !value.query.trim() ||
    value.query.length > 4000 ||
    !Array.isArray(value.history) ||
    value.history.length > 20 ||
    value.history.some(
      (t) =>
        !t ||
        !["user", "assistant"].includes(t.role) ||
        typeof t.text !== "string" ||
        t.text.length > 8000 ||
        Object.keys(t).some((k) => !["role", "text"].includes(k)),
    ) ||
    (value.user_gender !== undefined &&
      !["male", "female", "unknown"].includes(value.user_gender)) ||
    typeof value.language !== "string" ||
    value.language.length > 32
  ) {
    throw new Error("Invalid direct request");
  }
  if (
    value.birth != null &&
    (typeof value.birth !== "object" ||
      Array.isArray(value.birth) ||
      Object.keys(value.birth).some((k) => !["date", "time", "location_name"].includes(k)) ||
      Object.values(value.birth).some((v) => typeof v !== "string" || v.length > 160))
  ) {
    throw new Error("Invalid direct birth context");
  }
  return value;
}

export function createDirectHandler(
  calculate = directAnswer,
  { env = process.env, ...options } = {},
) {
  const handler = createReadingHandler((value) => calculate(value, { env }), {
    ...options,
    validate: validateDirectInput,
    maxBody: 196608,
    failureStatus: 503,
    failureCode: "direct_answer_unavailable",
  });
  return (req, res) => {
    if (!directEnabled(env)) {
      res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    return handler(req, res);
  };
}
