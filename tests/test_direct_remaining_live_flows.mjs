import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {matchingEvidence} from '../extensions/reviewed-reading/direct/birth-evidence.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {emotionalReplyIssue,emotionalReplyFallback} from '../extensions/reviewed-reading/direct/emotional-friendship.mjs';
const birth={date:'2000-01-01',time:'05:00',location_name:'Delhi'};
const timing='Meri shaadi kab hogi? Mere saved birth details se sambhavit samay bataiye; guarantee ya naye birth details assume mat kijiye.';
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'};

test('Hinglish saved-self wording and a no-guess qualifier bind only the authoritative self profile',async()=>{
  for(const query of [timing,'Mere saved birth details se meri kundli bataiye.', 'Meri existing birth details se meri shaadi kab hogi?'])assert.deepEqual(selectedSelfBirth(query,birth),birth);
  for(const query of [timing+' DOB 2002-02-02.',timing+' Meri behen ki kundli bhi bataiye.',
    'Mere saved birth details change karo.','Meri GF ke saved birth details se shaadi batao.'])assert.equal(selectedSelfBirth(query,birth),null,query);
  const execute=createTools({birth,query:timing,memory:{read:async()=>[],write:async()=>assert.fail('No memory writes')},env:{},reading:async(_name,args)=>{
    assert.equal(args.birth_date,birth.date);assert.equal(args.birth_time,birth.time);assert.equal(args.location_name,birth.location_name);
    return {content:[{type:'text',text:'checked selected inputs'}]};
  }});
  assert.equal(await execute('get_horoscope_predictions',{birth_date:'1985-02-02',birth_time:'12:00',location_name:'Mumbai'}),'checked selected inputs');
});

test('a new vyakti cannot silently reuse an older matching partner',()=>{
  const args={male_birth_date:birth.date,male_birth_time:birth.time,male_location_name:birth.location_name,
    female_birth_date:'2000-02-02',female_birth_time:'12:00',female_location_name:'Mumbai'};
  const context={birth,gender:'male',history:[{role:'user',text:'My partner\n2000-02-02\n12:00\nMumbai'}]};
  assert.equal(matchingEvidence(args,{...context,query:'Mera Guna Milan batao'}),true);
  for(const query of ['Mere aur ek naye vyakti ka Guna Milan bataiye.','My different person matching score?', 'Mere aur dusre vyakti ka milan?'])assert.equal(matchingEvidence(args,{...context,query}),false,query);
});

for(const self of [true,false])for(const language of ['hinglish','hindi','english'])test(`missing matching details asks only for relevant subjects; self=${self}; language=${language}`,async()=>{
  let calls=0;
  const query=self?'Mere aur ek naye vyakti ka Guna Milan score bataiye. Unki janam tithi, samay aur jagah abhi mere paas nahi hai.':'Meri dost aur uske partner ka Guna Milan score bataiye.';
  const content=language==='hindi'?'क्या आप दोनों लोगों की जन्म तिथि, समय और स्थान बता सकते हैं?':language==='english'?"Please confirm both people's birth dates, birth times and birthplaces?":'Kya aap dono logon ki janam tithi, exact samay aur janam sthan confirm kar sakte hain?';
  const result=await directAnswer({user_id:'synthetic-missing-pair',query,birth,user_gender:'male',language,history:[]},{env,makeMemory:()=>({read:async()=>[]}),makeTools:()=>()=>assert.fail('No calculation without both confirmed profiles'),fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));}});
  assert.equal(calls,1);
  assert.match(result.reply,language==='hindi'?(self?/दूसरे व्यक्ति/:/दोनों लोगों/):language==='english'?(self?/other person's/:/both people's/):(self?/doosre vyakti ki/:/dono logon ki/));
  assert.doesNotMatch(result.reply,/\d+\/36/);
});

test('Hindi listening rejects the observed Roman-script reply while preserving requested Latin script',()=>{
  const value={query:'Hindi mein bas meri baat suniye, abhi salah ya koi sawal nahi chahiye.',language:'hindi',user_gender:'male',history:[]};
  const reply='Aaj aap akela lag rahe hain. Main yahan hoon, jab bhi aap baat karna chahein.';
  assert.match(emotionalReplyIssue(reply,value),/Hindi in Devanagari/);
  assert.equal(emotionalReplyIssue(emotionalReplyFallback(value),value),null);
  assert.doesNotMatch(emotionalReplyIssue(reply,{...value,query:'Roman Hindi mein meri baat suniye.'})||'',/Hindi in Devanagari/);
});
