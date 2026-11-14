import { selectedSelfBirth } from './selected-self-birth.mjs';

// Career timing already requires this natal schedule. Prepare it directly for
// unambiguous voice self-questions, avoiding a model round trip just to ask for
// the same tool. Other subjects, profiles and calculations retain normal choice.
export async function prepareVoiceChart(value, execute, signal) {
  if (value.reply_surface !== 'voice' || value.reply_to ||
      (value.profile_update_status && value.profile_update_status !== 'saved') ||
      /\b(?:guna?|matching|compatibility|marriage|shaadi|wedding|horary|prashna)\b/iu.test(value.query) ||
      !/\b(?:career|job|naukri|promotion)\b/iu.test(value.query)) return null;
  const birth = selectedSelfBirth(value.query, value.birth);
  if (!birth) return null;
  const call = {id:'voice_selected_career_chart',type:'function',function:{
    name:'mcp__VedAstro__get_horoscope_predictions',
    arguments:JSON.stringify({birth_date:birth.date,birth_time:birth.time,location_name:birth.location_name||birth.place,query_text:value.query}),
  }};
  try {
    const result = await execute(call.function.name, JSON.parse(call.function.arguments));
    signal?.throwIfAborted();
    if (result?.isError) return null;
    const content = typeof result === 'string' ? result : JSON.stringify(result);
    const data = JSON.parse(content);
    if (data?.engine !== 'local-sweph-v2' || !data.birth_chart || !data.dasha) return null;
    return {call,content};
  } catch (error) {
    signal?.throwIfAborted();
    return null; // Keep the existing tool loop and its errors available.
  }
}
