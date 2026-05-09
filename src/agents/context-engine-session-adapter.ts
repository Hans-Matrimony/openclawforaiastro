/**
 * Context Engine Session Adapter
 *
 * Adapts the context engine to work with OpenClaw's session lifecycle.
 * This module provides the integration points between the context engine
 * and the agent runner.
 */

import type { ContextEngine } from "../plugins/types.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type ContextEngineSessionParams = {
  sessionId: string;
  sessionKey?: string;
  sessionFile: string;
  contextEngine: ContextEngine;
  config?: unknown;
};

export type ContextEngineSessionResult = {
  messages: AgentMessage[];
  estimatedTokens: number;
};

/**
 * Bootstrap a session with the context engine.
 * Called when a session is first loaded or created.
 */
export async function bootstrapSessionWithContextEngine(
  params: ContextEngineSessionParams,
): Promise<{ bootstrapped: boolean; importedMessages?: number }> {
  const { contextEngine } = params;

  if (!contextEngine.bootstrap) {
    return { bootstrapped: false };
  }

  try {
    const result = await contextEngine.bootstrap({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.sessionFile,
    });
    return result;
  } catch (error) {
    console.warn(`[context-engine] bootstrap failed: ${error}`);
    return { bootstrapped: false };
  }
}

/**
 * Assemble session messages using the context engine.
 * Called when building the prompt for the LLM.
 */
export async function assembleSessionWithContextEngine(
  params: ContextEngineSessionParams & {
    messages: AgentMessage[];
    tokenBudget?: number;
    model?: string;
    prompt?: string;
  },
): Promise<ContextEngineSessionResult> {
  const { contextEngine, messages } = params;

  try {
    const result = await contextEngine.assemble({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      messages,
      tokenBudget: params.tokenBudget,
      model: params.model,
      prompt: params.prompt,
    });
    return result;
  } catch (error) {
    console.warn(`[context-engine] assemble failed: ${error}`);
    // Fallback to original messages
    const estimatedTokens = estimateTokens(messages);
    return { messages, estimatedTokens };
  }
}

/**
 * Ingest a message into the context engine.
 * Called when a new message is added to the session.
 */
export async function ingestMessageWithContextEngine(
  params: ContextEngineSessionParams & {
    message: unknown;
  },
): Promise<boolean> {
  const { contextEngine } = params;

  if (!contextEngine.ingest) {
    return false;
  }

  try {
    const result = await contextEngine.ingest({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      message: params.message,
    });
    return result.ingested;
  } catch (error) {
    console.warn(`[context-engine] ingest failed: ${error}`);
    return false;
  }
}

/**
 * Ingest a batch of messages into the context engine.
 * Called when multiple messages are added at once.
 */
export async function ingestBatchWithContextEngine(
  params: ContextEngineSessionParams & {
    messages: unknown[];
  },
): Promise<number> {
  const { contextEngine, messages } = params;

  if (!contextEngine.ingestBatch) {
    // Fall back to individual ingestion
    let count = 0;
    for (const message of messages) {
      const ingested = await ingestMessageWithContextEngine({
        ...params,
        message,
      });
      if (ingested) count++;
    }
    return count;
  }

  try {
    const result = await contextEngine.ingestBatch({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      messages,
    });
    return result.ingestedCount;
  } catch (error) {
    console.warn(`[context-engine] ingestBatch failed: ${error}`);
    return 0;
  }
}

/**
 * Call afterTurn on the context engine.
 * Called after each LLM turn completes.
 */
export async function afterTurnWithContextEngine(
  params: ContextEngineSessionParams & {
    messages?: unknown[];
    tokenBudget?: number;
    runtimeContext?: unknown;
  },
): Promise<void> {
  const { contextEngine } = params;

  if (!contextEngine.afterTurn) {
    return;
  }

  try {
    await contextEngine.afterTurn({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.sessionFile,
      messages: params.messages,
      tokenBudget: params.tokenBudget,
      runtimeContext: params.runtimeContext,
    });
  } catch (error) {
    console.warn(`[context-engine] afterTurn failed: ${error}`);
  }
}

/**
 * Compact the session using the context engine.
 * Called when the context window needs to be reduced.
 */
export async function compactSessionWithContextEngine(
  params: ContextEngineSessionParams & {
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    runtimeContext?: unknown;
  },
): Promise<{ ok: boolean; compacted: boolean; reason?: string }> {
  const { contextEngine } = params;

  if (!contextEngine.compact) {
    return { ok: true, compacted: false, reason: "no compact method" };
  }

  try {
    const result = await contextEngine.compact({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.sessionFile,
      tokenBudget: params.tokenBudget,
      force: params.force,
      currentTokenCount: params.currentTokenCount,
      runtimeContext: params.runtimeContext,
    });
    return result;
  } catch (error) {
    console.warn(`[context-engine] compact failed: ${error}`);
    return { ok: false, compacted: false, reason: String(error) };
  }
}

/**
 * Maintain the session using the context engine.
 * Called for periodic maintenance and state synchronization.
 */
export async function maintainSessionWithContextEngine(
  params: ContextEngineSessionParams & {
    runtimeContext?: unknown;
  },
): Promise<{ changed: boolean; bytesFreed: number; rewrittenEntries: number }> {
  const { contextEngine } = params;

  if (!contextEngine.maintain) {
    return { changed: false, bytesFreed: 0, rewrittenEntries: 0 };
  }

  try {
    const result = await contextEngine.maintain({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: params.sessionFile,
      runtimeContext: params.runtimeContext,
    });
    return result;
  } catch (error) {
    console.warn(`[context-engine] maintain failed: ${error}`);
    return { changed: false, bytesFreed: 0, rewrittenEntries: 0 };
  }
}

/**
 * Estimate token count for messages.
 * Used as a fallback when the context engine doesn't provide estimates.
 */
function estimateTokens(msgs: unknown[]): number {
  let chars = 0;
  for (const m of msgs) {
    if (typeof m === "object" && m !== null) {
      if ("content" in m && typeof m.content === "string") {
        chars += m.content.length;
      } else if (
        "content" in m &&
        Array.isArray(m.content)
      ) {
        for (const part of m.content) {
          if (
            typeof part === "object" &&
            part !== null &&
            "text" in part &&
            typeof part.text === "string"
          ) {
            chars += part.text.length;
          }
        }
      }
    }
  }
  return Math.ceil(chars / 4);
}
