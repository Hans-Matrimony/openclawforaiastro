import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createReadingHandler } from "./route.mjs";
import { createReviewHandler } from "./verifier.mjs";

export default {
  id: "reviewed-reading",
  register(api: OpenClawPluginApi) {
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
      handler: createReadingHandler(),
    });
  },
};
