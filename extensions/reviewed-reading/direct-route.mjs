import { createReadingHandler } from "./direct-http.mjs";
import { directAnswer } from "./direct/agent.mjs";
import { directReleaseEnabled } from "./direct/release.mjs";
import { formatDisplayReply } from "./direct/format-reply.mjs";

export const directEnabled = directReleaseEnabled;

// Fixed internal categories only. Never log arbitrary exception text, tool
// arguments, provider bodies, request contents or personal identifiers.
export function directFailureCategory(error) {
  if (/^model_http_[45][0-9]{2}$/.test(error?.code ?? "")) return error.code;
  if (["AbortError", "TimeoutError"].includes(error?.name)) return "generation_timeout";
  const category = ({
    "Direct context too large": "context_too_large",
    "Direct response too large": "model_response_too_large",
    "Missing direct reply": "model_reply_missing",
    "Incomplete direct reply": "model_reply_incomplete",
    "Direct call budget exhausted": "model_call_limit",
    "Direct tool loop did not converge": "tool_loop_limit",
    "Too many tool calls": "tool_call_limit",
    "Tool arguments must be an object": "invalid_tool_arguments",
    "Personal reading requires a successful chart tool": "chart_evidence_missing",
    "Timing reading requires the period schedule": "period_evidence_missing",
  })[error?.message];
  return typeof category === "string" ? category : "generation_failed";
}

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
      const result = await calculate(value, { env });
      // Enforce presentation at the HTTP boundary as well as the agent result.
      // This covers alternate/cached producers without touching chart evidence.
      return typeof result?.reply === "string"
        ? { ...result, reply: formatDisplayReply(result.reply) }
        : result;
    } catch (error) {
      // Fixed operational categories only; no user data or upstream response bodies.
      const code = directFailureCategory(error);
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
    // A no-generation invalid-input probe can confirm the running formatter.
    res.setHeader("X-Astrofriend-Reply-Format", formatDisplayReply(
      "house-7 ka score sirf kamzor hai, jo bahut kam hai.",
    ) === "7ve ghar ki majbooti ka sanket bahut kamzor hai." ? "house-strength-v3" : "legacy");
    return handler(req, res);
  };
}
