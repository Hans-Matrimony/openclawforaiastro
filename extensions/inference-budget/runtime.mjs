import { createHash, randomBytes } from "node:crypto";
import { ModelBudget, createBudgetTransport } from "./transport.mjs";

export function budgetDiagnostic(budget, sessionId) {
  const tag = (value) =>
    typeof value === "string" && value.length
      ? createHash("sha256").update(value).digest("hex").slice(0, 16)
      : "none";
  const reason = new Set([
    "deadline",
    "attempts",
    "input_bytes",
    "output_tokens",
    "invalid_payload",
    "multiple_candidates",
    "unsupported_api",
    "unsupported_body",
  ]);
  return {
    run_tag: tag(budget.runId),
    session_tag: tag(sessionId),
    attempts: budget.attempts,
    request_bytes: budget.bytes,
    reserved_output_tokens: budget.outputTokens,
    blocked: budget.blocked,
    reason: reason.has(budget.reason) ? budget.reason : "none",
  };
}

export const BUDGET_KEY = Symbol.for("astrofriend.inference-budget.v1");
export const GUARDED_AGENTS = new Set([
  "astrologer",
  "astrologer_pwa",
  "reply_repair",
  "provider_selector",
  "provider_renderer",
  "astrologer_preview",
  "astrologer_preview_fast",
]);
const RETENTION_MS = 3600000;
const CAPACITY = 4096;
function summaryKind(message) {
  if (["compactionSummary", "branchSummary"].includes(message.role)) return message.role;
  // Modern provider hooks receive converted messages. Require the runtime's
  // synthetic marker as well as its summary envelope, never user wording alone.
  if (message.role !== "user" || message.synthetic !== true || !Array.isArray(message.content)) return;
  if (message.content.length !== 1 || message.content[0].type !== "text") return;
  const text = message.content[0].text;
  if (typeof text !== "string" || !text.endsWith("</summary>")) return;
  if (text.startsWith("The conversation history before this point was compacted into the following summary:\n\n<summary>\n")) return "compactionSummary";
  if (text.startsWith("The following is a summary of a branch that this conversation came back from:\n\n<summary>\n")) return "branchSummary";
}
// PWA requests already carry their bounded, server-owned recent conversation.
// This runs on AgentMessages before Pi converts summaries/custom messages to
// role=user. Retain recent conversation text and summaries, but only the current
// turn's tool exchange: earlier full chart packets can exhaust the input cap.
export function recentPwaContext(context, agentId) {
  if (agentId !== "astrologer_pwa" || !Array.isArray(context?.messages)) {
    return context;
  }
  const starts = [];
  for (const [index, message] of context.messages.entries()) {
    if (message.role === "user" && !summaryKind(message)) {
      starts.push(index);
    }
  }
  if (starts.length === 0) {
    return context;
  }
  const start = starts[Math.max(0, starts.length - 3)];
  const currentStart = starts.at(-1);
  const retained = context.messages.slice(start).flatMap((message, offset) => {
    if (start + offset >= currentStart) {
      return [message];
    }
    if (message.role === "toolResult") {
      return [];
    }
    if (message.role === "assistant" && Array.isArray(message.content)) {
      const content = message.content.filter((part) => part.type !== "toolCall");
      if (content.length !== message.content.length) {
        return content.length ? [{ ...message, content }] : [];
      }
    }
    return [message];
  });
  if (
    start === 0 &&
    retained.length === context.messages.length &&
    retained.every((message, index) => message === context.messages[index])
  ) {
    return context;
  }
  const retainedSummaryRoles = new Set(
    retained
      .map(summaryKind).filter(Boolean),
  );
  const summaries = new Map();
  for (const [index, message] of context.messages.entries()) {
    if (index >= start) {
      break;
    }
    if (
      summaryKind(message) &&
      !retainedSummaryRoles.has(summaryKind(message))
    ) {
      summaries.set(summaryKind(message), { index, message });
    }
  }
  return {
    ...context,
    messages: [
      ...[...summaries.values()]
        .toSorted((a, b) => a.index - b.index)
        .map(({ message }) => message),
      ...retained,
    ],
  };
}
const MESSAGES = {
  english:
    "I couldn’t finish this reply just now. Please ask one specific question so I can help clearly.",
  hinglish:
    "Abhi jawab poora nahi ho paaya. Ek specific sawaal poochhein, taaki main clearly madad kar sakoon.",
  hindi: "अभी जवाब पूरा नहीं हो पाया। कृपया एक स्पष्ट सवाल पूछें, ताकि मैं मदद कर सकूँ।",
  tamil: "இப்போது பதிலை முடிக்க முடியவில்லை. உதவுவதற்கு ஒரு குறிப்பிட்ட கேள்வியைக் கேளுங்கள்.",
  telugu: "ఇప్పుడు సమాధానాన్ని పూర్తి చేయలేకపోయాను. సహాయం చేయడానికి ఒక నిర్దిష్ట ప్రశ్న అడగండి.",
  tamilish: "Ippo badhilai mudikka mudiyavillai. Oru kurippitta kelvi kelunga; udhavi seigiren.",
  telugish:
    "Ippudu samadhanam poorthi cheyalekapoyanu. Oka nirdishta prashna adagandi; sahayam chestanu.",
};

