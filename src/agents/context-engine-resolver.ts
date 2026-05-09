/**
 * Context Engine Resolver
 *
 * Resolves the active context engine based on the plugin configuration.
 * Reads from plugins.slots.contextEngine and returns the registered engine.
 */

import type { OpenClawConfig } from "../config/config.js";
import { resolveContextEngine } from "./context-engine-registry.js";

const DEFAULT_CONTEXT_ENGINE = "legacy";

/**
 * Resolve the context engine ID from the config.
 * Returns the slot value or the default.
 */
export function resolveContextEngineId(cfg: OpenClawConfig): string {
  const pluginsEnabled = cfg.plugins?.enabled !== false;
  if (!pluginsEnabled) {
    return DEFAULT_CONTEXT_ENGINE;
  }

  const raw = cfg.plugins?.slots?.contextEngine;
  if (typeof raw !== "string" || !raw.trim()) {
    return DEFAULT_CONTEXT_ENGINE;
  }

  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "none") {
    return DEFAULT_CONTEXT_ENGINE;
  }

  return trimmed;
}

/**
 * Get the context engine ID for display/status purposes.
 */
export function getContextEngineStatus(cfg: OpenClawConfig): {
  enabled: boolean;
  id: string;
} {
  const id = resolveContextEngineId(cfg);
  return {
    enabled: id !== DEFAULT_CONTEXT_ENGINE,
    id,
  };
}

/**
 * Resolve the context engine instance from the config.
 * This is the main entry point for getting the active context engine.
 */
export async function resolveActiveContextEngine(
  cfg: OpenClawConfig,
): Awaited<ReturnType<typeof resolveContextEngine>> {
  const engineId = resolveContextEngineId(cfg);
  return resolveContextEngine(engineId);
}
