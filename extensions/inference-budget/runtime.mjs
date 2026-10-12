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
  "astrologer_preview",
  "astrologer_preview_fast",
]);
const RETENTION_MS = 3600000;
const CAPACITY = 4096;
// PWA requests already carry their bounded, server-owned recent conversation.
// This runs on AgentMessages before Pi converts summaries/custom messages to
// role=user. Keep complete turns and the latest summaries of earlier history.
export function recentPwaContext(context, agentId) {
  if (agentId !== "astrologer_pwa" || !Array.isArray(context?.messages)) {
    return context;
  }
  const starts = [];
  for (const [index, message] of context.messages.entries()) {
    if (message.role === "user") {
      starts.push(index);
    }
  }
  if (starts.length <= 3) {
    return context;
  }
  const start = starts.at(-3);
  const retained = context.messages.slice(start);
  const retainedSummaryRoles = new Set(
    retained
      .filter((message) => ["compactionSummary", "branchSummary"].includes(message.role))
      .map((message) => message.role),
  );
  const summaries = new Map();
  for (const [index, message] of context.messages.entries()) {
    if (index >= start) {
      break;
    }
    if (
      ["compactionSummary", "branchSummary"].includes(message.role) &&
      !retainedSummaryRoles.has(message.role)
    ) {
      summaries.set(message.role, { index, message });
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

function wrapResult(stream, model, budget, compaction, reportStop) {
  let stopped;
  let reported = false;
  const final = (message) => {
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
      for await (const event of stream) {
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
      return final(await stream.result());
    },
  };
}

export function createBudgetRuntime({ fetchImpl = globalThis.fetch, now = Date.now, limits } = {}) {
  const transport = createBudgetTransport(fetchImpl);
  const runs = new Map();
  const sessions = new Map();
  const modelBudgets = new WeakMap();
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
      const budget = new ModelBudget(limits);
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
  function installSdk(sdk) {
    for (const provider of sdk.getApiProviders()) {
      if (registered.get(provider.api) === provider) {
        continue;
      }
      const wrap = (inner) => (model, context, options) => {
        const associated = modelBudgets.get(model);
        const budget = options?.sessionId
          ? (forSession(options.sessionId) ??
            (associated?.sessionId === options.sessionId ? closed() : undefined))
          : associated?.sessionId
            ? (forSession(associated.sessionId) ?? closed())
            : associated?.budget;
        // A model association establishes session ownership, not a permanent
        // allowance. Compaction without sessionId must use that session's
        // current run; in-flight streams retain the allowance they started with.
        if (!budget) {
          return inner(model, context, options);
        }
        const stream = transport.scope.run({ budget, api: model.api }, () =>
          inner(model, context, options),
        );
        const sessionId = options?.sessionId ?? associated?.sessionId;
        return wrapResult(stream, model, budget, !options?.sessionId, () => {
          const current = forSession(sessionId);
          emitDiagnostic({
            ...budgetDiagnostic(budget, sessionId),
            current_run_tag: current ? budgetDiagnostic(current, sessionId).run_tag : "none",
            explicit_session: Boolean(options?.sessionId),
            compaction: !options?.sessionId,
            selected_budget_is_current: budget === current,
          });
        });
      };
      sdk.registerApiProvider(
        {
          api: provider.api,
          stream: wrap(provider.stream),
          streamSimple: wrap(provider.streamSimple),
        },
        "astrofriend-inference-budget",
      );
      registered.set(provider.api, sdk.getApiProvider(provider.api));
    }
  }
  return {
    transport,
    bind,
    bindModel,
    forSession,
    installSdk,
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
