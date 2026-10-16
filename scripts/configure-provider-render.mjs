import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const agentIds = ["provider_selector", "provider_renderer"];
const modelId = "google/gemini-3.8-flash";

export function configureProviderRender(input, env = {}) {
  const config = structuredClone(input);
  const enabled =
    env.VEDASTRO_GROUPED_RENDER_DEV_ENABLED === "1" &&
    env.VEDASTRO_SUMMARY_DEV_ENABLED === "1" &&
    env.VEDASTRO_SUMMARY_ENVIRONMENT === "development";
  // Remove stale stage agents when a previously enabled deployment is disabled.
  config.agents.list = config.agents.list.filter((agent) => !agentIds.includes(agent.id));
  if (!enabled) {
    return config;
  }
  const provider = config.models?.providers?.openrouter;
  if (!provider || provider.api !== "openai-completions") {
    throw new Error("Provider renderer requires configured OpenRouter transport");
  }
  provider.models = provider.models.filter((model) => model.id !== modelId);
  provider.models.push({
    id: modelId,
    name: "Gemini 3.8 Flash provider rendering",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.825, output: 4.125, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 2048,
  });
  config.agents.defaults.models ??= {};
  config.agents.defaults.models[`openrouter/${modelId}`] = {
    params: { temperature: 0, maxTokens: 2048 },
  };
  for (const id of agentIds) {
    config.agents.list.push({
      id,
      name: id === "provider_selector" ? "Provider source selector" : "Provider reply renderer",
      workspace: `/app/.openclaw/workspace-${id.replaceAll("_", "-")}`,
      model: { primary: `openrouter/${modelId}`, fallbacks: [] },
      skills: [],
      tools: { deny: ["*"] },
    });
  }
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.env.OPENCLAW_CONFIG_PATH || "/app/openclaw.json";
  const config = configureProviderRender(JSON.parse(fs.readFileSync(file, "utf8")), process.env);
  const temporary = `${file}.provider-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) {
      fs.unlinkSync(temporary);
    }
  }
}
