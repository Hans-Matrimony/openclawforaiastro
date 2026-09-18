import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "../pi-tools.types.js";
import { resolveToolCallBudget, withToolCallBudget } from "./tool-budget.js";

function makeCountingTool(name: string, counter: { n: number }): AnyAgentTool {
  return {
    label: name,
    name,
    description: "counting test tool",
    parameters: Type.Object({}),
    execute: async () => {
      counter.n += 1;
      return {
        content: [{ type: "text", text: `ok-${counter.n}` }],
        details: undefined,
      };
    },
  } as unknown as AnyAgentTool;
}

describe("withToolCallBudget", () => {
  it("executes tools normally within the budget", async () => {
    const counter = { n: 0 };
    const wrapped = withToolCallBudget([makeCountingTool("t", counter)], { limit: 3 });
    const first = await wrapped[0].execute?.("call-1", {});
    const second = await wrapped[0].execute?.("call-2", {});
    expect(counter.n).toBe(2);
    expect(JSON.stringify(first)).toContain("ok-1");
    expect(JSON.stringify(second)).toContain("ok-2");
  });

  it("blocks execution and returns a stop instruction once the budget is exhausted", async () => {
    const counter = { n: 0 };
    const wrapped = withToolCallBudget([makeCountingTool("t", counter)], { limit: 2 });
    await wrapped[0].execute?.("call-1", {});
    await wrapped[0].execute?.("call-2", {});
    const blocked = await wrapped[0].execute?.("call-3", {});
    const blockedAgain = await wrapped[0].execute?.("call-4", {});
    expect(counter.n).toBe(2);
    expect(JSON.stringify(blocked)).toContain("budget exhausted");
    expect(JSON.stringify(blockedAgain)).toContain("budget exhausted");
  });

  it("shares one budget across all tools in the run", async () => {
    const counterA = { n: 0 };
    const counterB = { n: 0 };
    const wrapped = withToolCallBudget(
      [makeCountingTool("a", counterA), makeCountingTool("b", counterB)],
      { limit: 3 },
    );
    await wrapped[0].execute?.("c1", {});
    await wrapped[1].execute?.("c2", {});
    await wrapped[0].execute?.("c3", {});
    const blocked = await wrapped[1].execute?.("c4", {});
    expect(counterA.n).toBe(2);
    expect(counterB.n).toBe(1);
    expect(JSON.stringify(blocked)).toContain("budget exhausted");
  });

  it("passes tools through untouched for a non-positive limit", () => {
    const counter = { n: 0 };
    const tools = [makeCountingTool("t", counter)];
    expect(withToolCallBudget(tools, { limit: 0 })).toBe(tools);
    expect(withToolCallBudget(tools, { limit: Number.NaN })).toBe(tools);
  });
});

describe("resolveToolCallBudget", () => {
  it("defaults to 12 without config", () => {
    expect(resolveToolCallBudget(undefined)).toBe(12);
    expect(resolveToolCallBudget({} as OpenClawConfig)).toBe(12);
  });

  it("uses the configured value when valid", () => {
    const config = {
      agents: { defaults: { maxToolCallsPerRun: 8 } },
    } as unknown as OpenClawConfig;
    expect(resolveToolCallBudget(config)).toBe(8);
  });

  it("falls back to the default for invalid values", () => {
    const config = {
      agents: { defaults: { maxToolCallsPerRun: 0 } },
    } as unknown as OpenClawConfig;
    expect(resolveToolCallBudget(config)).toBe(12);
  });
});
