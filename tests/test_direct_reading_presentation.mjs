import test from 'node:test';
import assert from 'node:assert/strict';
import { directAnswer } from '../extensions/reviewed-reading/direct/agent.mjs';
import { unsupportedReadingConsequence, readingPresentationIssue } from '../extensions/reviewed-reading/direct/reading-presentation.mjs';

test('reading wording check targets observed unsupported consequences, retaining ordinary cautions', () => {
  assert.equal(unsupportedReadingConsequence('Saturn gives emotional burden.'),true);
  assert.equal(unsupportedReadingConsequence('Koi khushi ka support nahi hai.'),true);
  assert.equal(unsupportedReadingConsequence('Saturn may indicate delay; no event is guaranteed.'),false);
});

test('career wording review catches certainty and mixed period labels without rejecting qualified cautions', () => {
  assert.match(readingPresentationIssue('Saturn aur Venus Moon dasha mein external push kam hai.'), /Separate the natal planet/);
  assert.match(readingPresentationIssue('Isliye results slow aayenge.'), /Qualify the outcome/);
  assert.match(readingPresentationIssue('Aise kaam kaam karne ka possibility hai.'), /adjacent repetition/);
  for (const reply of ['Progress slow ho sakti hai.', 'Venus mahadasha aur Moon antardasha chal rahi hai.', 'Saturn ki sthiti aur Venus-Moon dasha ke sanket alag hain.']) assert.equal(readingPresentationIssue(reply),null,reply);
});

for (const persistent of [false,true]) test(`displayed career wording is checked after dash cleanup; persistent=${persistent}`, async () => {
  let calls=0,calculations=0;
  const bad='House 10 mein Leo ka strong support hai, lekin Saturn aur Venus-Moon dasha mein external support kam hai.\n\nAapki tarah ke kaam-kaam karne ka possibility hai.';
  const good='House 10 mein sahyog ke sanket hain, lekin Saturn ki sthiti rukawat ka sanket bhi deti hai.\n\nLeadership ya creative kaam sambhavit vikalp hain; inhe guarantee na samjhein.';
  const result=await directAnswer({user_id:'synthetic',query:'Meri kundli ke hisaab se career mein kis tarah ka kaam suit karega?',language:'hinglish',user_gender:'male',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',birth_chart:{planets:['Saturn: Taurus | house 7']},verdict_signals:[{area:'career',trend:'MIXED',positive:['House 10 strong support'],negative:['Saturn limits support']}]});},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      if(calls===3){assert.equal(body.tool_choice,'none');assert.match(body.messages.at(-1).content,/Separate the natal planet/);assert.match(body.messages.at(-1).content,/adjacent repetition/);}
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2||persistent?bad:good};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    }
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.equal(readingPresentationIssue(result.reply),null);
  assert.doesNotMatch(result.reply,/Saturn aur Venus Moon|kaam kaam/);
  assert.ok(result.answer_validation.includes('reading_wording_rejected'));
  assert.equal(result.answer_validation.includes('reading_wording_fallback'),persistent);
  if(!persistent)assert.match(result.reply,/Leadership ya creative/);
});

for (const persistent of [false,true]) test(`wording correction is bounded and preserves the supported period; persistent=${persistent}`, async () => {
  let calls=0,calculations=0;
  const bad='Jupiter 7ve ghar mein hai, lekin Saturn emotional burden deta hai.\n\nNovember 2031 se July 2034 tak shaadi sambhavit hai.';
  const good='Jupiter 7ve ghar mein sahyog deta hai, lekin Saturn delay ka sanket hai.\n\nNovember 2031 se July 2034 ke beech shaadi sambhavit hai, guarantee nahi.';
  const result=await directAnswer({user_id:'synthetic',query:'Meri shaadi kab ho sakti hai?',language:'hinglish',user_gender:'male',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7']},dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},verdict_signals:[{area:'marriage',positive:['benefic Jupiter house 7 mein'],negative:['Saturn house 7 par delay']}]});},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      if(calls===3)assert.equal(body.tool_choice,'none');
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2||persistent?bad:good};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    }
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.equal(unsupportedReadingConsequence(result.reply),false);
  assert.match(result.reply,/2031/);assert.match(result.reply,/2034/);
  assert.ok(result.answer_validation.includes('reading_wording_rejected'));
  assert.equal(result.answer_validation.includes('reading_wording_fallback'),persistent);
});
