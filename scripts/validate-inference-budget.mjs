import fs from "node:fs";
import { createRequire, findPackageJSON } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AGENTS = new Set([
  "astrologer",
  "astrologer_pwa",
  "reply_repair",
  "provider_selector",
  "provider_renderer",
  "astrologer_preview",
  "astrologer_preview_fast",
]);

export function validateBudgetShim(source) {
  // Both forms import exactly the same reviewed extension; formatters may
  // change quotes. Reject alternate paths and any additional executable code.
  const expected = "export { default } from '../../../runtime/inference-budget/pi-extension.mjs';";
  if (![expected, expected.replaceAll("'", '"')].includes(source.trim())) {
    throw new Error("Missing or mismatched inference budget workspace extension");
  }
}

export function validateBudgetConfig(config) {
  const plugins = config.plugins;
  if (
    plugins?.enabled === false ||
    !plugins?.entries?.["inference-budget"]?.enabled ||
    plugins.deny?.includes("inference-budget") ||
    (plugins.allow?.length && !plugins.allow.includes("inference-budget"))
  ) {
    throw new Error("Inference budget plugin must be enabled and allowed");
  }
  if (
    !plugins.load?.paths?.some(
      (value) =>
        typeof value === "string" &&
        path.basename(value.replaceAll("\\", "/")) === "inference-budget",
    )
  ) {
    throw new Error("Inference budget plugin load path is missing");
  }
  for (const agent of config.agents?.list ?? Object.entries(config.agents?.entries ?? {}).map(([id, agent]) => ({...agent,id}))) {
    if (!AGENTS.has(agent.id)) {
      continue;
    }
    const defaults = config.agents?.defaults?.model;
    const selection = agent.model;
    const primary = (value) => (typeof value === "string" ? value.trim() : value?.primary?.trim());
    // A primary-only agent override still inherits the default fallback list.
    const fallbacks =
      selection && typeof selection === "object" && Array.isArray(selection.fallbacks)
        ? selection.fallbacks
        : (defaults?.fallbacks ?? []);
    const models = [primary(selection) || primary(defaults), ...fallbacks];
    for (const ref of models) {
      if (typeof ref !== "string" || !ref.includes("/")) {
        throw new Error("Missing bounded agent model");
      }
      const separator = ref.indexOf("/");
      const provider = config.models?.providers?.[ref.slice(0, separator)];
      const model = provider?.models?.find((value) => value.id === ref.slice(separator + 1));
      // These are the production HTTP transports verified by the release tests.
      // OpenAI Responses/WebSocket paths need separate coverage before enabling.
      if (
        !provider ||
        !model ||
        !["openai-completions", "google-generative-ai"].includes(model.api ?? provider.api)
      ) {
        throw new Error("Bounded agent uses an unverified model transport");
      }
    }
  }
}

export function installedSdkEntry(runtimePackage, packageName) {
  const manifest = findPackageJSON(packageName, pathToFileURL(runtimePackage).href);
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  if (pkg.version !== "0.63.1" || typeof pkg.exports?.["."]?.import !== "string") {
    throw new Error("Unverified inference SDK version or entry point");
  }
  return path.resolve(path.dirname(manifest), pkg.exports["."].import);
}

