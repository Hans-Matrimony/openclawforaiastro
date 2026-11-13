import assert from 'node:assert/strict';
import test from 'node:test';
import {isPersonalChartQuestion} from '../extensions/reviewed-reading/direct/reading-intent.mjs';
import {selectedSelfBirth} from '../extensions/reviewed-reading/direct/selected-self-birth.mjs';
import {activeReadingQuestion} from '../extensions/reviewed-reading/direct/followup-scope.mjs';
import {conversationGroundingInstruction, conversationGroundingIssue} from '../extensions/reviewed-reading/direct/conversation-grounding.mjs';
import {whatsappWordingIssue} from '../extensions/reviewed-reading/direct/whatsapp-presentation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';
import {createTools} from '../extensions/reviewed-reading/direct/tools.mjs';
import {sourceReading} from '../extensions/reviewed-reading/direct/source-engine.mjs';
import {contextualClosing} from '../extensions/reviewed-reading/direct/contextual-closing.mjs';

const birth = {date:'1991-04-11',time:'08:00',location_name:'Pune'};
const question = 'Mea career ke baare mai batao';
const value = {user_id:'synthetic-career-retry',query:question,birth,language:'hinglish',reply_surface:'whatsapp',history:[]};
const history = [
  {role:'user',text:'Meri shaadi kab hogi?'},
  {role:'assistant',text:'Marriage answer from an earlier topic.'},
  {role:'user',text:question},
  {role:'assistant',text:'Bina jaanch ke purani prediction dohrana sahi nahi hoga. Mere pichhle jawab ki kis baat ko saaf karun?'},
];

test('self-pronoun typos request a chart and bind the same saved self profile',()=>{
  for (const query of [question,'Mra career kaisa hoga?','Meraa career batao','Meree shaadi kab hogi?','Merii job kab lagegi?']) {
    assert.equal(isPersonalChartQuestion(query),true,query);
    assert.deepEqual(selectedSelfBirth(query,birth),birth,query);
    assert.equal(conversationGroundingInstruction({...value,query},{status:'READY'}),'');
    assert.equal(conversationGroundingIssue('Career ke calculated sanket mile hain.',{...value,query},{status:'READY'}),null);
  }
});

test('normalization never binds another person, birth correction, or an incomplete profile',()=>{
  for (const query of ['Mea career aur meri behen ki job batao','Mea career, DOB 2002-02-02','Change mea career birth profile','Mea career aur uski shaadi batao']) {
    assert.equal(selectedSelfBirth(query,birth),null,query);
  }
  assert.equal(selectedSelfBirth(question,{...birth,time:''}),null);
  for (const query of ['What is career astrology?','Mea is my friend','I am worried about my career','What should I do about my job?']) {
    assert.equal(isPersonalChartQuestion(query),false,query);
  }
});

test('retry and combined in-flight clarification recover career instead of old marriage',()=>{
  for (const query of ['Response toh do naa','Please answer','Reply do','Mtlb smjha nahi mai','Mtlb smjha nahi mai\nResponse toh do naa',"I didn't understand"]) {
    const result=activeReadingQuestion({...value,query,history:[...history,{role:'user',text:'Mtlb smjha nahi mai'}]});
    assert.equal(result,`${question}\nFollow-up: ${query}`,query);
    assert.equal(isPersonalChartQuestion(result),true);
  }
});

test('new topics, other people, corrections, greetings and quotes stop retry recovery',()=>{
  const query='Response toh do naa';
  for (const text of ['Meri GF chali gayi','Cancel my payment','Mera haath padh kr batao','I feel lonely','My sister career reading','Change my birth time to 06:00','Hi']) {
    assert.equal(activeReadingQuestion({...value,query,history:[...history,{role:'user',text}]}),query,text);
  }
  for (const current of ['Jaise?','Matlab?','Hi','Response do, my sister ke baare batao','Reply do, DOB 2002-02-02']) {
    assert.equal(activeReadingQuestion({...value,query:current,history}),current);
  }
  assert.equal(activeReadingQuestion({...value,query,history,reply_to:{role:'assistant',text:'Another selected message'}}),query);
  assert.equal(activeReadingQuestion({...value,query,history,birth:null}),query);
});

test('an unresolved retry stays bounded and never mines assistant predictions for a topic',()=>{
  const query='Please answer';
  assert.equal(activeReadingQuestion({...value,query,history:[{role:'assistant',text:'Your career improves in 2034.'}]}),query);
  assert.equal(activeReadingQuestion({...value,query,history:[...history,...Array.from({length:4},()=>({role:'user',text:'Reply do'}))]}),query);
});

