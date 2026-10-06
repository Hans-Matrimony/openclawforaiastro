import { createReadingHandler } from './route.mjs';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

export default {
  id: 'reviewed-reading',
  register(api: OpenClawPluginApi) {
    api.registerHttpRoute({
      path: '/astrofriend/reading',
      auth: 'gateway',
      match: 'exact',
      handler: createReadingHandler(),
    });
  },
};
