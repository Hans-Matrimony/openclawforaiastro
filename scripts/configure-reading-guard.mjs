import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "astrofriend-reading-";
const targets = new Set(["astrologer", "astrologer_preview", "astrologer_preview_fast"]);
const envKeys = { zai: ["ZAI_API_KEY", "ZHIPU_API_KEY"] };

export function configureReadingGuard(
  config,
  { enabled = true, env = process.env, app = "/app" } = {},
) {
  const cfg = structuredClone(config);
  const originalRef = (ref) =>
    typeof ref === "string" && ref.startsWith(PREFIX) ? ref.slice(PREFIX.length) : ref;
  cfg.models ??= {};
  cfg.models.providers ??= {};
  const route = (ref) => {
    ref = originalRef(ref);
    if (!enabled || !ref) return ref;
    const slash = ref.indexOf("/");
    if (slash < 1) throw new Error("Reading guard requires explicit provider/model references");
    const provider = ref.slice(0, slash);
    const source = cfg.models.providers[provider];
    if (!source) throw new Error(`Reading guard provider config missing: ${provider}`);
    const alias = PREFIX + provider;
    cfg.models.providers[alias] = structuredClone(source);
    if (!source.apiKey) {
      const key = (envKeys[provider] ?? []).find((key) => env[key]);
      if (key) cfg.models.providers[alias].apiKey = "${" + key + "}";
      // Auth-profile-only configurations require an explicit config key mapping.
      else
        throw new Error(
          `Reading guard needs a configured API key or environment key for ${provider}`,
        );
    }
    const next = PREFIX + ref;
    const modelDefaults = cfg.agents?.defaults?.models;
    if (modelDefaults?.[ref]) modelDefaults[next] = structuredClone(modelDefaults[ref]);
    return next;
  };
  for (const agent of cfg.agents?.list ?? []) {
    if (!targets.has(agent.id)) continue;
    const model = agent.model ?? cfg.agents?.defaults?.model;
    if (typeof model === "string") agent.model = route(model);
    else if (model)
      agent.model = {
        ...model,
        primary: route(model.primary),
        ...(model.fallbacks ? { fallbacks: model.fallbacks.map(route) } : {}),
      };
  }
  cfg.plugins ??= {};
  cfg.plugins.entries ??= {};
  cfg.plugins.entries["astrologer-reading"] = { enabled };
  cfg.plugins.load ??= {};
  cfg.plugins.load.paths = [
    ...new Set([
      ...(cfg.plugins.load.paths ?? []),
      path.posix.join(app, "extensions/astrologer-reading"),
    ]),
  ];
  if (cfg.plugins.allow && !cfg.plugins.allow.includes("astrologer-reading")) {
    cfg.plugins.allow.push("astrologer-reading");
  }
  if (!enabled) {
    for (const key of Object.keys(cfg.models.providers))
      if (key.startsWith(PREFIX)) delete cfg.models.providers[key];
    for (const key of Object.keys(cfg.agents?.defaults?.models ?? {}))
      if (key.startsWith(PREFIX)) delete cfg.agents.defaults.models[key];
  }
  return cfg;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: configure-reading-guard.mjs <config-path>");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  const next = configureReadingGuard(config, {
    enabled: process.env.ASTROFRIEND_READING_STYLE_GUARD !== "0",
    app: process.env.OPENCLAW_APP_DIR || "/app",
  });
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  console.log(
    `[astrologer-reading] configuration ${process.env.ASTROFRIEND_READING_STYLE_GUARD === "0" ? "disabled" : "enabled"}`,
  );
}
