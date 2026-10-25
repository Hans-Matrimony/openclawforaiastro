import { wrapAstrologerReadingStream } from "./astrologer-reading-stream.js";

export const PREFIX = "astrofriend-reading-";
export function latestUserText(context) {
  const user = context.messages?.findLast((message) => message.role === "user");
  if (typeof user?.content === "string") {
    return user.content;
  }
  return (user?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export default {
  id: "astrologer-reading",
  register(api) {
    const providers = Object.keys(api.config.models?.providers ?? {}).filter((id) =>
      id.startsWith(PREFIX),
    );
    for (const id of providers) {
      const upstream = id.slice(PREFIX.length);
      api.registerProvider({
        id,
        label: `AstroFriend reading (${upstream})`,
        auth: [],
        wrapStreamFn(ctx) {
          // 2026.3.28 does not pass workspaceDir to this hook. Its dedicated
          // provider aliases are assigned only to the three astrology agents.
          if (
            !ctx.streamFn ||
            process.env.ASTROFRIEND_READING_STYLE_GUARD === "0" ||
            (ctx.workspaceDir &&
              !/(?:^|[/\\])workspace-astrologer(?:-preview)?[/\\]?$/u.test(ctx.workspaceDir))
          ) {
            return ctx.streamFn;
          }
          // Keep provider-specific wire compatibility and the already-resolved credential.
          const base = (model, context, options) =>
            ctx.streamFn({ ...model, provider: upstream }, context, options);
          return (model, context, options) =>
            wrapAstrologerReadingStream(base, latestUserText(context))(model, context, options);
        },
      });
    }
    api.logger.info(`[astrologer-reading] registered ${providers.length} scoped provider wrappers`);
  },
};
