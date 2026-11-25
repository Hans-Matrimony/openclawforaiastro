import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { GUARDED_AGENTS } from "./runtime.mjs";
import { BUDGET_PREFIX, BUDGET_PROVIDERS } from "./provider-bridge.mjs";

export function configureRuntimeBudget(input) {
  const config = structuredClone(input);
  function bounded(ref) {
    if (typeof ref !== "string" || !ref.includes("/")) throw new Error("Missing guarded model reference");
    const split = ref.indexOf("/");
    const provider = ref.slice(0, split).replace(new RegExp(`^${BUDGET_PREFIX}`), "");
    if (!BUDGET_PROVIDERS.includes(provider)) throw new Error("Unverified guarded provider");
    const source = config.models?.providers?.[provider];
    if (!source) throw new Error("Missing guarded provider configuration");
    config.models.providers[BUDGET_PREFIX + provider] = structuredClone(source);
    return BUDGET_PREFIX + provider + ref.slice(split);
  }
  const defaults = config.agents?.defaults?.model;
  const agents = config.agents?.list ?? Object.entries(config.agents?.entries ?? {}).map(([id, agent]) => ({...agent,id}));
  for (const agent of agents) {
    if (!GUARDED_AGENTS.has(agent.id)) continue;
    const selected = agent.model ?? defaults;
    const primary = typeof selected === "string" ? selected : selected?.primary;
    const fallbacks = typeof selected === "object" && Array.isArray(selected.fallbacks)
      ? selected.fallbacks : defaults?.fallbacks ?? [];
    agent.model = { primary: bounded(primary), fallbacks: fallbacks.map(bounded) };
  }
  config.agents.entries = Object.fromEntries(agents.map(({id, ...agent}) => [id, agent]));
  if (agents.length > 1 && !agents.some(agent => agent.default === true)) config.agents.ownership = "explicit";
  delete config.agents.list;
  const heartbeat = config.agents.defaults?.heartbeat;
  if (heartbeat) {
    if (heartbeat.every !== "0m") throw new Error("Active heartbeat needs explicit automation migration");
    delete config.agents.defaults.heartbeat;
  }
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.env.VEDASTRO_DIRECT_ENVIRONMENT !== "development") throw new Error("Runtime migration is development-only");
  const filename = process.env.OPENCLAW_CONFIG_PATH;
  if (!filename) throw new Error("Missing config path");
  const config = configureRuntimeBudget(JSON.parse(fs.readFileSync(filename, "utf8")));
  fs.writeFileSync(filename, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}
