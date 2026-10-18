import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createDailyHandler } from "./daily-route.mjs";
import { createReadingHandler } from "./route.mjs";
import { createReviewHandler } from "./verifier.mjs";
import { createSummaryHandler } from "./summary-route.mjs";
import { createDirectHandler } from "./direct-route.mjs";

export default {
  id: "reviewed-reading",
  register(api: OpenClawPluginApi) {
    // Both calculation routes share the existing two-process ceiling.
    const concurrency = { active: 0 };
    api.registerHttpRoute({
      path: "/astrofriend/direct-answer",
      auth: "gateway",
      match: "exact",
      handler: createDirectHandler(undefined, { concurrency }),
    });
    api.registerHttpRoute({
      path: "/astrofriend/provider-summary",
      auth: "gateway",
      match: "exact",
      handler: createSummaryHandler(undefined, { concurrency }),
    });
    api.registerHttpRoute({
      path: "/astrofriend/daily",
      auth: "gateway",
      match: "exact",
      handler: createDailyHandler(undefined, { concurrency }),
    });
    api.registerHttpRoute({
      path: "/astrofriend/review-answer",
      auth: "gateway",
      match: "exact",
      handler: createReviewHandler(),
    });
    api.registerHttpRoute({
      path: "/astrofriend/reading",
      auth: "gateway",
      match: "exact",
      handler: createReadingHandler(undefined, { concurrency }),
    });
  },
};
