import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { createEvidenceHandler, reservedSubjects } from "./route.mjs";

export default {
  id: "astrology-response",
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: "/astrofriend/response-evidence",
      auth: "gateway",
      match: "exact",
      handler: createEvidenceHandler(undefined, reservedSubjects(api.config)),
    });
  },
};
