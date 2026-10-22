const MAX_BODY = 196608;
const MAX_CONCURRENT = 2;
export function createReadingHandler(
  calculate,
  {
    validate,
    maxBody = MAX_BODY,
    concurrency = { active: 0 },
    failureStatus = 422,
    failureCode = "birth_details_unresolved",
  } = {},
) {
  return async (req, res) => {
    const send = (status, body) => {
      if (res.destroyed || res.writableEnded) {
        return;
      }
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      send(405, { error: "method_not_allowed" });
      return;
    }
    if (concurrency.active >= MAX_CONCURRENT) {
      send(503, { error: "reading_busy" });
      return;
    }
    concurrency.active += 1;
    const timer = setTimeout(() => {
      send(408, { error: "request_timeout" });
      req.destroy();
    }, 10_000);
    timer.unref();
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > maxBody) {
          send(413, { error: "request_too_large" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      clearTimeout(timer);
      let value;
      const header = req.headers?.["x-astro-reading-contract"];
      const contractVersion = header === "2" ? 2 : 1;
      try {
        if (header !== undefined && !["1", "2"].includes(header)) {
          throw new Error("Unsupported reading contract");
        }
        value = validate(JSON.parse(Buffer.concat(chunks).toString("utf8")), contractVersion);
      } catch {
        send(400, { error: "invalid_reading_request" });
        return;
      }
      try {
        send(200, await calculate(value, undefined, contractVersion));
      } catch {
        // Never expose child output, birth details or filesystem information.
        send(failureStatus, { error: failureCode });
      }
    } catch {
      send(400, { error: "invalid_reading_request" });
    } finally {
      clearTimeout(timer);
      concurrency.active -= 1;
    }
  };
}
