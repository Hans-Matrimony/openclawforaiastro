import * as sdk from '@mariozechner/pi-ai';
import { getBudgetRuntime } from './runtime.mjs';

export default function register(pi) {
  const runtime = getBudgetRuntime();
  runtime.installSdk(sdk);
  const bind = (_event, context) => {
    runtime.installSdk(sdk);
    runtime.bindModel(context.model, context.sessionManager.getSessionId());
  };
  pi.on('input', (event, context) => { bind(event, context); return { action: 'continue' }; });
  pi.on('session_before_compact', bind);
}
