import { createReadingHandler } from "./direct-http.mjs";
import { directAnswer } from "./direct/agent.mjs";
import { directReleaseEnabled } from "./direct/release.mjs";

export const directEnabled = directReleaseEnabled;

export function validateDirectInput(value) {
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) =>
        ![
          "user_id",
          "query",
          "history",
          "birth",
          "language",
          "user_gender",
          "user_name",
          "quota_context",
        ].includes(k),
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
    (value.user_name !== undefined &&
      (typeof value.user_name !== "string" || value.user_name.length > 80 ||
        !/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(value.user_name))) ||
    (value.quota_context !== undefined &&
      (typeof value.quota_context !== "string" || value.quota_context.length > 2048)) ||
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
  const handler = createReadingHandler(async (value) => {
    try {
      return await calculate(value, { env });
    } catch (error) {
      // Fixed operational categories only; no user data or upstream response bodies.
      const code = /^model_http_[45][0-9]{2}$/.test(error?.code ?? "")
        ? error.code : "generation_failed";
      console.warn("[direct-answer] " + code);
      throw error;
    }
  }, {
    ...options,
    validate: (value) => {
      validateDirectInput(value);
      if (!directEnabled(env, value.user_id)) {
        throw new Error("Caller outside pilot");
      }
      return value;
    },
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
