// Provider IDs are private aliases, so the guard does not replace bundled plugins.
export const BUDGET_PROVIDERS = ["zai", "openai", "deepseek", "groq", "google", "openrouter"];
export const BUDGET_PREFIX = "astro-budget-";

export function registerBudgetProviders(api, runtime, withTransport) {
  for (const provider of BUDGET_PROVIDERS) {
    const wrap = ({ streamFn }) => {
      if (typeof streamFn !== "function") throw new Error("Budget provider requires a native stream");
      return runtime.wrapStream(streamFn, true, withTransport);
    };
    api.registerProvider({
      id: BUDGET_PREFIX + provider,
      label: `Bounded ${provider}`,
      auth: [],
      wrapStreamFn: wrap,
      wrapSimpleCompletionStreamFn: wrap,
    });
  }
}
