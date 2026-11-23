import assert from 'node:assert/strict';
import test from 'node:test';
import {isPersonalChartQuestion, asksForTiming} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {topicPeriodEvidence} from '../extensions/reviewed-reading/direct/topic-period-context.mjs';
import {timingCorrection} from '../extensions/reviewed-reading/direct/timing-correction.mjs';

const birth = {date:'14 September 2002', time:'6:00 am', location_name:'Delhi'};
const queries = ['Mera Vivah Kab Hogaa', 'Mera Vivah Kab Hogaa\nLekin Kyu'];

test('vivah retains marriage interpretation when a draft needs bounded repair', () => {
  const rows = [JSON.stringify({engine:'local-sweph-v2',
    dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]},
    verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:[]}],
  })];
  const now = new Date('2026-11-23T07:00:00Z');
  const canonical = 'Meri shaadi kab hogi';
  for (const query of queries) {
    assert.deepEqual(topicPeriodEvidence(rows, query), topicPeriodEvidence(rows, canonical));
    assert.ok(timingCorrection(rows, query, 'hinglish', now));
    assert.equal(timingCorrection(rows, query, 'hinglish', now).fallback(),
      timingCorrection(rows, canonical, 'hinglish', now).fallback());
    assert.equal(evidenceFallback(rows, 'hinglish', query, now), evidenceFallback(rows, 'hinglish', canonical, now));
    assert.match(evidenceFallback(rows, 'hinglish', query, now), /shaadi|rishte|7ve|7/i);
  }
});

test('vivah timing requires the same chart and selected profile as shaadi', () => {
  for (const query of [...queries, 'Mea vivah kab hoga', 'Vivah kab hoga?']) {
    assert.equal(isPersonalChartQuestion(query), true, query);
    assert.equal(asksForTiming(query), true, query);
  }
  for (const query of queries) assert.deepEqual(selectedSelfBirth(query, birth), birth);
  for (const query of ['What is vivah?', 'Explain vivah rituals', 'Meri sister ka vivah kab hoga?']) {
    assert.equal(isPersonalChartQuestion(query), false, query);
    assert.equal(selectedSelfBirth(query, birth), null, query);
  }
  assert.equal(selectedSelfBirth(queries[0], null), null);
  const corrected = activeReadingQuestion({query:'vivah nahi career kab set hoga',history:[]});
  assert.equal(corrected, 'career kab set hoga');
});

for (const query of queries) test(`unverified model reply cannot bypass chart tools: ${query}`, async () => {
  const requests = [];
  await assert.rejects(directAnswer({user_id:'synthetic-vivah',query,birth,language:'hinglish',reply_surface:'whatsapp',history:[]}, {
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>assert.fail('No tool returned by mock'),
    fetchImpl:async(_url, options)=>{
      requests.push(JSON.parse(options.body));
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'August 2028 mein shaadi hogi.'}}]}));
    },
  }), /requires a successful chart tool/);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].tool_choice, 'required');
});

for (const query of queries) test('verified vivah reply includes chart evidence: ' + query, async () => {
  let calls = 0;
  const chart = JSON.stringify({engine:'local-sweph-v2',
    dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]},
    verdict_signals:[{area:'marriage',trend:'MIXED',positive:['benefic Jupiter house 7 mein'],negative:[]}]});
  const result = await directAnswer({user_id:'synthetic-vivah-success',query,birth,language:'hinglish',reply_surface:'whatsapp',history:[]}, {
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>chart,
    fetchImpl:async()=>new Response(JSON.stringify({choices:[++calls===1
      ? {finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}}
      : {finish_reason:'stop',message:{content:'Jupiter 7ve ghar mein hai.\n\nMars antardasha September 2027 se November 2028 mein shaadi sambhavit hai.'}}]})),
  });
  assert.ok(result.answer_reading_tools.includes('get_horoscope_predictions'));
  assert.match(result.reply, /September 2027 se November 2028/);
  assert.doesNotMatch(result.reply, /busy|Bina jaanch/i);
});
