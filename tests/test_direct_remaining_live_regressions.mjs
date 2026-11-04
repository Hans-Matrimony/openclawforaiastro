import test from 'node:test';
import assert from 'node:assert/strict';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {quotedMatchingLimitations} from '../extensions/reviewed-reading/direct/matching-clarification.mjs';
import {isEmotionalFriendship,emotionalReplyIssue,emotionalReplyFallback} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
import {currentFriendshipDisclosure} from '../extensions/reviewed-reading/direct/friendship-grounding.mjs';

const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'1'};
const hindi='आज मुझे बहुत अकेलापन लग रहा है। अभी सलाह नहीं चाहिए, बस मेरी बात सुनो। हिंदी में जवाब दो और कोई सवाल मत पूछो।';
const advice='Ab ek chhota practical step batao jo aaj apna sakun. Hinglish mein bolo.';
const ml='എനിക്ക് ഇന്ന് വളരെ ഒറ്റപ്പെടലാണ്. ഉപദേശം വേണ്ട; മലയാളത്തിൽ കേട്ടാൽ മതി, ചോദ്യങ്ങൾ ചോദിക്കേണ്ട.';
const quote={role:'assistant',text:'Guna Milan ka total score 27/36 hai.'};

test('quoted limitations explain the traditional measure without endorsing or recalculating a quote',async()=>{
  const value={user_id:'synthetic-quoted-limits',query:'Is quoted Guna Milan ke 27/36 score ki limitations samjhao. Naye birth details assume mat karna.',reply_to:quote,language:'hinglish',history:[]};
  let calls=0;
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No chart calculation for limitations'),
    fetchImpl:async(_url,options)=>{
      calls++;assert.equal(JSON.parse(options.body).tool_choice,'none');
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Please confirm the partner birth details.'}}]}));
    }});
  assert.equal(calls,1);assert.match(result.reply,/guarantee nahi/);assert.doesNotMatch(result.reply,/27|confirm|\?/);
  for(const patch of [{reply_to:{...quote,role:'user'}},{reply_to:{...quote,text:'Guna Milan 39/36'}},
    {query:'Recalculate the score and its limitations.'},{query:'Calculate Guna Milan for a new partner and its limitations.'},
    {query:'DOB 2000-01-01, explain score limitations.'},{query:'Mera score kitna hai?'},
    {query:'Explain all eight factors and their limitations.'},{query:'Limitations baad mein, score kitna hai?'},
    {query:'Tell me the current score and its limitations.'},{query:"Don't explain the limitations."}])
    assert.equal(quotedMatchingLimitations({...value,...patch}),null);
});

test('one-step continuations inherit only a real latest emotional topic across languages',()=>{
  assert.ok(isEmotionalFriendship(advice,[{role:'user',text:hindi}]));
  assert.equal(currentFriendshipDisclosure({query:advice,history:[{role:'user',text:hindi}]}),hindi);
  for(const history of [[],[{role:'assistant',text:hindi}],[{role:'user',text:hindi},{role:'user',text:'My career prospects'}]])
    assert.equal(isEmotionalFriendship(advice,history),false);
  for(const query of ['My career: one practical step for an interview','Meri shaadi kab hogi?','Meri kundli verify karo'])
    assert.equal(isEmotionalFriendship(query,[{role:'user',text:hindi}]),false);
});

for(const malayalam of [false,true])test(`captured friendship draft gets one bounded rewrite with no companion duplication: Malayalam=${malayalam}`,async()=>{
  const value={user_id:'synthetic-friend-followup',query:malayalam?ml:advice,history:malayalam?[]:[{role:'user',text:hindi}],language:malayalam?'malayalam':'hinglish',user_gender:'male'};
  const bad=malayalam?'നിനക്ക് ഇപ്പോൾ സമയമെടുക്കാം, ഞാൻ ഇവിടെയുണ്ട്.\n\nനീ ഇവിടെ ഉണ്ട്, ഞാൻ കേട്ടുകൊണ്ടിരിക്കുകയാണ്.':
    'tum akela mehsoos kar rahe ho. Ek cup chai peete hue purana gaana sun lo, phir photo dekho.';
  assert.ok(emotionalReplyIssue(bad,value));let calls=0;
  const result=await directAnswer(value,{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No chart tool in friendship'),
    fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:bad}}]}));}});
  assert.equal(calls,2);assert.ok(result.answer_validation.includes('emotional_quality_fallback'));
  assert.doesNotMatch(result.reply,/tum|photo|gaana|chai|\?/);
  if(malayalam){assert.match(result.reply,/ഒറ്റപ്പെട്ടതായി/);assert.equal(result.reply.split('\n\n').length,1);}
  else {assert.match(result.reply,/akelaapan.*message/);assert.doesNotMatch(result.reply,/sabse zaroori goal/);}
});

test('native listening exclusions and Hindi wording retain safe topical boundaries',()=>{
  assert.ok(isEmotionalFriendship(ml));
  assert.equal(isEmotionalFriendship('എനിക്ക് ഒറ്റപ്പെടൽ ഇല്ല.'),false);
  assert.equal(isEmotionalFriendship('എനിക്ക് ഒറ്റപ്പെട്ടതായി തോന്നുന്നില്ല.'),false);
  assert.equal(isEmotionalFriendship(ml+' എന്റെ ജാതകം നോക്കൂ.'),false);
  assert.equal(isEmotionalFriendship(ml+' ആത്മഹത്യ.'),false);
  const value={query:hindi,language:'hindi',history:[]};
  assert.ok(emotionalReplyIssue('बस ऐसे ही रहिए जब तक आप तैयार न हो जाएँ।',value));
  assert.match(emotionalReplyFallback(value),/अकेलापन/);
  for(const listening of [value,{query:ml,language:'malayalam',history:[]}])
    assert.equal(emotionalReplyIssue(emotionalReplyFallback(listening),listening),null);
});
