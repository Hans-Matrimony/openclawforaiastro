import { createMemory } from "./memory.mjs";
import { createTools, TOOLS } from "./tools.mjs";
import { SOURCE_CONFIG } from "./source-contract.mjs";
import { generationSettings } from "./generation.mjs";
import { directReplyCache } from "./reply-cache.mjs";
import { formatReadingReply } from "./format-reply.mjs";
import { deathTimingReply, isDeathTimingQuestion } from "./sensitive-reply.mjs";
import { readingContext } from "./context.mjs";
import { CHART_TOOL_NAMES, bareToolName, requiresChartReading } from "./reading-intent.mjs";

export function redactIdentity(text, userId) {
  let result = text;
  const digits = userId.replace(/\D/g, "");
  for (const value of new Set([userId, digits, digits.length >= 12 ? digits.slice(-10) : ""])) {
    if (value.length >= 8) {
      result = result.split(value).join("[user]");
    }
  }
  return result;
}

export async function directAnswer(
  value,
  {
    env = process.env,
    fetchImpl = fetch,
    makeMemory = createMemory,
    makeTools = createTools,
    now = () => new Date(),
    replyCache = directReplyCache,
  } = {},
) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("Direct model not configured");
  }
  const signal = AbortSignal.timeout(120000);
  const memory = makeMemory(value.user_id, { env, fetchImpl, signal });
  const context = await readingContext(
    value,
    memory,
    (text) => redactIdentity(text, value.user_id),
    now(),
  );
  const execute = makeTools({ memory, birth: value.birth, env, fetchImpl, signal, now });
  const generation = generationSettings(env);
  const messages = [
    { role: "system", content: context.prompt },
    ...value.history.map((turn) => ({
      role: turn.role,
      content: redactIdentity(turn.text, value.user_id),
    })),
    { role: "user", content: redactIdentity(value.query, value.user_id) },
  ];
  let nudged = false;
  let upstreamCalls = 0;
  let cacheHits = 0;
  const readingRequired = requiresChartReading(value.query, context.profile);
  const readingTools = new Set();
  let correctedMissingReading = false;
  const answerUsage = [];
  for (let modelCalls = 1; modelCalls <= 5; modelCalls++) {
    const body = {
      model: env.VEDASTRO_DIRECT_MODEL || SOURCE_CONFIG.model,
      messages,
      tools:
        correctedMissingReading && readingTools.size === 0
          ? TOOLS.filter((tool) => CHART_TOOL_NAMES.has(bareToolName(tool.function.name)))
          : TOOLS,
      tool_choice: correctedMissingReading && readingTools.size === 0 ? "required" : "auto",
      stream: false,
      max_tokens: 4096,
      ...generation,
    };
    if (Buffer.byteLength(JSON.stringify(body)) > 131072) {
      throw new Error("Direct context too large");
    }
    const cacheEnabled = generation.temperature === 0 && env.VEDASTRO_DIRECT_REPLY_CACHE !== "0";
    let completion = cacheEnabled ? replyCache.get(value.user_id, body) : null;
    const cacheHit = completion !== null;
    if (!completion) {
      upstreamCalls++;
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          Authorization: "Bearer " + env.OPENROUTER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error("Direct answer unavailable");
      }
      const text = await response.text();
      if (Buffer.byteLength(text) > 131072) {
        throw new Error("Direct response too large");
      }
      completion = JSON.parse(text);
    } else {
      cacheHits++;
    }
    answerUsage.push({
      generation_id: typeof completion.id === "string" ? completion.id.slice(0, 128) : null,
      input_tokens: completion.usage?.prompt_tokens ?? null,
      output_tokens: completion.usage?.completion_tokens ?? null,
      cost_usd: Number.isFinite(completion.usage?.cost) ? completion.usage.cost : null,
      cache_hit: cacheHit,
    });
    const choice = completion.choices?.[0];
    if (!choice?.message) {
      throw new Error("Missing direct reply");
    }
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      if (choice.message.tool_calls.length > 8) {
        throw new Error("Too many tool calls");
      }
      messages.push(choice.message);
      const results = await Promise.all(
        choice.message.tool_calls.map(async (call) => {
          let content;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            // The supplied source treats malformed tool arguments as an empty object.
          }
          try {
            const result = await execute(call.function.name, args);
            content = typeof result === "string" ? result : JSON.stringify(result);
            if (
              content &&
              !result?.isError &&
              CHART_TOOL_NAMES.has(bareToolName(call.function.name))
            ) {
              readingTools.add(bareToolName(call.function.name));
            }
          } catch {
            content = "Tool failed: Tool unavailable";
          }
          return redactIdentity(content, value.user_id);
        }),
      );
      choice.message.tool_calls.forEach((call, index) => {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: results[index],
        });
      });
      continue;
    }
    const reply = choice.message.content;
    if (!nudged && typeof reply === "string" && /mcp__VedAstro__[a-z_]+\s*:\s*\{/.test(reply)) {
      nudged = true;
      messages.push(choice.message, {
        role: "user",
        content: "Use the tools parameter (function calls), not text. Call the tools now.",
      });
      continue;
    }
    if (
      choice.finish_reason !== "stop" ||
      typeof reply !== "string" ||
      !reply.trim() ||
      reply.length > 32000
    ) {
      throw new Error("Incomplete direct reply");
    }
    const clarification = reply.trim().endsWith("?");
    if (readingRequired && readingTools.size === 0 && !clarification) {
      if (correctedMissingReading) {
        throw new Error("Personal reading requires a successful chart tool");
      }
      correctedMissingReading = true;
      messages.push(choice.message, {
        role: "user",
        content:
          "Complete the original personal chart question using the supplied birth context and a relevant reading tool. The preceding text has no current chart evidence; do not present it as a completed reading. Call the appropriate reading tool now.",
      });
      continue;
    }
    // Preserve normal wording; apply the narrow death-date boundary and bubble whitespace.
    if (cacheEnabled && !cacheHit) {
      replyCache.put(value.user_id, body, completion);
    }
    return {
      schema: "vedastro-direct-reply-v1",
      reply: formatReadingReply(
        deathTimingReply(value.query, reply, value.language),
        readingTools.size > 0 && !isDeathTimingQuestion(value.query),
      ),
      answer_model_calls: upstreamCalls,
      answer_cache_hits: cacheHits,
      answer_reading_tools: [...readingTools],
      answer_usage: answerUsage,
    };
  }
  throw new Error("Direct tool loop did not converge");
}
