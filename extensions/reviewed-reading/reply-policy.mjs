import fs from "node:fs";
import path from "node:path";

const START = "**Astrology-only confidence and evidence policy:**";
const END = "**Close-friend tone:**";
const MAX_SOURCE_BYTES = 128 * 1024;

export function extractReplyPolicy(source) {
  if (typeof source !== "string" || Buffer.byteLength(source) > MAX_SOURCE_BYTES) {
    throw new Error("Invalid reply policy");
  }
  const start = source.indexOf(START);
  const end = source.indexOf(END, start);
  if (start < 0 || end <= start || source.indexOf(START, start + START.length) !== -1) {
    throw new Error("Invalid reply policy");
  }
  const policy = source.slice(start, end).trim();
  if (policy.length > 8000 || !policy.includes("Friend behaviour remains unchanged.")) {
    throw new Error("Invalid reply policy");
  }
  return policy;
}

function loadReplyPolicy() {
  const source = path.join(
    process.env.OPENCLAW_STATE_DIR || "/app/.openclaw",
    ".pi/prompts/astrologer.md",
  );
  if (fs.statSync(source).size > MAX_SOURCE_BYTES) {
    throw new Error("Invalid reply policy");
  }
  return extractReplyPolicy(fs.readFileSync(source, "utf8"));
}

/** Add only the managed astrology section; preserve the existing persona and tools. */
export function registerReplyPolicy(
  api,
  {
    enabled = String(process.env.ASTROFRIEND_ASTROLOGY_REPLY_POLICY_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false",
    load = loadReplyPolicy,
  } = {},
) {
  if (!enabled) {
    return false;
  }
  let policy;
  try {
    policy = extractReplyPolicy(load() + "\n" + END);
  } catch {
    // A missing asset must not disable the existing HTTP route or agent.
    api.logger?.warn?.("Astrology reply policy unavailable; existing agent flow retained.");
    return false;
  }
  // The pinned 2026.3.28 runtime supports static system context on this hook.
  // Append after legacy persona examples so this narrow policy takes precedence.
  // Keep it out of user-message history and never replace persona prompts.
  try {
    api.on("before_agent_start", (_event, context) => {
      if (context?.agentId !== "astrologer" || (context.trigger && context.trigger !== "user")) {
        return;
      }
      return { appendSystemContext: policy };
    });
  } catch {
    api.logger?.warn?.("Astrology reply policy hook unavailable; existing agent flow retained.");
    return false;
  }
  api.logger?.info?.("Astrology reply policy enabled for user-driven astrologer turns.");
  return true;
}
