import * as sdk from "@mariozechner/pi-ai";
import path from "node:path";
import { getBudgetRuntime, recentPwaContext } from "./runtime.mjs";

export function sessionFileId(file) {
  if (typeof file !== "string") {
    return undefined;
  }
  // Stock gateway UUID filenames and Pi's timestamp_UUID filenames only.
  return /(?:^|_)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl$/i.exec(
    path.basename(file),
  )?.[1];
}

export function pwaContext(event, context, runtime) {
  const budget = runtime.forSession(context.sessionManager.getSessionId());
  const bounded = recentPwaContext(event, budget?.agentId);
  return bounded === event ? undefined : { messages: bounded.messages };
}

export default function register(pi) {
  const runtime = getBudgetRuntime();
  runtime.installSdk(sdk);
  const bind = (_event, context) => {
    runtime.installSdk(sdk);
    runtime.reportSessionBinding?.(
      context.sessionManager.getSessionId(),
      sessionFileId(context.sessionManager.getSessionFile?.()),
    );
    runtime.bindModel(context.model, context.sessionManager.getSessionId());
  };
  pi.on("input", (event, context) => {
    bind(event, context);
    return { action: "continue" };
  });
  pi.on("session_before_compact", bind);
  pi.on("context", (event, context) => pwaContext(event, context, runtime));
}
