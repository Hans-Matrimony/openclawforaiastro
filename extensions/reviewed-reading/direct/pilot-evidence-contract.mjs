import {pilotBubbleInstruction} from './pilot-bubbles.mjs';
export function evidenceOnly(content) {
  try {
    const row=JSON.parse(content);
    if(row?.engine!=='local-sweph-v2')return content;
    const {instruction,...evidence}=row;
    return JSON.stringify(evidence);
  } catch { return content; }
}
export function unifiedPilotPrompt(prompt) {
  return prompt.replace(/# Completed Reading Output Contract[\s\S]*?(?=\n# Language)/u,
    '# Completed Reading Output Contract\n'+pilotBubbleInstruction+'Interpret checked facts in context. A period schedule alone is not evidence of an event. Preserve supported positive, adverse and mixed indications without forcing a categorical yes/no or copying a trend label as the answer. Never invent timing or instruct the user to wait before taking action.\n')
    .replace('For a completed reading, return the source reading explanation and short verdict in two paragraphs.', 'For a completed reading, answer directly first and then explain the checked reasons in separate short paragraphs.')
    .replace('aim for 40 words of explanation and 15 words of verdict','aim for a brief direct answer followed by concise reasons');
}
