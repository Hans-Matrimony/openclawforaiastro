export const now = () => new Date("2026-11-24T10:35:00Z");
export const query = "Mujhe ye Baatao Ki Meri crush se Meri baat kb start hogi";
export const chart = {
  engine: "local-sweph-v2",
  birth_chart: { label: "natal", planets: ["Saturn: Aquarius | house 7"] },
  dasha: { upcoming_antardashas: [{ lord: "Saturn", from: "2027-03-07", to: "2030-01-11" }] },
  verdict_signals: [
    {
      area: "marriage",
      trend: "MIXED",
      positive: ["benefic Venus house 7 mein"],
      negative: ["Saturn ki drishti house 7 par"],
    },
  ],
};
export const results = [JSON.stringify(chart)];
export const schedule =
  "Aapke chart mein Saturn antardasha 2027-03-07 se 2030-01-11 tak chalti hai.";
export const input = {
  user_id: "919000000001",
  reply_surface: "whatsapp",
  query,
  language: "hinglish",
  user_gender: "male",
  history: [],
  birth: { date: "2001-01-03", time: "05:00", location_name: "Example City" },
};
export const env = {
  OPENROUTER_API_KEY: "test",
  VEDASTRO_DIRECT_FLOW: "source",
  VEDASTRO_DIRECT_ENVIRONMENT: "development",
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING: "1",
  VEDASTRO_DIRECT_REPLY_CACHE: "0",
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED: "1",
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED: "1",
  ASTROFRIEND_CONVERSATION_PROGRESS_USERS: input.user_id,
  ASTROFRIEND_CONVERSATION_MODEL: "test/conversation",
  ASTROFRIEND_CONVERSATION_REVIEW_ENABLED: "0",
};
export const prose = (text) =>
  Response.json({ choices: [{ finish_reason: "stop", message: { content: text } }] });
export const tool = () =>
  Response.json({
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          tool_calls: [
            {
              id: "chart",
              type: "function",
              function: { name: "mcp__VedAstro__get_horoscope_predictions", arguments: "{}" },
            },
          ],
        },
      },
    ],
  });
