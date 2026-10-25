import { getModel } from "@mariozechner/pi-ai";
import { beforeEach, expect, it, vi } from "vitest";
import { summarizeInStages } from "./compaction.js";

const summary = vi.hoisted(() => vi.fn());
vi.mock("@mariozechner/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mariozechner/pi-coding-agent")>()),
  generateSummary: summary,
}));
beforeEach(() => summary.mockReset().mockResolvedValue("Preserved summary"));

it("passes provider headers, abort signal and previous summary in the SDK argument order", async () => {
  const signal = new AbortController().signal;
  const headers = { "x-test-provider": "synthetic" };
  const model = getModel("openai", "gpt-4o-mini");
  const messages = [{ role: "user" as const, content: "Remember the previous plan", timestamp: 1 }];
  const result = await summarizeInStages({
    messages,
    model,
    apiKey: "synthetic",
    headers,
    signal,
    reserveTokens: 100,
    maxChunkTokens: 1000,
    contextWindow: 10000,
    customInstructions: "Preserve decisions",
    previousSummary: "Earlier decisions",
  });
  expect(result).toBe("Preserved summary");
  expect(summary).toHaveBeenCalledExactlyOnceWith(
    messages,
    model,
    100,
    "synthetic",
    headers,
    signal,
    "Preserve decisions",
    "Earlier decisions",
  );
});
