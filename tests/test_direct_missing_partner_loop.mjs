import assert from 'node:assert/strict';
import test from 'node:test';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const birth={date:'1991-04-11',time:'08:00',location_name:'Pune'};
const value={user_id:'synthetic-missing-partner',query:'Kya meri gf se meri shadi hogi',birth,
  user_gender:'male',language:'hinglish',reply_surface:'whatsapp',history:[]};

for(const language of ['hinglish','english'])test(`missing partner details end the repeated matching loop in ${language}`,async()=>{
  let calls=0,executions=0;
  const result=await directAnswer({...value,language},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'},
    makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async(name)=>{
      executions++;assert.equal(name,'mcp__VedAstro__get_match_report');
      throw Object.assign(new Error('Unconfirmed matching inputs'),{code:'matching_birth_required'});
    },
    fetchImpl:async()=>{
      calls++;assert.equal(calls,1,'Never ask the model to repeat rejected matching inputs');
      return new Response(JSON.stringify({provider:'fixture',usage:{cost:0},choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{
        id:'matching-1',type:'function',function:{name:'mcp__VedAstro__get_match_report',arguments:'{}'},
      }]}}]}));
    },
  });
  assert.equal(calls,1);assert.equal(executions,1);assert.equal(result.answer_model_calls,1);
  assert.deepEqual(result.answer_reading_tools,[]);assert.equal(result.answer_usage.length,1);
  assert.ok(result.answer_validation.includes('matching_birth_required'));
  assert.match(result.reply,/partner/iu);
  assert.doesNotMatch(result.reply,/busy|203\d|202\d|will marry|shadi hogi|tool|provider/iu);
  assert.ok(result.reply.split(/\s+/u).length<=35);
});

test('an incomplete self profile never claims only the partner details are missing',async()=>{
  const result=await directAnswer({...value,birth:{...birth,time:''}},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
    makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{throw Object.assign(new Error('Missing inputs'),{code:'matching_birth_required'});},
    fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{
      id:'matching-1',type:'function',function:{name:'mcp__VedAstro__get_match_report',arguments:'{}'},
    }]}}]})),
  });
  assert.match(result.reply,/dono logon/iu);assert.doesNotMatch(result.reply,/partner ki/iu);
});
