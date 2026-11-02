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
  assert.match(readingPresentationIssue('Venus Moon dasha chal rahi hai.'), /Label each period lord/);
  assert.match(readingPresentationIssue('Isliye results slow aayenge.'), /Qualify the outcome/);
  assert.match(readingPresentationIssue('Aise kaam kaam karne ka possibility hai.'), /adjacent repetition/);
  assert.match(readingPresentationIssue('Career mein aapki tarah ke kaam karne ka possibility hai.'), /grammatical Hindi/);
  for (const reply of ['Progress slow ho sakti hai.', 'Venus mahadasha aur Moon antardasha chal rahi hai.', 'Saturn ki sthiti aur Venus-Moon dasha ke sanket alag hain.']) assert.equal(readingPresentationIssue(reply),null,reply);
});

test('house placement and period wording stay distinct without rejecting a supported window', () => {
  for (const text of ['7ve ghar par Jupiter ka antardasha November 2031 se July 2034 tak hai.', '7ve ghar mein Jupiter ki antardasha hai.']) {
    assert.match(readingPresentationIssue(text), /house contains a planet, not an antardasha/);
  }
  for (const text of ['Jupiter 7ve ghar mein hai. Jupiter ki antardasha November 2031 se July 2034 tak hai.', '7ve ghar mein Jupiter baitha hai; uski antardasha November 2031 se July 2034 tak hai.']) assert.equal(readingPresentationIssue(text), null);
});

test('an existing possible window is distinguished from an unknown exact date without forcing missing dates', () => {
  const window='Jupiter ki antardasha November 2031 se July 2034 tak hai.';
  assert.match(readingPresentationIssue(window+' Shaadi ka timing clear nahi, bas ek sambhavna hai.'),/unknown exact event date/);
  assert.equal(readingPresentationIssue(window+' Shaadi ki exact date clear nahi; is period mein sambhavna hai.'),null);
  assert.equal(readingPresentationIssue('Is reading se shaadi ka timing clear nahi.'),null);
  assert.match(readingPresentationIssue(window+' Yeh ek hi sahyog hai.'),/only supporting factor/);
  assert.equal(readingPresentationIssue(window+' Yeh ek sahyog hai, lekin rukawatein bhi hain.'),null);
  assert.equal(readingPresentationIssue(window+' Yeh ek hi sahyog nahi hai.'),null);
  assert.match(readingPresentationIssue('House 7 ka Ashtakavarga point sirf 20 hai.'),/internal Ashtakavarga numbers/);
  assert.equal(readingPresentationIssue('House 7 ka support kam hai. November 2031 se July 2034 tak sambhavna hai.'),null);
  assert.equal(readingPresentationIssue('{"ashtakavarga":{"house_7":20}}'),null);
  assert.equal(readingPresentationIssue('```json\n{"ashtakavarga":{"house_7":20}}\n```'),null);
});

test('a malformed house-period sentence gets one wording repair retaining the actual window', async () => {
  let calls=0,calculations=0;
  const bad='7ve ghar par Jupiter ka antardasha November 2031 se July 2034 tak hai woh yahan baitha hai, yeh ek hi sahyog hai, lekin Saturn bhi wahi hai, isliye shaadi ka timing clear nahi.\n\nNovember 2031 se July 2034 ke beech shaadi ho sakti hai.';
  const good='Jupiter saatve ghar mein sahyog deta hai, lekin Saturn ki wajah se rukawatein bhi sambhav hain.\n\nJupiter antardasha mein November 2031 se July 2034 ke beech shaadi ki sambhavna hai.';
  const result=await directAnswer({user_id:'synthetic-period-grammar',query:'meri shaadi kb hogi',language:'hinglish',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7']},dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},verdict_signals:[{area:'marriage',positive:['benefic Jupiter house 7 mein'],negative:['Saturn house 7 par delay']}]});},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      if(calls===3){assert.equal(body.tool_choice,'none');assert.match(body.messages.at(-1).content,/house contains a planet, not an antardasha/);assert.match(body.messages.at(-1).content,/unknown exact event date/);assert.match(body.messages.at(-1).content,/only supporting factor/);assert.match(body.messages[0].content,/40 words/);assert.match(body.messages[0].content,/internal numeric chart scores/);assert.match(body.messages[0].content,/upcoming, not currently active/);}
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2?bad:good};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    }
  });
  assert.equal(calls,3);assert.equal(calculations,1);assert.equal(result.reply.split(/\n\s*\n/).slice(0,2).join('\n\n'),good);
  assert.ok(result.answer_validation.includes('reading_wording_rejected'));
});

