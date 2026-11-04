import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {emotionalTurnInstruction, emotionalRepairPrompt, emotionalFriendshipPrompt, emotionalReplyIssue} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import {friendshipGroundingIssues} from '../extensions/reviewed-reading/direct/friendship-grounding.mjs';

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

test('the loneliness anchor follows only an active disclosure, never an old topic or negation',()=>{
  assert.match(emotionalTurnInstruction({query:listening,language:'hinglish',history:[]}),/explicitly disclosed loneliness/);
  assert.match(emotionalTurnInstruction({query:'ab kya karu?',language:'hinglish',history:[{role:'user',text:'Aaj mujhe akela lag raha hai.'}]}),/explicitly disclosed loneliness/);
  for(const query of ['I am not feeling lonely anymore.','I am sad about losing my job.']){
    assert.doesNotMatch(emotionalTurnInstruction({query,language:'english',history:[{role:'user',text:'I feel lonely.'}]}),/explicitly disclosed loneliness/);
  }
});

test('the compact repair retains current disclosure, attempts and referenced advice without repeating the initial prompt',()=>{
  const value={query:'Wahi advice kaam nahi aayi, ab kya karu?',language:'hinglish',user_gender:'male',
    history:[{role:'user',text:'Aaj mujhe akela lag raha hai.'},{role:'user',text:'Maine dost se baat karne ki koshish ki.'},
      {role:'assistant',text:'You could write down what you wanted to say.'}]};
  const prompt=emotionalRepairPrompt(value,'Use respectful aap forms consistently.',{memoryStatus:'available',memoryFacts:['The user already tried messaging a trusted friend.']});
  assert.match(prompt,/Maine dost se baat karne ki koshish ki/);assert.match(prompt,/You could write down/);
  assert.match(prompt,/Do not repeat a rejected suggestion/);assert.match(prompt,/feminine/);
  assert.match(prompt,/respectful aap/);assert.match(prompt,/no advice, no questions and no name/);
  assert.match(prompt,/already tried messaging a trusted friend/);assert.match(prompt,/current user corrections take priority/);
  assert.ok(prompt.length<emotionalFriendshipPrompt(value,{}).length);
  assert.doesNotMatch(prompt,/# Emotional conversation, not a reading/);
});

test('the live aap-hoon role reversal is rejected while normal narration and quoted wording stay valid',()=>{
  const value={query:listening,language:'hinglish',user_gender:'male',history:[]};
  const bad='Main yahan hoon, aap akelaapan ko saath leke baithi hoon. Jab aap taiyaar hon, baat kariye.';
  assert.ok(friendshipGroundingIssues(bad,value).some(issue=>issue.includes('subject aap')));
  for(const reply of ['Aap akelaapan mehsoos kar rahe hain. Main sun rahi hoon.',
    'Aaj aap akela lag rahe hain samajh sakti hoon.',
    'Aap jo kehna chahein keh sakte hain; main yahan hoon.',
    'Aap jab taiyaar hon, main sun rahi hoon.',
    'Aapki baat sun rahi hoon.', 'Aapko samajh sakti hoon.',
    'Unhone kaha: "aap akelaapan ko saath leke baithi hoon".']) {
    assert.equal(friendshipGroundingIssues(reply,value).length,0,reply);
  }
});

test('a persistent role reversal cannot escape the existing two-call friendship boundary',async()=>{
  let calls=0;
  const value={user_id:'synthetic-role-repair',query:listening,language:'hinglish',user_gender:'male',history:[]};
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>['The user has a trusted friend.']}),
    makeTools:()=>()=>assert.fail('No tool calls or memory writes'),fetchImpl:async(_url,options)=>{
      calls++;if(calls===2){const prompt=JSON.parse(options.body).messages[0].content;assert.match(prompt,/subject aap/);assert.match(prompt,/The user has a trusted friend/);}
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Main yahan hoon, aap akelaapan ko saath leke baithi hoon. Jab aap taiyaar hon, baat kariye.'}}]}));
    }});
  assert.equal(calls,2);assert.deepEqual(result.answer_validation,['emotional_quality_rewrite','emotional_quality_fallback']);
  assert.equal(emotionalReplyIssue(result.reply,value),null);assert.doesNotMatch(result.reply,/saath leke baithi/);
});