export async function validateInstalledBudget(runtimePackage, stateDir, config) {
  validateBudgetConfig(config);
  const runtimeVersion = JSON.parse(fs.readFileSync(runtimePackage, "utf8")).version;
  if (["2026.11.9", "2026.11.10"].includes(runtimeVersion)) {
    if (process.env.VEDASTRO_DIRECT_ENVIRONMENT !== "development" ||
        process.env.ASTROFRIEND_OPENCLAW_RUNTIME !== runtimeVersion) {
      throw new Error("New budget runtime is development-only");
    }
    for (const agent of config.agents?.list ?? Object.entries(config.agents?.entries ?? {}).map(([id, agent]) => ({...agent,id}))) {
      if (!AGENTS.has(agent.id)) continue;
      if (!agent.model || typeof agent.model !== "object" ||
          !Array.isArray(agent.model.fallbacks) ||
          [agent.model.primary, ...agent.model.fallbacks].some(ref =>
            !/^astro-budget-(?:zai|openai|deepseek|groq|google|openrouter)\//.test(ref))) {
        throw new Error("Guarded agents must use bounded provider aliases");
      }
    }
    const pluginDir = config.plugins.load.paths.find(value => {
      try { return JSON.parse(fs.readFileSync(path.join(value, "openclaw.plugin.json"), "utf8")).id === "inference-budget"; }
      catch { return false; }
    });
    if (!pluginDir) throw new Error("Missing inference budget plugin");
    const sdkManifest = findPackageJSON("@openclaw/ai", pathToFileURL(runtimePackage).href);
    if (JSON.parse(fs.readFileSync(sdkManifest, "utf8")).version !== runtimeVersion) {
      throw new Error("Budget transport SDK must match the verified runtime");
    }
    const sdk = createRequire(runtimePackage)("@openclaw/ai");
    if (!sdk.supportsScopedAiTransportHosts()) throw new Error("Missing scoped transport support");
    const { registerBudgetProviders } = await import(pathToFileURL(path.join(pluginDir, "provider-bridge.mjs")).href);
    const { createBudgetRuntime } = await import(pathToFileURL(path.join(pluginDir, "runtime.mjs")).href);
    let sends = 0;
    const guard = createBudgetRuntime({ fetchImpl: async () => { sends++; return new Response("{}"); } });
    guard.setDiagnosticReporter(() => {});
    const providers = [];
    registerBudgetProviders({ registerProvider: provider => providers.push(provider) }, guard);
    if (providers.length !== 6) throw new Error("Incomplete budget provider registration");
    const stream = providers[0].wrapStreamFn({ streamFn: () => {
      const result = guard.transport.fetch("https://budget-preflight.invalid", {
        method: "POST", body: JSON.stringify({ messages: [], max_tokens: 10 }),
      }).then(response => ({ role: "assistant", content: [], stopReason: "error", status: response.status }));
      return { result: () => result, async *[Symbol.asyncIterator]() {} };
    } })({ api: "openai-completions" }, {}, {});
    const result = await stream.result();
    if (sends || result.status !== 400) throw new Error("Unowned provider request was not blocked");
    return;
  }
  if (runtimeVersion !== "2026.3.28") {
    throw new Error("Inference budget requires the verified OpenClaw runtime");
  }
  installedSdkEntry(runtimePackage, "@mariozechner/pi-ai");
  const sdkEntry = installedSdkEntry(runtimePackage, "@mariozechner/pi-coding-agent");
  const { DefaultResourceLoader } = await import(pathToFileURL(sdkEntry).href);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "af-budget-preflight-"));
  if (
    path.dirname(directory) !== os.tmpdir() ||
    !path.basename(directory).startsWith("af-budget-preflight-")
  ) {
    throw new Error("Unexpected preflight temporary directory");
  }
  try {
    const loader = new DefaultResourceLoader({
      cwd: directory,
      agentDir: directory,
      noExtensions: true,
      additionalExtensionPaths: [path.join(stateDir, "runtime/inference-budget/pi-extension.mjs")],
    });
    await loader.reload();
    const loaded = loader.getExtensions();
    if (
      loaded.errors.length ||
      loaded.extensions.length !== 1 ||
      !globalThis[Symbol.for("astrofriend.inference-budget.v1")]
    ) {
      throw new Error("Inference budget extension failed startup validation");
    }
    for (const agent of config.agents?.list ?? []) {
      if (!AGENTS.has(agent.id)) {
        continue;
      }
      const shim = path.join(agent.workspace, ".pi/extensions/astrofriend-budget.ts");
      validateBudgetShim(fs.readFileSync(shim, "utf8"));
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await validateInstalledBudget(
    path.resolve(process.argv[2]),
    process.env.OPENCLAW_STATE_DIR || "/app/.openclaw",
    JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH || "/app/openclaw.json", "utf8")),
  );
  console.log("[startup] Inference budget runtime and workspace extensions verified");
}
