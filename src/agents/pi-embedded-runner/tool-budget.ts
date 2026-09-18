import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "../pi-tools.types.js";

/**
 * Default cap on tool executions per agent run. The agent loop itself has no
 * turn limit, so a model that keeps emitting tool calls re-bills the full
 * context on every round trip. After the budget is exhausted, tool calls
 * return an instruction to answer with what is already in context.
 */
export const DEFAULT_TOOL_CALL_BUDGET = 12;

const BUDGET_EXHAUSTED_TEXT =
  "Tool call budget exhausted for this run. Do not call any more tools. " +
  "Reply to the user now using the information you already have.";

type ToolResult = Awaited<ReturnType<NonNullable<AnyAgentTool["execute"]>>>;

function budgetExhaustedResult(limit: number): ToolResult {
  return {
    content: [{ type: "text", text: BUDGET_EXHAUSTED_TEXT }],
    details: { toolBudgetExhausted: true, limit },
  } as ToolResult;
}

export function resolveToolCallBudget(config: OpenClawConfig | undefined): number {
  const raw = config?.agents?.defaults?.maxToolCallsPerRun;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TOOL_CALL_BUDGET;
}

/**
 * Wrap tool implementations so a single agent run cannot execute more than
 * `options.limit` tool calls. Once exhausted, every further call returns a
 * deterministic "stop calling tools" result instead of executing, which ends
 * runaway tool loops after one extra model round trip.
 */
export function withToolCallBudget(
  tools: AnyAgentTool[],
  options: { limit: number },
): AnyAgentTool[] {
  const limit = options.limit;
  if (!Number.isFinite(limit) || limit <= 0) {
    return tools;
  }
  let executed = 0;
  let warned = false;
  return tools.map((tool) => {
    const original = tool.execute;
    return {
      ...tool,
      execute: async (...args: unknown[]) => {
        executed += 1;
        if (executed > limit) {
          if (!warned) {
            warned = true;
            console.warn(`[tool-budget] ${tool.name} blocked: run exceeded ${limit} tool calls`);
          }
          return budgetExhaustedResult(limit);
        }
        if (typeof original !== "function") {
          return budgetExhaustedResult(limit);
        }
        return (original as (...executeArgs: unknown[]) => Promise<ToolResult>).apply(tool, args);
      },
    } as AnyAgentTool;
  });
}
