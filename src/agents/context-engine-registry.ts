/**
 * Context Engine Registry
 *
 * Manages the registration and resolution of context engines for session management.
 * Context engines control how sessions are bootstrapped, ingested, assembled, and compacted.
 */

import type {
  ContextEngine,
  ContextEngineFactory,
} from "../plugins/types.js";

type ContextEngineEntry = {
  id: string;
  factory: ContextEngineFactory;
  instance: ContextEngine | null;
};

/**
 * Global registry for context engines.
 * Plugins register their context engines via api.registerContextEngine().
 */
const CONTEXT_ENGINES = new Map<string, ContextEngineEntry>();

/**
 * Default "legacy" context engine that uses file-based session storage.
 * This is the fallback when no plugin context engine is registered.
 */
const LEGACY_CONTEXT_ENGINE: ContextEngine = {
  get info() {
    return {
      id: "legacy",
      name: "Legacy File-based Context",
      version: "1.0.0",
      ownsCompaction: false,
    };
  },

  async bootstrap() {
    return { bootstrapped: false, reason: "legacy engine uses file-only storage" };
  },

  async assemble({ messages }) {
    // Legacy behavior: just pass through the file-based messages
    const estimatedTokens = estimateTokens(messages);
    return { messages, estimatedTokens };
  },

  async compact() {
    return { ok: true, compacted: false, reason: "delegated to runtime" };
  },
};

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

/**
 * Register a context engine.
 * Called by plugins via api.registerContextEngine().
 */
export function registerContextEngine(
  id: string,
  factory: ContextEngineFactory,
): void {
  const trimmedId = id.trim();
  if (CONTEXT_ENGINES.has(trimmedId)) {
    throw new Error(`Context engine already registered: ${trimmedId}`);
  }
  CONTEXT_ENGINES.set(trimmedId, {
    id: trimmedId,
    factory,
    instance: null,
  });
}

/**
 * Get a list of all registered context engine IDs.
 */
export function getRegisteredContextEngineIds(): string[] {
  return ["legacy", ...Array.from(CONTEXT_ENGINES.keys())];
}

/**
 * Resolve a context engine by ID.
 * Returns the legacy engine if the ID is "legacy" or if no engine is found.
 */
export async function resolveContextEngine(
  id: string | undefined | null,
): Promise<ContextEngine> {
  // If no ID specified or explicitly "legacy", return the legacy engine
  if (!id || id === "legacy") {
    return LEGACY_CONTEXT_ENGINE;
  }

  const entry = CONTEXT_ENGINES.get(id.trim());
  if (!entry) {
    const available = getRegisteredContextEngineIds().join(", ");
    throw new Error(
      `Context engine "${id}" is not registered. Available engines: ${available}`,
    );
  }

  // Lazy initialization: create the instance on first use
  if (!entry.instance) {
    entry.instance = entry.factory();
  }

  return entry.instance;
}

/**
 * Clear all registered context engines (for testing).
 */
export function clearContextEngineRegistry(): void {
  for (const entry of CONTEXT_ENGINES.values()) {
    if (entry.instance?.dispose) {
      void entry.instance.dispose();
    }
  }
  CONTEXT_ENGINES.clear();
}

/**
 * Check if a context engine with the given ID is registered.
 */
export function hasContextEngine(id: string): boolean {
  if (id === "legacy") {
    return true;
  }
  return CONTEXT_ENGINES.has(id.trim());
}
