import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerReplyPolicy } from "./reply-policy.mjs";
import { createReadingHandler } from "./route.mjs";
import { createTimingHandler } from "./timing-route.mjs";
import { createTopicHandler } from "./topic-route.mjs";

export default {
  id: "reviewed-reading",
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: "/astrofriend/timing-reading",
      auth: "gateway",
      match: "exact",
      handler: createTimingHandler(),
    });
    api.registerHttpRoute({
      path: "/astrofriend/topic-reading",
      auth: "gateway",
      match: "exact",
      handler: createTopicHandler(),
    });
    api.registerHttpRoute({
      path: "/astrofriend/reading",
      auth: "gateway",
      match: "exact",
      handler: createReadingHandler(),
    });
    registerReplyPolicy(api);
  },
};
