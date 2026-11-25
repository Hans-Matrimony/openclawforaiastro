import { ModelBudget, boundPayload } from "../../inference-budget/transport.mjs";

const providers = [
  { id: "deepseek", key: "DEEPSEEK_API_KEY", model: "deepseek-v4-flash", url: "https://api.deepseek.com/chat/completions" },
  { id: "groq", key: "GROQ_API_KEY", model: "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1/chat/completions" },
  { id: "openai", key: "OPENAI_API_KEY", model: "gpt-4o-mini", url: "https://api.openai.com/v1/chat/completions" },
];
const retryable = new Set([401, 402, 404, 408, 429, 500, 502, 503, 504]);

function jsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch { return false; }
}

async function boundedResponse(response) {
  if (!response.body) throw new Error("Unusable model response");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new Error("Unusable model response");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

// One answer owns one allowance, including failed attempts across providers.
// Tools run outside this adapter, so failover never replays tool side effects.
export function devModelFailover(env = process.env, fetchImpl = fetch, {
  budget = new ModelBudget(), attemptTimeoutMs = 15000, onAttempt = () => {},
} = {}) {
  if (env.ASTROFRIEND_DEV_MODEL_FAILOVER !== "1") return { env, fetchImpl };
  if (env.VEDASTRO_DIRECT_ENVIRONMENT !== "development") {
    throw new Error("Model failover is development-only");
  }
  const chain = providers.filter(p => env[p.key]?.trim());
  if (!chain.length) throw new Error("No direct model credentials configured");
  let preferred = 0;
  return {
    env: { ...env, OPENROUTER_API_KEY: "direct-provider-configured",
      VEDASTRO_DIRECT_MODEL: chain[0].model,
      VEDASTRO_DIRECT_GENERATION_MODE: !env.VEDASTRO_DIRECT_GENERATION_MODE || env.VEDASTRO_DIRECT_GENERATION_MODE === "stable"
        ? "direct-failover" : env.VEDASTRO_DIRECT_GENERATION_MODE },
    fetchImpl: async (url, options) => {
      if (String(url) !== "https://openrouter.ai/api/v1/chat/completions") return fetchImpl(url, options);
      const original = JSON.parse(options.body);
      if (original.stream) throw new Error("Failover requires a buffered reply");
      for (let index = preferred; index < chain.length; index++) {
        options.signal?.throwIfAborted();
        const provider = chain[index];
        const body = { ...original, model: provider.model };
        for (const key of ["provider", "reasoning", "reasoning_effort", "seed", "top_k"]) delete body[key];
        if (provider.id === "deepseek") body.thinking = { type: "disabled" };
        else delete body.thinking;
        const payload = boundPayload(JSON.stringify(body), "openai-completions", budget);
        const timeout = AbortSignal.timeout(Math.max(1, Math.min(attemptTimeoutMs, Math.ceil(budget.deadline - budget.now()))));
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        const headers = new Headers(options.headers);
        headers.set("Authorization", "Bearer " + env[provider.key]);
        onAttempt({ provider: provider.id, attempt: budget.attempts });
        let response;
        try {
          response = await fetchImpl(provider.url, { ...options, headers, body: payload, redirect: "error", signal });
          if (!response.ok) {
            if (!retryable.has(response.status) || index === chain.length - 1) return response;
            await response.body?.cancel();
            preferred = index + 1;
            continue;
          }
          const text = await boundedResponse(response);
          let result;
          try { result = JSON.parse(text); } catch { throw new Error("Unusable model response"); }
          const choice = result.choices?.[0];
          // A refusal is a valid response, not permission to evade another model's policy.
          if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
            return new Response(text, { status: response.status, headers: response.headers });
          }
          const calls = choice?.message?.tool_calls;
          const validTools = choice?.finish_reason === "tool_calls" && Array.isArray(calls) && calls.length > 0 &&
            calls.every(call => call.id && call.type === "function" && call.function?.name &&
              typeof call.function.arguments === "string" && jsonObject(call.function.arguments));
          const validText = choice?.finish_reason === "stop" && typeof choice.message?.content === "string" && choice.message.content.trim() &&
            (original.response_format?.type !== "json_object" || jsonObject(choice.message.content));
          if (!validTools && !validText) throw new Error("Unusable model response");
          preferred = index;
          result.provider = provider.id;
          result.model ??= provider.model;
          return new Response(JSON.stringify(result), { status: response.status, headers: { "Content-Type": "application/json" } });
        } catch (error) {
          options.signal?.throwIfAborted();
          if (budget.now() >= budget.deadline) budget.stop("deadline");
          const transient = error?.message === "Unusable model response" || error?.name === "TimeoutError" || error instanceof TypeError;
          if (!transient || index === chain.length - 1) throw error;
          preferred = index + 1;
        }
      }
      throw new Error("No model response available");
    },
  };
}
