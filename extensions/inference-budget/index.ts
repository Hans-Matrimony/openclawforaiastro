import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createManagedBudgetScope } from "./managed-transport.mjs";
import { budgetDiagnostic, getBudgetRuntime } from "./runtime.mjs";
import { registerBudgetProviders } from "./provider-bridge.mjs";

export default {
  id: "inference-budget",
  register(api: OpenClawPluginApi) {
    const runtime = getBudgetRuntime();
    if (["2026.11.9", "2026.11.10"].includes(process.env.ASTROFRIEND_OPENCLAW_RUNTIME ?? "")) {
      if (process.env.VEDASTRO_DIRECT_ENVIRONMENT !== "development") {
        throw new Error("New runtime budget bridge is development-only");
      }
      // Resolve from the public host SDK, avoiding a second transport runtime
      // inside the plugin's isolated dependency snapshot.
      const pluginRequire = createRequire(import.meta.url);
      const sdk = createRequire(pluginRequire.resolve("openclaw/plugin-sdk/core"))("@openclaw/ai");
      registerBudgetProviders(api, runtime, createManagedBudgetScope(sdk));
      // Modern dispatch schedules this hook asynchronously. The provider guard
      // waits for this exact call ID before sending an otherwise unowned stream.
      api.on("model_call_started", (event, context) => {
        runtime.bindCall({ ...context, callId: event.callId, runId: event.runId,
          sessionId: event.sessionId ?? context.sessionId });
      });
    }
    runtime.setDiagnosticReporter((event: Record<string, string | number | boolean>) => {
      const name =
        event.kind === "session_binding_mismatch"
          ? "inference-budget-binding"
          : event.kind === "provider_completion"
            ? "provider-completion"
            : "inference-budget-stop";
      api.logger.info(`[${name}] ${JSON.stringify(event)}`);
    });
    api.on("before_model_resolve", (event, context) => {
      runtime.bind(context, event.prompt);
    });
    api.on("llm_input", (event, context) => {
      runtime.bind({ ...context, runId: event.runId, sessionId: event.sessionId }, event.prompt);
    });
    api.on("before_compaction", (_event, context) => {
      // Manual /compact has agentId/sessionId but no runId. Native automatic
      // compaction only supplies sessionKey and keeps the existing chat budget.
      if (context.sessionId && !context.runId) {
        runtime.bind({ ...context, runId: `manual-compaction:${randomUUID()}` });
      }
    });
    api.on("llm_output", (event) => {
      const budget = runtime.forSession(event.sessionId);
      if (budget) {
        api.logger.info(
          `[inference-budget] attempts=${budget.attempts} requestBytes=${budget.bytes} reservedOutputTokens=${budget.outputTokens} blocked=${budget.blocked} reason=${budget.reason ?? "none"} runTag=${budgetDiagnostic(budget, event.sessionId).run_tag} sessionTag=${budgetDiagnostic(budget, event.sessionId).session_tag} runtimeTag=${runtime.runtimeTag}`,
        );
      }
    });
  },
};
