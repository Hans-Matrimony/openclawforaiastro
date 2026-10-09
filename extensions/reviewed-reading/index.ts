import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerReplyPolicy } from "./reply-policy.mjs";
import { createReadingHandler } from "./route.mjs";

export default {
  id: "reviewed-reading",
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: "/astrofriend/reading",
      auth: "gateway",
      match: "exact",
      handler: createReadingHandler(),
    });
    registerReplyPolicy(api);
  },
};
