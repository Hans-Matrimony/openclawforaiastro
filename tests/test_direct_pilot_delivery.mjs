import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {get_horoscope_predictions} from '../extensions/reviewed-reading/direct/assets/dev-v2/engine.mjs';

const chart=get_horoscope_predictions({birth_date:'3/1/2001',birth_time:'05:00',location_name:'Delhi'}).content[0].text;
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',
  VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1',ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1'};
const answer='Career progress is possible, but the chart does not establish when it will settle.\n\nThe tenth house offers support, while retrograde Saturn can cause obstacles and the current period offers limited direct support.';

async function run(pass){
  let mainCalls=0,writers=0,reviews=0,companions=0;
  const result=await directAnswer({user_id:'919000000001',reply_surface:'whatsapp',
    birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'},
    query:'When will my career settle?',language:'english',user_gender:'male',history:[],
  },{env,now:()=>new Date('2026-11-26T06:00:00Z'),
    makeMemory:()=>({read:async()=>[],write:async()=>{throw Error('unexpected write');}}),
    makeTools:()=>async()=>chart,
    fetchImpl:async(_url,options)=>{
      const body=JSON.parse(options.body),instruction=body.messages[0].content;
      let message;
      if(instruction.startsWith('Write a natural astrology reply')){
        writers++; message={content:answer};
      } else if(instruction.startsWith('Check the proposed answer')){
        reviews++;message={content:JSON.stringify({pass,reason:pass?'':'test review rejection'})};
      } else if(body.tools || instruction.includes('# Current request')){
        mainCalls++;
        message=mainCalls===1?{tool_calls:[{id:'chart',type:'function',function:{
          name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}',
        }}]}:{content:answer};
      } else {
        companions++;message={content:'UNEXPECTED_COMPANION'};
      }
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  return {result,writers,reviews,companions};
}

test('final pilot delivery keeps approved answer/reason order and appends checked schedule once',async()=>{
  const {result,writers,reviews,companions}=await run(true);
  assert.ok(writers>0);assert.ok(reviews>0);assert.equal(companions,0);
  assert.ok(result.answer_validation.includes('pilot_final_wording_verified'));
  assert.ok(result.reply.startsWith(answer));
  assert.equal(result.reply.split('15 September 2027').length-1,1);
  assert.match(result.reply,/14 November 2028/);
  assert.match(result.reply,/planetary schedule, not an event deadline/);
});

test('rejected pilot delivery cannot resurrect a draft or waste a companion request',async()=>{
  const {result,writers,reviews,companions}=await run(false);
  assert.ok(writers>0);assert.ok(reviews>0);assert.equal(companions,0);
  assert.ok(result.answer_validation.includes('pilot_safe_delivery_fallback'));
  assert.doesNotMatch(result.reply,/UNEXPECTED_COMPANION/);
  assert.equal(result.reply.split('15 September 2027').length-1,1);
});
