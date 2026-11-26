import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const env={
  OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',
  VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
  VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0',
  ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',
  ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',
  ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
};

test('matching keeps identical model inputs and verified score when topic pilot is enabled',async()=>{
  async function capture(enabled){
    const bodies=[];
    const result=await directAnswer({
      user_id:'919000000001',reply_surface:'whatsapp',user_gender:'male',
      birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'},
      language:'english',history:[],
      query:'My saved profile and my partner Guna Milan score: Partner DOB: 01-07-2003; Time: 05:38 AM; Place: Mumbai; Gender: female.',
    },{
      env:{...env,ASTROFRIEND_PILOT_TOPIC_PROMPTS:enabled?'1':'0'},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:()=>async()=>JSON.stringify({guna_milan:{status:'ok',score_points:24.5,score_max:36}}),
      fetchImpl:async(_url,options)=>{
        bodies.push(JSON.parse(options.body));
        const message=bodies.length===1?{tool_calls:[{id:'matching',type:'function',function:{
          name:'mcp__VedAstro__get_match_report',arguments:JSON.stringify({
            male_birth_date:'1/1/2000',male_birth_time:'05:00',male_location_name:'Delhi',
            female_birth_date:'1/7/2003',female_birth_time:'05:38',female_location_name:'Mumbai',
          }),
        }}]}:{content:'The verified Guna Milan score is 24.5/36. This assessment does not guarantee relationship success.'};
        return new Response(JSON.stringify({choices:[{finish_reason:bodies.length===1?'tool_calls':'stop',message}]}));
      },
    });
    return {bodies,result};
  }
  const on=await capture(true),off=await capture(false);
  assert.deepEqual(on.bodies,off.bodies);
  assert.equal(on.result.reply,off.result.reply);
  assert.match(on.result.reply,/24\.5\/36/);
  assert.ok(!on.result.answer_validation.includes('pilot_safe_delivery_fallback'));
});
