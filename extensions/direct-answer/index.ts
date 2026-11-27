import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createDirectHandler } from "../reviewed-reading/direct-route.mjs";
import { createProfileExtractionHandler } from "../reviewed-reading/profile-extraction.mjs";
export default {
  id: "direct-answer",
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: "/astrofriend/direct-answer",
      auth: "gateway",
      match: "exact",
      handler: createDirectHandler(),
    });
    api.registerHttpRoute({
      path: "/astrofriend/profile-extract",
      auth: "gateway",
      match: "exact",
      handler: createProfileExtractionHandler(),
    });
  },
};
