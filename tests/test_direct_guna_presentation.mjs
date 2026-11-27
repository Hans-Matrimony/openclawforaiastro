import test from 'node:test';
import assert from 'node:assert/strict';
import {invalidGunaPresentation, verifiedGunaFallback,requestedGunaPoints} from '../extensions/reviewed-reading/direct/guna-presentation.mjs';
import {directAnswer} from '../extensions/reviewed-reading/direct/agent.mjs';

const names=['Varna','Vashya','Tara','Yoni','Graha Maitri','Gana','Bhakoot','Nadi'];
const factors=names.map((name,i)=>({name,score:[1,1,1.5,2,0.5,6,7,8][i],max_score:i+1}));
const report={guna_milan:{status:'ok',score_points:27,score_max:36,factors}};
const results=[JSON.stringify(report)];
const query='My Guna Milan eight factors and total score';
const correct=verifiedGunaFallback(results,'english');

test('factor scores preserve fractions, maxima and all eight requested factors',()=>{
  assert.equal(invalidGunaPresentation(correct,results,query),false);
  assert.equal(invalidGunaPresentation(correct.replace('Tara: 1.5/3','Tara: 1/3'),results,query),true);
  assert.equal(invalidGunaPresentation(correct.replace('Varna: 1/1','Varna: 1/1 (kam)'),results,query),true);
  assert.equal(invalidGunaPresentation(correct.replace('Varna: 1/1','Varna: 1/1 (kam nahi)'),results,query),false);
  assert.equal(invalidGunaPresentation(correct.replace('Nadi: 8/8',''),results,query),true);
  assert.equal(invalidGunaPresentation('Guna Milan 27/36.',results,'My Guna Milan score'),false);
  const zero=structuredClone(report);zero.guna_milan.factors[5].score=0;zero.guna_milan.score_points=21;
  assert.equal(invalidGunaPresentation('Gana: 0/6 (strong)',[JSON.stringify(zero)],'My Guna Milan score'),true);
});

test('verified fallback requires one complete internally consistent report and stays localized',()=>{
  for(const language of ['english','hinglish','hindi']) {
    const reply=verifiedGunaFallback(results,language);
    assert.match(reply,/27\/36/);assert.match(reply,/Tara: 1\.5\/3/);assert.match(reply,/Graha Maitri: 0\.5\/5/);
    assert.equal(reply.split(/\n\s*\n/).length,2);assert.equal(invalidGunaPresentation(reply,results,query),false);
    assert.match(reply,/guarantee|गारंटी/);
  }
  assert.equal(verifiedGunaFallback([], 'english'),null);
  assert.equal(verifiedGunaFallback([...results,...results],'english'),null);
  for(const mutate of [g=>g.score_points=28,g=>g.factors[0].score=2,g=>g.factors[0].name='<script>',g=>g.factors.pop()]) {
    const invalid=structuredClone(report);mutate(invalid.guna_milan);
    assert.equal(verifiedGunaFallback([JSON.stringify(invalid)],'english'),null);
  }
});

test('repeated incorrect factor grading uses the verified breakdown rather than reasking supplied details',async()=>{
  let calls=0,calculations=0;
  const bad=correct.replace('Varna: 1/1','Varna: 1/1 (kam)');
  const result=await directAnswer({user_id:'synthetic-factor-grading',query,language:'english',history:[],birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'}},{
    env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',VEDASTRO_DIRECT_CONTEXTUAL_CLOSING:'0'},
    makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>{calculations++;return results[0];},
    fetchImpl:async()=>{calls++;const message=calls===1?{tool_calls:[{id:'matching',type:'function',function:{name:'mcp__VedAstro__get_match_report',arguments:'{}'}}]}:{content:bad};
      return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));},
  });
  assert.equal(calls,3);assert.equal(calculations,1);assert.equal(invalidGunaPresentation(result.reply,results,query),false);
  assert.match(result.reply,/27\/36/);assert.doesNotMatch(result.reply,/confirm|1\/1 \(kam\)/i);
  assert.ok(result.answer_validation.includes('guna_score_rejected'));
});

test('focused exact factor requests preserve only requested checked points and cannot invent a cancellation',async()=>{
 const data=structuredClone(report);data.guna_milan.factors[6].score=0;data.guna_milan.score_points=20;
 const evidence=[JSON.stringify(data)],question='Our Guna Milan ka total aur Nadi, Bhakoot ke exact points bataiye.';
 const expected='Guna Milan ka total 20/36 hai.\n\nNadi: 8/8; Bhakoot: 0/7.';
 assert.equal(requestedGunaPoints(evidence,{query:question,language:'hinglish'}),expected);
 assert.equal(requestedGunaPoints([...evidence,...evidence],{query:question,language:'english'}),null);
 assert.equal(requestedGunaPoints(evidence,{query:question+' What is their meaning?',language:'english'}),null);
 for(const extra of ['When will we marry?','Can you explain Bhakoot dosha?','Give all eight factors.'])
  assert.equal(requestedGunaPoints(evidence,{query:question+' '+extra,language:'english'}),null);
 assert.equal(requestedGunaPoints(evidence,{query:'Nadi ke exact points nahi chahiye.',language:'hinglish'}),null);
 assert.equal(requestedGunaPoints(results,{query:'Tara exact points',language:'english'}),'Tara: 1.5/3.');
 let calls=0;
 const result=await directAnswer({user_id:'919000000001',query:question,language:'hinglish',history:[],reply_surface:'whatsapp',user_gender:'male',birth:{date:'2000-01-01',time:'05:00',location_name:'Delhi'}},{
  env:{OPENROUTER_API_KEY:'fixture',VEDASTRO_DIRECT_FLOW:'source',VEDASTRO_DIRECT_ENVIRONMENT:'development',VEDASTRO_DIRECT_REPLY_CACHE:'0',
   ASTROFRIEND_CONVERSATION_PROGRESS_ENABLED:'1',ASTROFRIEND_CONVERSATION_PROGRESS_USERS:'919000000001',ASTROFRIEND_CONVERSATION_PROGRESS_V2_ENABLED:'1',
   ASTROFRIEND_PILOT_TOPIC_PROMPTS:'1',ASTROFRIEND_PILOT_COHERENT_REPLIES:'1',ASTROFRIEND_PILOT_FOCUSED_READING_ENABLED:'1'},
  makeMemory:()=>({read:async()=>[]}),makeTools:()=>async()=>evidence[0],
  fetchImpl:async()=>{const message=++calls===1?{tool_calls:[{id:'matching',type:'function',function:{name:'mcp__VedAstro__get_match_report',arguments:'{}'}}]}:
   {content:'Guna Milan 20/36 hai. Nadi perfect hai, jo Bhakoot dosh ke balance ko thoda kam kar deta hai.\n\n20/36'};
   return new Response(JSON.stringify({choices:[{finish_reason:calls===1?'tool_calls':'stop',message}]}));},
 });
 assert.equal(result.reply,expected);assert.ok(result.answer_validation.includes('pilot_requested_guna_points'));
 assert.ok(result.answer_validation.includes('matching_grounding_rejected'));
});
