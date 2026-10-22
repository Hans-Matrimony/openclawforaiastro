import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createDirectHandler } from "../reviewed-reading/direct-route.mjs";
export default {
  id: "direct-answer",
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({ path: "/astrofriend/direct-answer", auth: "gateway", match: "exact", handler: createDirectHandler() });
  },
};
