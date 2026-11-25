const OPENROUTER_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const DEEPSEEK_CHAT = "https://api.deepseek.com/chat/completions";

// Adapt the legacy OpenRouter-shaped requests at the shared HTTP boundary.
// Chart, memory and retrieval requests must keep their original transport.
export function directModelOptions(env = process.env, fetchImpl = fetch) {
  const provider = env.ASTROFRIEND_DIRECT_MODEL_PROVIDER || "openrouter";
  if (provider === "openrouter") return { env, fetchImpl };
  if (provider !== "deepseek") throw new Error("Unknown direct model provider");
  if (!env.DEEPSEEK_API_KEY?.trim()) throw new Error("DeepSeek model not configured");
  const model = env.ASTROFRIEND_DEEPSEEK_MODEL || "deepseek-v4-flash";
  if (!["deepseek-v4-flash", "deepseek-flash"].includes(model)) {
    throw new Error("Unsupported direct DeepSeek model");
  }
  const modelEnv = {
    ...env,
    // The existing engine checks this legacy field for provider availability.
    // A non-secret marker avoids copying the DeepSeek key to unrelated callers.
    OPENROUTER_API_KEY: "direct-deepseek-provider",
    VEDASTRO_DIRECT_MODEL: model,
    ASTROFRIEND_CONVERSATION_MODEL: model,
    ASTROFRIEND_CONVERSATION_REASONING_EFFORT: "",
    VEDASTRO_DIRECT_GENERATION_MODE: "source",
    VEDASTRO_DIRECT_SOURCE_PROVIDER: "",
  };
  return {
    env: modelEnv,
    fetchImpl: (url, options) => {
      if (String(url) !== OPENROUTER_CHAT) return fetchImpl(url, options);
      const body = JSON.parse(options.body);
      body.model = model;
      body.thinking = { type: "disabled" };
      for (const key of ["provider", "reasoning", "reasoning_effort", "seed", "top_k"]) {
        delete body[key];
      }
      const headers = new Headers(options.headers);
      headers.set("Authorization", "Bearer " + env.DEEPSEEK_API_KEY);
      return fetchImpl(DEEPSEEK_CHAT, {
        ...options,
        redirect: "error",
        headers,
        body: JSON.stringify(body),
      });
    },
  };
}
