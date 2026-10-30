import { setTimeout as delay } from "node:timers/promises";

// One shared retry per answer, only after a definite pre-generation rejection.
// Network errors, partial outputs and non-transient HTTP errors are never replayed.
export function createModelRequest({ fetchImpl, enabled, takeCall, canCall,
  sleep = (ms, signal) => delay(ms, undefined, { signal }), now = Date.now }) {
  let retried = false;
  return async (url, options) => {
    takeCall();
    const response = await fetchImpl(url, options);
    if (!enabled || retried || ![429, 503].includes(response.status) || !canCall()) return response;
    const header = response.headers.get("retry-after");
    let wait = 1000;
    if (header !== null) {
      const seconds = Number(header);
      wait = Number.isFinite(seconds) && header.trim() !== ""
        ? seconds * 1000 : Date.parse(header) - now();
      // Do not retry earlier than requested, or hold a chat open indefinitely.
      if (!Number.isFinite(wait) || wait > 5000 || wait < 0) return response;
    }
    retried = true;
    await response.body?.cancel();
    await sleep(Math.max(250, wait), options.signal);
    options.signal?.throwIfAborted();
    takeCall();
    return fetchImpl(url, options);
  };
}
