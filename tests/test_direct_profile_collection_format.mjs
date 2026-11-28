import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {profileCollectionFormat} from '../extensions/reviewed-reading/direct/profile-collection-format.mjs';
import {savedBirthContext} from '../extensions/reviewed-reading/direct/context.mjs';

const user='919000000001';
const env={OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
 ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:user,
 ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1',
 ASTROFRIEND_PILOT_SEMANTIC_ROUTING_ENABLED:'1',ASTROFRIEND_PILOT_NATURAL_CONTINUATION_ENABLED:'1'};

for(const [name,profile,identity,expected,status] of [
 ['new user',{}, {},['Name:','Date of Birth:','Time:','Place of Birth:','Gender:','Religion (Optional):']],
 ['known name and date',{date:'1998-10-18'},{name:'Neel'},['Time:','Place of Birth:','Gender:']],
 ['only place missing',{date:'1998-10-18',time:'06:35'},{name:'Neel',gender:'male'},['Place of Birth:']],
 ['fresh birth form missing identity',{date:'1998-10-18',time:'06:35',location_name:'Jaipur'},{},['Name:','Gender:'],'saved'],
 ['unknown placeholders',{date:'unknown'},{name:'Please update',gender:'unknown'},['Name:','Date of Birth:','Time:','Place of Birth:','Gender:','Religion (Optional):']]
])test(`self astrology intake formats ${name} without starting calculation`,async()=>{
 let calls=0;
 const result=await directAnswer({user_id:user,query:'When will I get married?',reply_surface:'whatsapp',language:'english',history:[],birth:profile,
  user_name:identity.name,user_gender:identity.gender??'unknown',...(status?{profile_update_status:status}:{})},
 {env,makeMemory:()=>({read:async()=>['The user likes music.'],write:async()=>assert.fail('No profile writes during collection')}),
  makeTools:()=>assert.fail('Missing details must not start tools'),fetchImpl:async()=>{
   calls++;assert.equal(calls,1);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({route:'checked_reading',reply:'',
    intent:{topic:'marriage',subject:'self',scope:'natal',timing:true,history_index:-1,property_event:'none',profile_fields:[]}})}}]});
  }});
 assert.equal(result.answer_conversation_route,'clarification');assert.equal(calls,1);
 assert.deepEqual(result.reply.split('\n\n')[1].split('\n'),expected);
 assert.deepEqual(result.answer_reading_tools,[]);assert.doesNotMatch(result.reply,/busy|12:00|1998|Neel/);
});

test('known fields never appear as blanks in every profile combination',()=>{
 const definitions=[['name','Neel','Name:'],['gender','male','Gender:'],['date','1998-10-18','Date of Birth:'],['time','06:35','Time:'],['location_name','Jaipur','Place of Birth:']];
 for(let mask=0;mask<32;mask++){
  const known=Object.fromEntries(definitions.filter((_,i)=>mask&(1<<i)).map(([key,value])=>[key,value]));
  const form=profileCollectionFormat(savedBirthContext(known),'english',known)??'';
  for(const [i,[,,label]] of definitions.entries())assert.equal(form.includes(label),!(mask&(1<<i)),`mask=${mask} ${label}`);
 }
});

test('localized initial forms preserve original-style rows without placeholder notation',()=>{
 for(const language of ['hindi','hinglish','marathi','bengali','english']){
  const form=profileCollectionFormat(savedBirthContext({}),language);
  assert.equal(form.split('\n\n')[1].split('\n').length,6);
  assert.doesNotMatch(form,/DD Month YYYY|HH:MM|City, State, Country/);
 }
});

test('English and Hinglish initial forms match the existing USER.md templates exactly',()=>{
 const source=readFileSync(new URL('../app/whatsapp-support/workspace-astrologer/USER.md',import.meta.url),'utf8');
 for(const [marker,language] of [['ENGLISH','english'],['HINGLISH','hinglish']]){
  const section=source.slice(source.indexOf(`- **${marker} TEMPLATE`));
  const expected=/```\r?\n([\s\S]*?)```/u.exec(section)[1].split(/\r?\n/u).map(line=>line.trim()).join('\n').trim();
  assert.equal(profileCollectionFormat(savedBirthContext({}),language),expected);
 }
 assert.equal(profileCollectionFormat(savedBirthContext({date:'1998-10-18',time:'06:35',location_name:'Jaipur'}),'english',{name:'Neel',gender:'male'}),null);
});
