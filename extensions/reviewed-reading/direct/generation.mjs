import { SOURCE_CONFIG } from "./source-contract.mjs";

export function generationSettings(env = process.env) {
  const mode = env.VEDASTRO_DIRECT_GENERATION_MODE || "stable";
  if (mode === "source") {
    return { temperature: 0.7, provider: { require_parameters: true } };
  }
  if (mode !== "stable") {
    throw new Error("Unknown direct generation mode");
  }
  const model = env.VEDASTRO_DIRECT_MODEL || SOURCE_CONFIG.model;
  const endpoint =
    env.VEDASTRO_DIRECT_PROVIDER || (model === SOURCE_CONFIG.model ? "parasail/fp8" : "");
  const seed = Number(env.VEDASTRO_DIRECT_SEED ?? 42);
  if (
    !endpoint ||
    !/^[a-z0-9][a-z0-9_/-]*$/.test(endpoint) ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > 2147483647
  ) {
    throw new Error("Stable generation requires a seed-capable endpoint and valid seed");
  }
  return {
    temperature: 0,
    top_k: 1,
    top_p: 1,
    seed,
    provider: {
      require_parameters: true,
      order: [endpoint],
      only: [endpoint],
      allow_fallbacks: false,
    },
  };
}
