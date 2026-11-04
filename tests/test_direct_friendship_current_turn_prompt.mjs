import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {emotionalTurnInstruction, emotionalReplyIssue} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};
const listening='Aaj mujhe akela lag raha hai. Bas meri baat suniye, advice nahi chahiye aur sawal mat poochiye.';
const advice='Aaj mujhe akela lag raha hai. Ek chhota practical step bataiye.';
const goodListening='Aaj aapko akelaapan mehsoos ho raha hai. Aap jitna chahein aaram se keh sakte hain; abhi koi solution nikaalna zaroori nahi hai.';
const goodAdvice='Aapne akelaapan mehsoos hone ki baat kahi. Aap chahein toh kisi bharosemand dost ko message karke pooch sakte hain ki unke paas baat karne ka waqt hai.';

for(const user_gender of ['male','female','unknown'])test(`current friendship requirements follow older instructions for ${user_gender}`,async()=>{
  let calls=0;
  const value={user_id:'synthetic-current-friendship',query:advice,language:'hinglish',user_gender,
    history:[{role:'user',text:'Bas suno, advice nahi chahiye.'},{role:'assistant',text:'OLD_UNHELPFUL_STYLE main yahan hoon, main sun raha hoon.'}]};
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('Friendship must not call chart tools'),
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body),prompt=body.messages[0].content;
      assert.ok(prompt.indexOf('# Prior conversation data')<prompt.indexOf('# Emotional conversation'));
      assert.ok(prompt.lastIndexOf('# Current friendship reply requirements')>prompt.indexOf('Latest user disclosure'));
      assert.match(prompt.slice(prompt.lastIndexOf('# Current friendship reply requirements')),/This turn asks for advice/);
      assert.doesNotMatch(prompt,/OLD_UNHELPFUL_STYLE/);
      assert.equal(body.messages.length,2);
      assert.equal(body.messages[1].content,advice);
      if(user_gender==='male')assert.match(prompt,/feminine \(sakti\/rahi hoon\)/);
      else if(user_gender==='female')assert.match(prompt,/masculine \(sakta\/raha hoon\)/);
      else assert.match(prompt,/Avoid gendered self-reference/);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:goodAdvice}}]}));
    }});
  assert.equal(calls,1);assert.equal(result.reply,goodAdvice);assert.deepEqual(result.answer_validation,[]);
});

test('listening keeps the accepted natural wording, without a forced fallback or presence formula',async()=>{
  const value={user_id:'synthetic-current-listening',query:listening,language:'hinglish',user_gender:'male',history:[]};
  assert.equal(emotionalReplyIssue(goodListening,value),null);
  let calls=0;
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No chart tools'),
    fetchImpl:async(_url,options)=>{
      calls++;const prompt=JSON.parse(options.body).messages[0].content;
      assert.match(prompt.slice(prompt.lastIndexOf('# Current friendship reply requirements')),/support or listening/);
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:goodListening}}]}));
    }});
  assert.equal(calls,1);assert.equal(result.reply,goodListening);assert.deepEqual(result.answer_validation,[]);
});

test('a rejected emotional draft gets the same current contract and one successful rewrite',async()=>{
  let calls=0;
  const result=await directAnswer({user_id:'synthetic-current-rewrite',query:advice,language:'hinglish',user_gender:'male',history:[]},{
    env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No chart tools'),fetchImpl:async(_url,options)=>{
      calls++;const prompt=JSON.parse(options.body).messages[0].content;
      if(calls===2){assert.match(prompt,/grammatical gender/);assert.ok(prompt.lastIndexOf('# Current friendship reply requirements')>prompt.indexOf('Rewrite this emotional reply once'));}
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:calls===1?'Samajh sakta hoon. Ek aadmi ya aurat ko message kar lo.':goodAdvice}}]}));
    }});
  assert.equal(calls,2);assert.equal(result.reply,goodAdvice);
  assert.deepEqual(result.answer_validation,['emotional_quality_rewrite']);
});

test('current language and no-name preferences remain explicit without adding a sample answer',()=>{
  for(const language of ['english','hindi','hinglish','malayalam']){
    const value={query:listening,language,user_gender:'unknown'};
    const prompt=emotionalTurnInstruction(value);
    assert.match(prompt,/no questions/);assert.doesNotMatch(prompt,/You are Meera|You are Aarav/);
    assert.doesNotMatch(prompt,/Aaj aapko akelaapan/);
  }
});
