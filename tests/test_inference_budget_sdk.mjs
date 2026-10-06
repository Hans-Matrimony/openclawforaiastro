import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { BUDGET_KEY, createBudgetRuntime } from '../extensions/inference-budget/runtime.mjs';
import { installedSdkEntry } from '../scripts/validate-inference-budget.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('native Google transport and Pi compaction obey the same budget', {
  skip: !process.env.OPENCLAW_TEST_ENTRY, timeout: 60000,
}, async () => {
  const entry = path.resolve(process.env.OPENCLAW_TEST_ENTRY);
  const sdk = await import(pathToFileURL(installedSdkEntry(entry, '@mariozechner/pi-ai')).href);
  const pi = await import(pathToFileURL(installedSdkEntry(entry, '@mariozechner/pi-coding-agent')).href);
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw=''; for await(const chunk of req)raw+=chunk;
    const data=JSON.parse(raw);requests.push(data);
    res.writeHead(200,{'content-type':'text/event-stream'});
    if(data.contents) {
      res.end(`data: ${JSON.stringify({candidates:[{index:0,content:{role:'model',parts:[{text:'Synthetic Google answer.'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:5,totalTokenCount:15}})}\n\n`);
    } else {
      const chunk={id:'synthetic',object:'chat.completion.chunk',created:0,model:'test',choices:[{index:0,delta:{role:'assistant',content:'Synthetic answer.'},finish_reason:null}]};
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write(`data: ${JSON.stringify({...chunk,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})}\n\n`);
      res.end('data: [DONE]\n\n');
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const state=await fs.mkdtemp(path.join(os.tmpdir(),'af-budget-sdk-'));
  const originalFetch=globalThis.fetch;
  const runtime=createBudgetRuntime({fetchImpl:originalFetch,limits:{attempts:2}});
  globalThis[BUDGET_KEY]=runtime;
  globalThis.fetch=runtime.transport.fetch;
  runtime.installSdk(sdk);
  let session;
  try {
    const common={id:'test',name:'test',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:131072,maxTokens:8192};
    const baseUrl=`http://127.0.0.1:${server.address().port}`;
    runtime.bind({agentId:'astrologer',sessionId:'google-session',runId:'google-run'});
    const google=await sdk.completeSimple({...common,id:'gemini-2.5-flash',provider:'google',api:'google-generative-ai',baseUrl},
      {messages:[{role:'user',content:'Synthetic',timestamp:Date.now()}]},
      {sessionId:'google-session',apiKey:'synthetic',maxTokens:8192});
    assert.equal(google.stopReason,'stop',google.errorMessage);
    assert.match(google.content.map(c=>c.text??'').join(''),/Google answer/);
    assert.equal(requests[0].generationConfig.maxOutputTokens,2048);
    assert.equal(runtime.forSession('google-session').attempts,1);
    const auth=pi.AuthStorage.create(path.join(state,'auth.json'));
    auth.setRuntimeApiKey('test','synthetic');
    const registry=new pi.ModelRegistry(auth,path.join(state,'models.json'));
    const loader=new pi.DefaultResourceLoader({cwd:state,agentDir:state,noExtensions:true,
      additionalExtensionPaths:[path.join(root,'extensions/inference-budget/pi-extension.mjs')]});
    await loader.reload();
    assert.deepEqual(loader.getExtensions().errors,[]);
    const manager=pi.SessionManager.create(state);
    runtime.bind({agentId:'astrologer',sessionId:manager.getSessionId(),runId:'compaction-run'});
    ({session}=await pi.createAgentSession({cwd:state,agentDir:state,authStorage:auth,modelRegistry:registry,
      model:{...common,provider:'test',api:'openai-completions',baseUrl:baseUrl+'/v1'},tools:[],resourceLoader:loader,sessionManager:manager}));
    await session.prompt('First synthetic question.');
    await session.prompt('Second synthetic question.');
    const count=requests.length;
    const messages=JSON.stringify(session.messages);
    await assert.rejects(session.compact(),/budget|summarization|400/i);
    assert.equal(requests.length,count,'exhausted compaction must not send another request');
    assert.equal(JSON.stringify(session.messages),messages,'failed compaction must preserve history');
    assert.equal(runtime.forSession(manager.getSessionId()).attempts,2);
    assert.equal(runtime.forSession(manager.getSessionId()).blocked,true);
  } finally {
    session?.dispose();
    globalThis.fetch=originalFetch;
    delete globalThis[BUDGET_KEY];
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(state),os.tmpdir());
    assert.ok(path.basename(state).startsWith('af-budget-sdk-'));
    await fs.rm(state,{recursive:true,force:true});
  }
});