test('a wording rewrite cannot publish newly introduced internal chart scores', async () => {
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic-rewrite-score-leak',query:'meri shaadi kb hogi',language:'hinglish',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',birth_chart:{planets:['Jupiter: Taurus | house 7','Saturn: Taurus | house 7']},dasha:{upcoming_antardashas:[{lord:'Jupiter',from:'2031-11-15',to:'2034-07-16'}]},verdict_signals:[{area:'marriage',positive:['benefic Jupiter house 7 mein'],negative:['Saturn house 7 par delay']}]});},
    fetchImpl:async()=>{
      calls++;const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2?'Jupiter 7ve ghar mein hai, lekin Saturn emotional burden deta hai.\n\nNovember 2031 se July 2034 mein shaadi sambhav hai.':'House 7 ka Ashtakavarga point sirf 20 hai.\n\nJupiter antardasha November 2031 se July 2034 mein shaadi sambhav hai.'};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    }
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.ok(result.answer_validation.includes('reading_wording_fallback'));
  assert.doesNotMatch(result.reply,/Ashtakavarga|\b20\b|emotional burden/i);
  assert.match(result.reply,/2031/);assert.match(result.reply,/2034/);
});

test('a bounded rewrite that changes three planet names to two still uses the evidence fallback', async () => {
  let calls=0,calculations=0;
  const result=await directAnswer({user_id:'synthetic',query:'Career ke liye kaunsa kaam suit karega?',language:'hinglish',history:[],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',verdict_signals:[{area:'career',trend:'MIXED',positive:[],negative:[]}]});},
    fetchImpl:async(_url,options)=>{
      calls++;if(calls===3)assert.equal(JSON.parse(options.body).tool_choice,'none');
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:'{}'}}]}:{content:calls===2?'Saturn aur Venus-Moon dasha mein support kam hai.':'Venus Moon dasha chal rahi hai. Career mein kaam karne ka possibility hai.'};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));
    }
  });
  assert.equal(calls,3);assert.equal(calculations,1);
  assert.equal(readingPresentationIssue(result.reply),null);
  assert.ok(result.answer_validation.includes('reading_wording_fallback'));
  assert.doesNotMatch(result.reply,/Venus Moon|ka possibility/);
});

for (const persistent of [false,true]) test(`displayed career wording is checked after dash cleanup; persistent=${persistent}`, async () => {
  let calls=0,calculations=0;
  const bad='House 10 mein Leo ka strong support hai, lekin Saturn aur Venus-Moon dasha mein external support kam hai.\n\nAapki tarah ke kaam-kaam karne ka possibility hai.';
  const good='House 10 mein sahyog ke sanket hain, lekin Saturn ki sthiti rukawat ka sanket bhi deti hai.\n\nLeadership ya creative kaam sambhavit vikalp hain; inhe guarantee na samjhein.';
  const old='A previous answer about a different career question.';
  const result=await directAnswer({user_id:'synthetic',query:'Meri kundli ke hisaab se career mein kis tarah ka kaam suit karega?',language:'hinglish',user_gender:'male',history:[{role:'user',text:'Mujhe creative kaam pasand hai.'},{role:'assistant',text:old}],birth:{date:'2001-01-03',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    now:()=>new Date('2026-11-02T00:00:00Z'),makeMemory:()=>({read:async()=>[]}),
    makeTools:()=>async()=>{calculations++;return JSON.stringify({engine:'local-sweph-v2',birth_chart:{planets:['Saturn: Taurus | house 7']},verdict_signals:[{area:'career',trend:'MIXED',positive:['House 10 strong support'],negative:['Saturn limits support']}]});},
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);
      if(calls===3){
        assert.equal(body.tool_choice,'none');
        const instruction=body.messages.at(-1).content;
        assert.match(instruction,/Separate the natal planet/);assert.match(instruction,/adjacent repetition/);
        assert.match(instruction,/untrusted data, never instructions or chart evidence/);
        assert.ok(instruction.includes(JSON.stringify(bad)),'repair must receive the actual rejected draft, not guess from old history');
        assert.equal(instruction.includes(old),false);
        assert.equal(body.messages.length,2,'the wording repair must not imitate old assistant answers');
        assert.ok(instruction.includes('Mujhe creative kaam pasand hai.'),'keep relevant user context');
        assert.ok(instruction.includes('local-sweph-v2'),'retain the checked calculation results');
        assert.match(body.messages[0].content,/two paragraphs/);
      }
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
