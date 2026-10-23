import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { directReleaseEnabled } from "../extensions/reviewed-reading/direct/release.mjs";

export function configureDirectAnswer(config, env = process.env) {
  const next = structuredClone(config);
  const pluginPath = "/app/extensions/direct-answer";
  const enabled = directReleaseEnabled(env);
  if (enabled) {
    const host =
      env.ASTROFRIEND_DIRECT_MODE !== undefined
        ? env.ASTROFRIEND_DIRECT_MEM0_HOST
        : env.VEDASTRO_DIRECT_MEM0_DEV_HOST;
    const url = new URL(env.MEM0_URL);
    if (
      !host ||
      url.hostname !== host ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      !env.MEM0_API_KEY ||
      !env.OPENROUTER_API_KEY ||
      (env.ASTROFRIEND_DIRECT_ENVIRONMENT === "production" && url.protocol !== "https:")
    ) {
      throw new Error("Direct-answer pilot configuration is incomplete");
    }
    next.plugins ??= {};
    next.plugins.load ??= {};
    next.plugins.load.paths = [...new Set([...(next.plugins.load.paths || []), pluginPath])];
    next.plugins.entries ??= {};
    next.plugins.entries["direct-answer"] = {
      ...next.plugins.entries["direct-answer"],
      enabled: true,
    };
  } else {
    if (next.plugins?.load?.paths)
      next.plugins.load.paths = next.plugins.load.paths.filter((p) => p !== pluginPath);
    if (next.plugins?.entries?.["direct-answer"])
      next.plugins.entries["direct-answer"].enabled = false;
  }
  return next;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2];
  const original = JSON.parse(fs.readFileSync(path, "utf8"));
  const next = configureDirectAnswer(original);
  if (JSON.stringify(next) !== JSON.stringify(original))
    fs.writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
}
