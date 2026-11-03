import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const birth={date:'2000-01-01',time:'05:00',location_name:'Delhi'};
const stale={birth_date:'1985-02-02',birth_time:'12:00',location_name:'Mumbai'};
const memory={read:async()=>['User was born February 2, 1985 at noon in Mumbai.'],write:async()=>assert.fail('No memory mutation expected')};

test('only complete selected profiles and clear self questions bind calculation inputs',()=>{
  for(const q of ['meri shaadi kb hogi','Meri shadi kab hogi?','My career reading','When will I get married?','मेरी शादी कब होगी?']) {
    assert.deepEqual(selectedSelfBirth(q,birth),birth);
  }
  for(const q of ['hello','meri GF chali gayi','Meri behen ki shaadi kab hogi','My sister needs a horoscope','What about her marriage?','meri shaadi aur bhai ki naukri','मेरी बहन की शादी कब होगी?','My marriage: DOB 2002-02-02','Meri kundli, time is actually 06:00','My job, I was born May 4 1992','My birth chart correction','Meri kundli birth time 6am','My career and my father’s chart','My kundli for Alice','My kundli 4 May 2000']) {
    assert.equal(selectedSelfBirth(q,birth),null,q);
  }
  for(const p of [undefined,{}, {...birth,date:'unknown'}, {...birth,time:''}, {...birth,location_name:'  '}]) {
    assert.equal(selectedSelfBirth('meri shaadi kab hogi',p),null);
  }
  assert.equal(selectedSelfBirth('Correct my birth chart and tell my marriage timing',birth),null);
  assert.equal(selectedSelfBirth('Switch my kundli to the other saved person',birth),null);
});

test('stale memory arguments cannot replace selected self birth in natal or transit tools',async()=>{
  const seen=[];
  const execute=createTools({birth,query:'meri shaadi kb hogi',memory,env:{},reading:async(name,args)=>{
    seen.push({name,args});return {content:[{type:'text',text:'checked'}]};
  }});
  for(const name of ['get_horoscope_predictions','get_current_transits']) {
    assert.equal(await execute('mcp__VedAstro__'+name,{...stale,query_text:'marriage'}),'checked');
    assert.deepEqual(seen.at(-1).args,{birth_date:birth.date,birth_time:birth.time,location_name:birth.location_name,query_text:'marriage'});
  }
  assert.deepEqual(stale,{birth_date:'1985-02-02',birth_time:'12:00',location_name:'Mumbai'});
});

test('explicit corrections, other people, missing profiles and horary inputs keep existing behavior',async()=>{
  for(const [query,profile] of [['Meri shaadi: DOB 2002-02-02',birth],['Meri behen ki shaadi kab hogi',birth],['Meri shaadi kab hogi',null],['How about that?',birth]]) {
    const execute=createTools({birth:profile,query,memory,env:{},reading:async(_name,args)=>{
      assert.deepEqual(args,stale);return {content:[{type:'text',text:'unchanged'}]};
    }});
    assert.equal(await execute('get_horoscope_predictions',stale),'unchanged');
  }
  const execute=createTools({birth,query:'Meri shaadi kab hogi',memory,env:{},reading:async(_name,args)=>{
    assert.deepEqual(args,stale);return {content:[{type:'text',text:'unchanged'}]};
  }});
  assert.equal(await execute('get_horary_prediction',stale),'unchanged');
  await assert.rejects(execute('get_match_report',stale),{code:'matching_birth_required'});
});

test('actual calculation matches selected profile despite stale birth arguments',async()=>{
  const execute=createTools({birth,query:'meri shaadi kb hogi',memory,env:{}});
  const actual=JSON.parse(await execute('get_horoscope_predictions',stale));
  const expected=JSON.parse((await sourceReading('get_horoscope_predictions',{},birth)).content[0].text);
  assert.deepEqual(actual,expected);
  assert.equal(actual.birth_chart.utc_time,'1999-12-31T23:30:00.000Z');
});

test('agent passes active question to input binding while preserving memory and call budget',async()=>{
  let calls=0,charts=0;
  const result=await directAnswer({user_id:'synthetic-profile-precedence',query:'Meri kundli batao',birth,history:[],language:'hinglish'}, {
    env:{OPENROUTER_API_KEY:'test',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>memory,
    makeTools:options=>createTools({...options,reading:async(_name,args)=>{
      charts++;assert.equal(args.birth_date,birth.date);assert.equal(args.birth_time,birth.time);assert.equal(args.location_name,birth.location_name);
      return {content:[{type:'text',text:'{"checked":true}'}]};
    }}),
    fetchImpl:async(_url,options)=>{
      calls++;const body=JSON.parse(options.body);assert.match(body.messages[0].content,/Selected self profile data/);
      const message=calls===1?{tool_calls:[{id:'chart',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:JSON.stringify(stale)}}]}:{content:'Chart explanation.\n\nMixed indication.'};
      return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
    },
  });
  assert.equal(charts,1);assert.equal(calls,2);assert.match(result.reply,/Mixed indication/);
});
