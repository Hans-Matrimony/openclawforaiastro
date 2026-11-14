// A calendar boundary is not an answer to career timing. Keep this branch
// explicit rather than attaching the next unrelated period to the verdict.
export function careerTimingUnavailable(explanation, english) {
  const natural = explanation
    .replace('10ve ghar ki majbooti ka alag sanket achha hai', 'Career ke ghar mein majbooti hai')
    .replace('The separate house-strength indicator for house 10 is supportive', 'The career house has a supportive strength indicator');
  return natural + '\n\n' + (english
    ? 'This chart does not establish a year for career stability.'
    : 'Is chart se career settle hone ka saal nahi nikal raha.');
}
