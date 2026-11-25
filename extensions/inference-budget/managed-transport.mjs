import { createBudgetTransport } from "./transport.mjs";

async function normalizeRequest(input, init, budget) {
  if (init?.body instanceof Uint8Array) {
    if (init.body.byteLength > budget.limits.requestBytes) budget.stop("input_bytes");
    return [input, {...init, body:Buffer.from(init.body).toString("utf8")}];
  }
  if (!(input instanceof Request)) return [input, init];
  const request = new Request(input, init);
  if (!request.body) return [input, init];
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  let readError;
  const abort = () => {
    readError = request.signal.reason ?? new Error("Provider request aborted");
    void reader.cancel().catch(() => {});
  };
  request.signal.addEventListener("abort", abort, {once:true});
  const timer = setTimeout(() => {
    readError = new Error("AstroFriend inference budget exhausted");
    budget.blocked = true;
    budget.reason ??= "deadline";
    void reader.cancel().catch(() => {});
  }, Math.max(1, Math.ceil(budget.deadline - budget.now())));
  try {
    if (request.signal.aborted) abort();
    for (;;) {
      if (readError) throw readError;
      const { done, value } = await reader.read();
      if (readError) throw readError;
      if (done) break;
      bytes += value.byteLength;
      if (bytes > budget.limits.requestBytes) {
        void reader.cancel().catch(() => {});
        budget.stop("input_bytes");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  return [request.url, {
    ...init,
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    body: Buffer.concat(chunks, bytes).toString("utf8"),
  }];
}

// Preserve the host's authentication, network policy and fetch implementation.
// Capture ownership before SDK asynchronous work, rather than relying on global fetch.
export function createManagedBudgetScope(sdk) {
  if (!sdk.supportsScopedAiTransportHosts()) {
    throw new Error("Inference budgets require scoped AI transport hosts");
  }
  return (scope, run) => {
    const owner = sdk.getAiTransportHost();
    const host = sdk.createAiTransportHost({
      ...owner,
      buildModelFetch(...args) {
        const nativeFetch = owner.buildModelFetch(...args);
        if (typeof nativeFetch !== "function") {
          throw new Error("Inference budget requires managed provider fetch");
        }
        const transport = createBudgetTransport(nativeFetch);
        const guarded = (input, init) => transport.scope.run(scope, async () => {
          const request = await normalizeRequest(input, init, scope.budget);
          return transport.fetch(...request);
        });
        // inheritManagedTransport copies model descriptors, not callable fetch
        // functions. Delegating to nativeFetch already retains the host policy.
        return guarded;
      },
    });
    return sdk.runWithAiTransportHost(host, run);
  };
}
