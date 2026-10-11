import * as sdk from "@mariozechner/pi-ai";
import { getBudgetRuntime, recentPwaContext } from "./runtime.mjs";

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
    runtime.bindModel(context.model, context.sessionManager.getSessionId());
  };
  pi.on("input", (event, context) => {
    bind(event, context);
    return { action: "continue" };
  });
  pi.on("session_before_compact", bind);
  pi.on("context", (event, context) => pwaContext(event, context, runtime));
}
