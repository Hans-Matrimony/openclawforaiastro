// Resolve the SDK belonging to the pinned OpenClaw installation, not a second copy.
import { createRequire } from "node:module";
const requireRuntime = createRequire(
  process.env.OPENCLAW_READING_RUNTIME_PACKAGE ||
    "/usr/local/lib/node_modules/openclaw/package.json",
);
// pi-ai exposes import-only package exports. This pinned, dependency-free SDK
// utility can also be loaded by OpenClaw's synchronous plugin loader.
export const { createAssistantMessageEventStream } = requireRuntime(
  "./node_modules/@mariozechner/pi-ai/dist/utils/event-stream.js",
);
if (typeof createAssistantMessageEventStream !== "function") {
  throw new Error("Installed OpenClaw SDK has no assistant stream factory");
}
