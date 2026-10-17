import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream, type AssistantMessage } from "@mariozechner/pi-ai";
import {
  canAcceptReadingRewrite,
  isNormalAstrologyReading,
  readingStyleIssues,
  removeRedundantTimingDisclaimer,
  READING_REWRITE_PROMPT,
} from "./astrologer-reading-style.js";

/** Buffer before delivery so the draft cannot leak through partial/block callbacks. */
export function wrapAstrologerReadingStream(base: StreamFn, prompt: string): StreamFn {
  return (model, context, options) => {
    const output = createAssistantMessageEventStream();
    void (async () => {
      let message: AssistantMessage;
      try {
        message = await (await base(model, context, options)).result();
      } catch (error) {
        // Match the provider's error event contract, including abort propagation.
        output.push({
          type: "error",
          reason: options?.signal?.aborted ? "aborted" : "error",
          error: {
            role: "assistant",
            content: [],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: options?.signal?.aborted ? "aborted" : "error",
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          },
        });
        output.end();
        return;
      }
      const blocks = message.content.filter((block) => block.type === "text");
      const draft = blocks.map((block) => block.text).join("\n\n");
      if (
        message.stopReason === "stop" &&
        blocks.length === 1 &&
        !message.content.some((block) => block.type === "toolCall") &&
        isNormalAstrologyReading(prompt, draft) &&
        readingStyleIssues(draft).length &&
        !options?.signal?.aborted
      ) {
        const timeout = AbortSignal.timeout(15_000);
        const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        try {
          // Same authenticated provider, one bounded retry, no astrology tools executed again.
          const rewrite = await (
            await base(
              model,
              {
                systemPrompt: READING_REWRITE_PROMPT,
                messages: [
                  { role: "user", content: JSON.stringify({ draft }), timestamp: Date.now() },
                ],
              },
              { ...options, signal, maxTokens: 2048 },
            )
          ).result();
          const text = rewrite.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n\n");
          // Account for the extra call even if its wording is rejected.
          for (const key of [
            "input",
            "output",
            "cacheRead",
            "cacheWrite",
            "totalTokens",
          ] as const) {
            message.usage[key] += rewrite.usage[key];
          }
          for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"] as const) {
            message.usage.cost[key] += rewrite.usage.cost[key];
          }
          if (rewrite.stopReason === "stop" && canAcceptReadingRewrite(draft, text)) {
            message = {
              ...message,
              content: message.content.map((block) =>
                block.type === "text" ? { type: "text", text } : block,
              ),
            };
          }
        } catch {
          // Style failure must not lose a valid answer or cause another tool run.
        }
      }
      if (
        message.stopReason === "stop" &&
        blocks.length === 1 &&
        !message.content.some((block) => block.type === "toolCall") &&
        isNormalAstrologyReading(prompt, draft)
      ) {
        message = {
          ...message,
          content: message.content.map((block) =>
            block.type === "text"
              ? { ...block, text: removeRedundantTimingDisclaimer(prompt, block.text) }
              : block,
          ),
        };
      }
      if (options?.signal?.aborted) {
        message = {
          ...message,
          content: [],
          stopReason: "aborted",
          errorMessage: "Request aborted",
        };
      }
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        output.push({ type: "error", reason: message.stopReason, error: message });
      } else {
        // The agent persists this same message and subscribers receive only the reviewed text.
        output.push({ type: "start", partial: { ...message, content: [] } });
        message.content.forEach((block, contentIndex) => {
          if (block.type === "text")
            output.push({ type: "text_delta", contentIndex, delta: block.text, partial: message });
        });
        output.push({ type: "done", reason: message.stopReason, message });
      }
      output.end();
    })();
    return output;
  };
}
