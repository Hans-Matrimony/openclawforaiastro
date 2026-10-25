import type { StreamFn } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  getModel,
} from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { wrapAstrologerReadingStream } from "./astrologer-reading-stream.js";

const model = getModel("openai", "gpt-4o-mini");
const reading =
  "Career progress looks gradual rather than sudden. Saturn supports steady effort and patience as you take on responsibility, while Mercury supports analytical work and clear communication with colleagues. These factors suggest focusing on work that rewards consistency and careful thinking.";
function message(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    stopReason: "stop",
    timestamp: Date.now(),
    usage: {
      input: 10,
      output: 20,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 30,
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
    },
  };
}
function provider(responses: AssistantMessage[]) {
  return vi.fn<StreamFn>(() => {
    const stream = createAssistantMessageEventStream();
    const result = responses.shift()!;
    queueMicrotask(() => {
      stream.push({
        type: "text_delta",
        contentIndex: 0,
        delta: "UNREVIEWED DRAFT",
        partial: result,
      });
      stream.push({ type: "done", reason: "stop", message: result });
      stream.end();
    });
    return stream;
  });
}
describe("reading delivery guard", () => {
  it("delivers and persists timing text without the redundant clause or another model call", async () => {
    const clean =
      "December se February ka samay shaadi ke liye anukool dikh raha hai. Saturn aur Jupiter ke checked transit factors is interval mein saath aate hain, aur yeh reading unhi factors tak seemit hai, poori grah-bal jaanch abhi ismein shaamil nahi hai.";
    const base = provider([message(clean + " Yeh sambhavit mauke hain, pakki tareekh nahi.")]);
    const agent = new Agent({
      initialState: { model },
      streamFn: wrapAstrologerReadingStream(base, "Shaadi kab?"),
    });
    const deltas: string[] = [];
    agent.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        deltas.push(event.assistantMessageEvent.delta);
      }
    });
    await agent.prompt("Shaadi kab?");
    expect(deltas).toEqual([clean]);
    expect(agent.state.messages.at(-1)?.content).toEqual([{ type: "text", text: clean }]);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("delivers and records the reviewed response through the actual agent loop", async () => {
    const base = provider([message(reading + " Would you like more?"), message(reading)]);
    const agent = new Agent({
      initialState: { model },
      streamFn: wrapAstrologerReadingStream(base, "Career?"),
    });
    const deltas: string[] = [];
    agent.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        deltas.push(event.assistantMessageEvent.delta);
      }
    });
    await agent.prompt("Career?");
    expect(deltas).toEqual([reading]);
    expect(agent.state.messages.at(-1)?.content).toEqual([{ type: "text", text: reading }]);
  });
  it("retains the answer when the rewrite provider throws", async () => {
    const original = reading + " Would you like more?";
    const base = provider([message(original)]);
    base
      .mockImplementationOnce(() => {
        const stream = createAssistantMessageEventStream();
        stream.push({ type: "done", reason: "stop", message: message(original) });
        return stream;
      })
      .mockImplementationOnce(() => {
        throw new Error("provider unavailable");
      });
    const stream = await wrapAstrologerReadingStream(base, "Career?")(model, { messages: [] });
    expect((await stream.result()).content).toEqual([{ type: "text", text: original }]);
    expect(base).toHaveBeenCalledTimes(2);
  });
  it("propagates cancellation without releasing a buffered answer", async () => {
    const controller = new AbortController();
    const base = provider([message(reading)]);
    controller.abort();
    const stream = await wrapAstrologerReadingStream(base, "Career?")(
      model,
      { messages: [] },
      { signal: controller.signal },
    );
    const result = await stream.result();
    expect(result.stopReason).toBe("aborted");
    expect(result.content).toEqual([]);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("never streams the draft and persists the same reviewed answer with total usage", async () => {
    const base = provider([message(reading + " Would you like more?"), message(reading)]);
    const stream = await wrapAstrologerReadingStream(base, "Career?")(
      model,
      { messages: [] },
      { apiKey: "test" },
    );
    const events = [];
    for await (const event of stream) {
      events.push(event);
    }
    const final = await stream.result();
    expect(final.content).toEqual([{ type: "text", text: reading }]);
    expect(final.usage.totalTokens).toBe(60);
    expect(JSON.stringify(events)).not.toContain("UNREVIEWED DRAFT");
    expect(base).toHaveBeenCalledTimes(2);
    expect(base.mock.calls[1][1].tools).toBeUndefined();
    expect(base.mock.calls[1][2]?.apiKey).toBe("test");
  });
  it("keeps original if rewrite changes the verdict", async () => {
    const original = reading + " Would you like more?";
    const base = provider([message(original), message(reading.replace("gradual", "guaranteed"))]);
    const stream = await wrapAstrologerReadingStream(base, "Career?")(model, { messages: [] });
    expect((await stream.result()).content).toEqual([{ type: "text", text: original }]);
  });
  it("does not rewrite tool calls, even when their text resembles a reading", async () => {
    const original = message(reading + " Would you like more?");
    original.stopReason = "toolUse";
    original.content.push({ type: "toolCall", id: "test", name: "calculate", arguments: {} });
    const base = provider([original]);
    const stream = await wrapAstrologerReadingStream(base, "Career?")(model, { messages: [] });
    expect((await stream.result()).content).toEqual(original.content);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("does not rewrite requested detail", async () => {
    const base = provider([message(reading + " Would you like more?")]);
    const stream = await wrapAstrologerReadingStream(base, "Explain in detail")(model, {
      messages: [],
    });
    await stream.result();
    expect(base).toHaveBeenCalledTimes(1);
  });
});
