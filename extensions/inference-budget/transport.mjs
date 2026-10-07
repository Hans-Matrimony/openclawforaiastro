import { AsyncLocalStorage } from "node:async_hooks";

export const DEFAULT_LIMITS = Object.freeze({
  attempts: 6,
  requestBytes: 196608,
  totalBytes: 524288,
  outputTokens: 2048,
  totalOutputTokens: 12288,
  durationMs: 80000,
});

// Reserve before sending: an interrupted request may still have been billed.
export class ModelBudget {
  constructor(limits = DEFAULT_LIMITS, now = () => performance.now()) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.now = now;
    this.deadline = now() + this.limits.durationMs;
    this.attempts = 0;
    this.bytes = 0;
    this.outputTokens = 0;
    this.blocked = false;
  }

  stop(reason) {
    this.blocked = true;
    this.reason ??= reason;
    throw new Error("AstroFriend inference budget exhausted");
  }

  reserve(bytes, outputTokens) {
    if (this.blocked) {
      this.stop(this.reason);
    }
    if (this.now() >= this.deadline) {
      this.stop("deadline");
    }
    if (this.attempts >= this.limits.attempts) {
      this.stop("attempts");
    }
    if (bytes > this.limits.requestBytes || this.bytes + bytes > this.limits.totalBytes) {
      this.stop("input_bytes");
    }
    if (this.outputTokens + outputTokens > this.limits.totalOutputTokens) {
      this.stop("output_tokens");
    }
    this.attempts++;
    this.bytes += bytes;
    this.outputTokens += outputTokens;
  }
}

function cappedOutput(value, cap) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, cap) : cap;
}

export function boundPayload(body, api, budget) {
  if (typeof body !== "string" || Buffer.byteLength(body) > budget.limits.requestBytes) {
    budget.stop("input_bytes");
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    budget.stop("invalid_payload");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    budget.stop("invalid_payload");
  }
  let tokens;
  const cap = budget.limits.outputTokens;
  if (api === "openai-completions") {
    if (!Array.isArray(payload.messages)) {
      budget.stop("invalid_payload");
    }
    const key = "max_completion_tokens" in payload ? "max_completion_tokens" : "max_tokens";
    tokens = cappedOutput(payload[key], cap);
    delete payload.max_tokens;
    delete payload.max_completion_tokens;
    payload[key] = tokens;
    // Multiple candidates multiply output spend.
    if (payload.n !== undefined && payload.n !== 1) {
      budget.stop("multiple_candidates");
    }
  } else if (api === "openai-responses") {
    if (!Array.isArray(payload.input)) {
      budget.stop("invalid_payload");
    }
    tokens = cappedOutput(payload.max_output_tokens, cap);
    payload.max_output_tokens = tokens;
  } else if (api === "google-generative-ai") {
    if (!Array.isArray(payload.contents)) {
      budget.stop("invalid_payload");
    }
    const generation = (payload.generationConfig ??= {});
    tokens = cappedOutput(generation.maxOutputTokens, cap);
    generation.maxOutputTokens = tokens;
    if (generation.candidateCount !== undefined && generation.candidateCount !== 1) {
      budget.stop("multiple_candidates");
    }
    if (generation.thinkingConfig?.thinkingBudget > tokens) {
      generation.thinkingConfig.thinkingBudget = tokens;
    }
  } else {
    budget.stop("unsupported_api");
  }
  const bounded = JSON.stringify(payload);
  budget.reserve(Buffer.byteLength(bounded), tokens);
  return bounded;
}

export function createBudgetTransport(fetchImpl = globalThis.fetch) {
  const scope = new AsyncLocalStorage();
  return {
    scope,
    async fetch(input, init) {
      const current = scope.getStore();
      if (!current) {
        return fetchImpl(input, init);
      }
      const { budget, api } = current;
      let request;
      try {
        // Native SDKs currently pass JSON strings. Reject streams/FormData rather
        // than buffering an unbounded or unaccounted request.
        if (!init || typeof init.body !== "string") {
          budget.stop("unsupported_body");
        }
        const body = boundPayload(init.body, api, budget);
        const remaining = Math.max(1, Math.ceil(budget.deadline - budget.now()));
        const deadline = AbortSignal.timeout(remaining);
        const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
        request = { ...init, body, redirect: "error", signal };
      } catch {
        // 400 is deliberately nonretryable in the supported SDKs. Do not expose
        // prompt content, credentials, counters, or provider error details.
        return new Response(
          JSON.stringify({
            error: { message: "Inference budget exhausted", type: "invalid_request_error" },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      try {
        return await fetchImpl(input, request);
      } catch (error) {
        if (budget.now() >= budget.deadline) {
          budget.blocked = true;
          budget.reason ??= "deadline";
        }
        throw error;
      }
    },
  };
}