function stoppedMessage(model, budget, previous) {
  return {
    role: "assistant",
    content: [{ type: "text", text: MESSAGES[budget.language] ?? MESSAGES.english }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    stopReason: "stop",
    timestamp: Date.now(),
    usage: previous?.usage ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

function wrapResult(stream, model, budget, compaction, reportStop, reportCompletion) {
  let stopped;
  let reported = false;
  let completionReported = false;
  const observeCompletion = (message) => {
    if (completionReported) {
      return;
    }
    completionReported = true;
    try {
      reportCompletion(message);
    } catch {}
  };
  const final = (message) => {
    observeCompletion(message);
    if (budget.now() >= budget.deadline && ["error", "aborted"].includes(message?.stopReason)) {
      budget.blocked = true;
      budget.reason ??= "deadline";
    }
    if (budget.blocked && !reported) {
      reported = true;
      // Diagnostics must never alter the guarded result if a logger fails.
      try {
        reportStop();
      } catch {}
    }
    // Never save a budget-stop message as a conversation summary.
    if (!budget.blocked || compaction) {
      return message;
    }
    return (stopped ??= stoppedMessage(model, budget, message));
  };
  return {
    async *[Symbol.asyncIterator]() {
      for await (const event of await stream) {
        if (event.type === "done") {
          observeCompletion(event.message);
        }
        if (event.type === "error") {
          final(event.error);
        }
        if (budget.blocked && !compaction && event.type === "error") {
          yield { type: "done", reason: "stop", message: final(event.error) };
        } else {
          yield event;
        }
      }
    },
    async result() {
      return final(await (await stream).result());
    },
  };
}

export function createBudgetRuntime({ fetchImpl = globalThis.fetch, now = Date.now, limits } = {}) {
  const transport = createBudgetTransport(fetchImpl);
  const runs = new Map();
  const sessions = new Map();
  const modelBudgets = new WeakMap();
  const calls = new Map();
  const pendingCalls = new Map();
  const registered = new Map();
  const runtimeTag = randomBytes(8).toString("hex");
  let diagnosticReporter;
  function emitDiagnostic(event) {
    const value = { ...event, runtime_tag: runtimeTag };
    if (diagnosticReporter) {
      diagnosticReporter(value);
    } else {
      // SDK extension realms must remain observable even when the gateway's
      // plugin logger belongs to another runtime instance. Only fixed fields,
      // counters and hashed identifiers enter this event.
      const name =
        event.kind === "session_binding_mismatch"
          ? "inference-budget-binding"
          : event.kind === "provider_completion"
            ? "provider-completion"
            : "inference-budget-stop";
      console.info(`[${name}] ${JSON.stringify(value)}`);
    }
  }
  const closed = () => {
    const budget = new ModelBudget({ ...limits, attempts: 0 });
    return budget;
  };
  function bind(context, prompt = "") {
    if (!GUARDED_AGENTS.has(context.agentId) || !context.runId || !context.sessionId) {
      return;
    }
    for (const [id, entry] of runs) {
      if (now() - entry.created >= RETENTION_MS) {
        runs.delete(id);
        for (const sessionId of entry.sessionIds) {
          if (sessions.get(sessionId) === id) {
            sessions.delete(sessionId);
          }
        }
      }
    }
    let entry = runs.get(context.runId);
    if (!entry) {
      if (runs.size >= CAPACITY) {
        return;
      }
      const isolatedProvider = ["provider_selector", "provider_renderer"].includes(context.agentId);
      const budget = new ModelBudget(
        isolatedProvider
          ? {
              ...limits,
              attempts: 1,
              outputTokens: 2048,
              totalOutputTokens: 2048,
              durationMs: 40000,
            }
          : limits,
      );
      budget.runId = context.runId;
      budget.agentId = context.agentId;
      budget.language = /\[Language:\s*([a-z]+)\]/i.exec(prompt)?.[1]?.toLowerCase() ?? "english";
      entry = { budget, created: now(), sessionIds: new Set() };
      runs.set(context.runId, entry);
    }
    sessions.set(context.sessionId, context.runId);
    entry.sessionIds.add(context.sessionId);
    return entry.budget;
  }
  function forSession(sessionId) {
    if (!sessions.has(sessionId)) {
      return undefined;
    }
    return runs.get(sessions.get(sessionId))?.budget ?? closed();
  }
  function bindModel(model, sessionId) {
    if (!model) {
      return;
    }
    const budget = forSession(sessionId);
    // Missing run ownership fails closed, including compaction without sessionId.
    const selected = budget ?? closed();
    const previous = modelBudgets.get(model);
    if (previous && previous.sessionId !== sessionId) {
      // A model shared by simultaneous sessions is ambiguous for SDK calls that
      // omit sessionId. Fail closed instead of spending another user's allowance.
      modelBudgets.set(model, { budget: closed(), sessionId: null });
    } else {
      modelBudgets.set(model, { budget: selected, sessionId });
    }
  }
  function bindCall(context) {
    if (!context.callId || !context.sessionId || !context.runId) return;
    for (const [id, call] of calls) {
      if (now() - call.created >= RETENTION_MS) calls.delete(id);
    }
    // Compaction has a diagnostic child run ID. Its retries and provider
    // fallbacks must retain the allowance established by before_compaction.
    let budget;
    if (context.runId.includes(":compaction:")) {
      const owner = forSession(context.sessionId);
      const root = context.runId.split(":compaction:", 1)[0];
      const parent = runs.get(root);
      // Automatic compaction shares its parent turn. Manual compaction gets
      // one session-scoped allowance, reused across diagnostic fallback IDs.
      const runId = parent?.sessionIds.has(context.sessionId)
        ? root : `compaction:${context.sessionId}:${root}`;
      budget = owner && bind({agentId:owner.agentId, sessionId:context.sessionId, runId});
    } else {
      budget = bind(context);
    }
    if (!budget || !GUARDED_AGENTS.has(budget.agentId)) return;
    for (const key of [context.callId]) {
      const previous = calls.get(key);
      if (previous && (previous.budget !== budget || previous.sessionId !== context.sessionId)) {
        calls.set(key, { budget: closed(), sessionId: null, created: now() });
      } else if (calls.size < CAPACITY || previous) {
        calls.set(key, { budget, sessionId: context.sessionId, created: now() });
      }
      for (const wake of pendingCalls.get(key) ?? []) wake();
    }
  }
  function waitForCall(callId, signal) {
    if (calls.has(callId) || signal?.aborted || pendingCalls.size >= CAPACITY) return Promise.resolve();
    return new Promise(resolve => {
      const waiters = pendingCalls.get(callId) ?? new Set();
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        waiters.delete(finish);
        if (!waiters.size) pendingCalls.delete(callId);
        resolve();
      };
      const timer = setTimeout(finish, 1000);
      waiters.add(finish);
      pendingCalls.set(callId, waiters);
      signal?.addEventListener("abort", finish, {once:true});
    });
  }
  function wrapStream(inner, strict = false, withTransport = (_scope, run) => run()) {
    const execute = (model, context, options) => {
        if (strict && options?.sessionId && forSession(options.sessionId)) {
          bindModel(model, options.sessionId);
        }
        const associated = modelBudgets.get(model);
        const callKey = options?.requestId;
        const call = strict && callKey ? calls.get(callKey) : undefined;
        const callBudget = call && call.budget === forSession(call.sessionId) &&
          (!options?.sessionId || options.sessionId === call.sessionId)
          ? call.budget : closed();
        const selected = strict && callKey
          ? callBudget
          : options?.sessionId
          ? (forSession(options.sessionId) ??
            (associated?.sessionId === options.sessionId ? closed() : undefined))
          : associated?.sessionId
            ? (forSession(associated.sessionId) ?? closed())
            : associated?.budget;
        // A model association establishes session ownership, not a permanent
        // allowance. Compaction without sessionId must use that session's
        // current run; in-flight streams retain the allowance they started with.
        const budget = selected ?? (strict ? closed() : undefined);
        if (!budget) {
          return inner(model, context, options);
        }
        const stream = transport.scope.run({ budget, api: model.api }, () =>
          withTransport({ budget, api: model.api }, () =>
            inner(model, strict ? recentPwaContext(context, budget.agentId) : context, options)),
        );
        const sessionId = options?.sessionId ?? call?.sessionId ?? associated?.sessionId;
        return wrapResult(
          stream,
          model,
          budget,
          !options?.sessionId,
          () => {
            const current = forSession(sessionId);
            emitDiagnostic({
              ...budgetDiagnostic(budget, sessionId),
              current_run_tag: current ? budgetDiagnostic(current, sessionId).run_tag : "none",
              explicit_session: Boolean(options?.sessionId),
              compaction: !options?.sessionId,
              selected_budget_is_current: budget === current,
            });
          },
          (message) => {
            if (!["provider_selector", "provider_renderer"].includes(budget.agentId)) {
              return;
            }
            const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : -1);
            const reasons = ["stop", "length", "toolUse", "error", "aborted"];
            emitDiagnostic({
              kind: "provider_completion",
              agent: budget.agentId,
              stage_envelope_applied: budget.providerEnvelopeApplied === true,
              run_tag: budgetDiagnostic(budget, sessionId).run_tag,
              session_tag: budgetDiagnostic(budget, sessionId).session_tag,
              stop_reason: reasons.includes(message?.stopReason) ? message.stopReason : "unknown",
              input_tokens: count(message?.usage?.input),
              output_tokens: count(message?.usage?.output),
              total_tokens: count(message?.usage?.totalTokens),
            });
          },
        );
    };
    return (model, context, options) => {
      if (!strict || !options?.requestId || calls.has(options.requestId)) return execute(model, context, options);
      // model_call_started is fire-and-forget in modern OpenClaw. Its trusted
      // ownership hook may run after stream construction. Never send before
      // registration; a missing hook times out and stays fail-closed.
      const ready = waitForCall(options.requestId, options.signal).then(() => execute(model, context, options));
      return {
        async result() { return (await ready).result(); },
        async *[Symbol.asyncIterator]() { yield* await ready; },
      };
    };
  }
  function installSdk(sdk) {
    for (const provider of sdk.getApiProviders()) {
      if (registered.get(provider.api) === provider) {
        continue;
      }

      sdk.registerApiProvider(
        {
          api: provider.api,
          stream: wrapStream(provider.stream),
          streamSimple: wrapStream(provider.streamSimple),
        },
        "astrofriend-inference-budget",
      );
      registered.set(provider.api, sdk.getApiProvider(provider.api));
    }
  }
  return {
    transport,
    bind,
    bindCall,
    bindModel,
    forSession,
    installSdk,
    wrapStream,
    runtimeTag,
    setDiagnosticReporter: (reporter) => {
      diagnosticReporter = reporter;
    },
    reportSessionBinding: (sessionId, fileSessionId) => {
      if (!fileSessionId || sessionId === fileSessionId) {
        return;
      }
      const actual = forSession(sessionId),
        declared = forSession(fileSessionId);
      const empty = { attempts: 0, bytes: 0, outputTokens: 0, blocked: false };
      try {
        emitDiagnostic({
          kind: "session_binding_mismatch",
          sdk_session_tag: budgetDiagnostic(actual ?? empty, sessionId).session_tag,
          file_session_tag: budgetDiagnostic(declared ?? empty, fileSessionId).session_tag,
          sdk_run_tag: budgetDiagnostic(actual ?? empty, sessionId).run_tag,
          file_run_tag: budgetDiagnostic(declared ?? empty, fileSessionId).run_tag,
          sdk_has_run_owner: Boolean(actual),
          file_has_run_owner: Boolean(declared),
        });
      } catch {}
    },
  };
}

export function getBudgetRuntime() {
  if (!globalThis[BUDGET_KEY]) {
    const runtime = createBudgetRuntime();
    globalThis.fetch = (...args) => runtime.transport.fetch(...args);
    globalThis[BUDGET_KEY] = runtime;
  }
  return globalThis[BUDGET_KEY];
}
