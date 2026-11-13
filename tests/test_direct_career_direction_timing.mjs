import assert from 'node:assert/strict';
import test from 'node:test';
import {unsupportedEventTiming} from '../extensions/reviewed-reading/direct/event-timing.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';

const question='Mea career ke baare mai batao';
const bad='Career ke liye house 10 strong hai, lekin Venus mahadasha aur Moon antardasha isse directly support nahi kar rahe Saturn wajah se results mein delay dikhta hai.\n\n2031 ke baad Jupiter antardasha se career mein sahi direction milegi, lekin abhi thoda rukawat hai.';
const periods=[JSON.stringify({evidence_scope:{timing:'does not calculate event-specific windows'},dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-15'}]}})];

test('captured career direction claim cannot turn a period boundary into an event forecast',()=>{
  for(const query of [question,'Mera career kab improve hoga?']) {
    for(const reply of [bad,'Career ke factors mixed hain.\n\n2031 ke baad sahi disha milegi.',
      'Your career will find the right direction after 2031.']) {
      assert.equal(unsupportedEventTiming(reply,periods,query),true,reply);
    }
  }
});

test('period definitions and properly qualified requested timing retain their existing behavior',()=>{
  for(const reply of ['Jupiter antardasha begins in November 2031.','Career indications are mixed.']) {
    assert.equal(unsupportedEventTiming(reply,periods,'Explain the Jupiter antardasha schedule.'),false,reply);
  }
  assert.equal(unsupportedEventTiming('Jupiter antardasha starts in November 2031.',periods,question),true);
  assert.equal(unsupportedEventTiming('Career mein November 2031 se Jupiter antardasha naya raasta kholegi.',periods,question),true);
  assert.equal(unsupportedEventTiming('Your birth date is 11 April 1991. Current dasha factors are mixed.',periods,question),false);
  const qualified='Career ke liye November 2031 se July 2034 sambhavit period hai. Jupiter house 10 ka lord hai.\n\nNovember 2031 se July 2034 mein progress sambhavit hai.';
  assert.equal(unsupportedEventTiming(qualified,periods,'Career kab improve hoga?'),false);
  assert.equal(unsupportedEventTiming(qualified,periods,question),true,'A general career reading does not invite a forecast year');
  assert.equal(unsupportedEventTiming(bad,[],question),false,'Other tool contracts retain their established validators');
});

test('actual engine rejects repeated captured career draft without replaying the chart',async()=>{
  const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
  for(const retry of [false,true]) {
    let calls=0,calculations=0;
    const result=await directAnswer({user_id:'synthetic-direction-retry',query:retry?'Mtlb smjha nahi mai\nResponse toh do naa':question,
      birth,language:'hinglish',reply_surface:'whatsapp',history:retry?[{role:'user',text:question},{role:'assistant',text:'Which part should I clarify?'}]:[]},{
      env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:options=>createTools({...options,reading:async(...args)=>{calculations++;return sourceReading(...args);}}),
      fetchImpl:async()=>{
        const message=++calls===1?{tool_calls:[{id:'career',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:bad};
        return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
      },
    });
    assert.equal(calculations,1);
    assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
    assert.ok(result.answer_validation.includes('timing_claim_rejected'));
    assert.doesNotMatch(result.reply,/2031|sahi direction milegi/iu);
    assert.match(result.reply,/career/i);
    assert.ok(calls<=7);
  }
});
