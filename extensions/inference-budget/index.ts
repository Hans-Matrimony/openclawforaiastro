import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { randomUUID } from "node:crypto";
import { budgetDiagnostic, getBudgetRuntime } from "./runtime.mjs";

export default {
  id: "inference-budget",
  register(api: OpenClawPluginApi) {
    const runtime = getBudgetRuntime();
    runtime.setDiagnosticReporter((event: Record<string, string | number | boolean>) => {
      const name =
        event.kind === "session_binding_mismatch"
          ? "inference-budget-binding"
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