test('WhatsApp wording cannot expose internal generation failures as a negative prediction',()=>{
  for (const reply of ['Koi clear tool based answer nahi mila, koi support nahi hai.','The chart tool did not answer.','The upstream provider failed.']) {
    assert.match(whatsappWordingIssue(reply,value),/missing calculation is not a negative prediction/);
    assert.ok(whatsappWordingIssue(reply,{...value,query:question+' in detail'}));
  }
  assert.equal(whatsappWordingIssue('Career mein sahyog aur kuch rukawat ke sanket hain.',value),null);
  assert.equal(whatsappWordingIssue('The chart tool returned an answer.',{...value,reply_surface:undefined}),null);
});

test('actual engine requires chart work for the reported question and merged retry',async()=>{
  for (const input of [value,{...value,query:'Mtlb smjha nahi mai\nResponse toh do naa',history}]) {
    const requests=[];
    await assert.rejects(directAnswer(input,{
      env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0'},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:()=>async()=>assert.fail('No fabricated tool call'),
      fetchImpl:async(_url,options)=>{
        const body=JSON.parse(options.body);requests.push(body);
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Aapka career achha hai.'}}]}));
      },
    }),/Personal reading requires a successful chart tool/);
    assert.ok(requests.some(request=>request.tool_choice==='required'),'Existing automatic first round must escalate to mandatory chart work');
    assert.ok(requests[0].messages.at(-1).content.includes(question));
    assert.doesNotMatch(requests[0].messages[0].content,/# Current conversation boundary/);
  }
});

test('real tool adapter overrides hallucinated birth arguments for typo and recovered career',async()=>{
  for (const input of [value,{...value,query:'Response toh do naa',history}]) {
    const query=activeReadingQuestion(input);let count=0;
    const execute=createTools({birth,query,selectedSelfQuery:query.split('\nFollow-up:')[0],memory:{read:async()=>[]},env:{},
      reading:async(name,args)=>{
        count++;assert.equal(name,'get_horoscope_predictions');
        assert.equal(args.birth_date,birth.date);assert.equal(args.birth_time,birth.time);assert.equal(args.location_name,birth.location_name);
        return {content:[{type:'text',text:'Checked career evidence'}]};
      }});
    assert.equal(await execute('get_horoscope_predictions',{birth_date:'1980-02-02',birth_time:'12:00',location_name:'Mumbai'}),'Checked career evidence');
    assert.equal(count,1);
  }
});

test('complete reply uses the real selected chart for both reported career turns',async()=>{
  for (const input of [value,{...value,query:'Mtlb smjha nahi mai\nResponse toh do naa',history}]) {
    let calls=0,calculations=0;
    const result=await directAnswer(input,{
      env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
      makeMemory:()=>({read:async()=>[]}),
      makeTools:options=>createTools({...options,reading:async(...args)=>{calculations++;return sourceReading(...args);}}),
      fetchImpl:async()=>{
        const message=++calls===1?{tool_calls:[{id:'career',type:'function',function:{name:'mcp__VedAstro__get_horoscope_predictions',arguments:JSON.stringify({birth_date:'1980-02-02',birth_time:'12:00',location_name:'Mumbai',query_text:'career'})}}]}:
          {content:'Career mein sahyog aur rukawat dono ke sanket hain.\n\nEk field ko sabse behtar nahi kaha ja sakta.'};
        return new Response(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
      },
    });
    assert.equal(calculations,1);
    assert.deepEqual(result.answer_reading_tools,['get_horoscope_predictions']);
    assert.match(result.reply,/career/i);
    assert.doesNotMatch(result.reply,/Bina jaanch|purani prediction|tool[ -]based|shaadi|marriage|20\d{2}/iu);
    assert.ok(calls<=7);
  }
});

test('captured closing cannot add incoming opportunities after a validated career answer',async()=>{
  const base='Career mein sahyog aur rukawat dono ke sanket hain.\n\nEk field ko sabse behtar nahi kaha ja sakta.';
  for (const closing of [
    'Career ke liye abhi kuch naye opportunities aa rahe hain, bas thoda patience chahiye. Kya aapne koi specific field choose kiya hai?',
    'New opportunities are coming. What kind of work interests you?',
    'Job offers are on the way. Which field interests you?',
    'Career mein naye mauke aa rahe hain. Kis kaam mein dilchaspi hai?',
    'नए अवसर आ रहे हैं। आप किस क्षेत्र में काम करना चाहते हैं?',
  ]) {
    let calls=0;
    const reply=await contextualClosing(base,value,{generate:async()=>{calls++;return closing;}});
    assert.equal(calls,1,'Rejection uses the existing bounded fallback without another model call');
    assert.ok(reply.startsWith(base+'\n\n'),'Never alter the checked reading');
    assert.ok(!reply.endsWith(closing));
    assert.doesNotMatch(reply,/opportunities aa rahe|are coming|on the way|mauke aa rahe/iu);
  }
  const question='Kya aapko abhi koi job offers mile hain?';
  assert.equal(await contextualClosing(base,value,{generate:async()=>question}),base+'\n\n'+question);
});
