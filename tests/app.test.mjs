import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { createApp, runFFmpeg } from '../server.mjs';
import { apiRequest } from '../lib/providers.mjs';
import { parseSegments, segmentTranscript, timestamp } from '../lib/timestamps.mjs';

test('timestamps preserve boundaries, reject malformed ranges and mark empty text',()=>{
  assert.equal(timestamp(3661),'01:01:01');
  const segments=parseSegments('chunk-00000.m4a,0,60\nchunk-00001.m4a,60,60.064\n',60);
  assert.equal(segments.length,1); // Encoder padding must not create a spurious segment.
  assert.equal(segments[0].end,60);
  segments[0].status='empty';
  assert.match(segmentTranscript(segments),/00:00:00 – 00:01:00/);
  assert.match(segmentTranscript(segments),/未返回文字/);
  assert.throws(()=>parseSegments('chunk-00000.m4a,10,5',60),/分段时间/);
});

test('provider handles authentication errors without leaking request details',async()=>{
  await assert.rejects(()=>apiRequest('siliconflow','/chat/completions','fake',{},true,async()=>new Response('secret request details',{status:401})),/401.*API Key/);
  await assert.rejects(()=>apiRequest('invalid','/chat/completions','fake',{}),/服务商/);
  await assert.rejects(()=>apiRequest('siliconflow','/audio/transcriptions','fake',{},false,async()=>{throw new TypeError('fetch failed',{cause:{code:'EACCES'}});}),/EACCES.*正常网络权限/);
});

test('real audio conversion, two-chunk transcription, partial failure, chat and exports',async()=>{
  const temporary=await mkdtemp(path.resolve('.runtime/test-'));
  const exportDir=path.join(temporary,'exports');
  const server=createApp({downloadDirectory:exportDir});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const localFetch=globalThis.fetch;
  let audioCalls=0,failSecond=false,emptySecond=false;
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith(base))return localFetch(url,options);
    assert.match(String(url),/^https:\/\/(api\.siliconflow\.cn|api\.openai\.com)\/v1\//);
    assert.equal(options.headers.Authorization,'Bearer test-key');
    if(String(url).endsWith('/audio/transcriptions')){
      audioCalls++;assert.ok(options.body instanceof FormData);
      const audio=options.body.get('file');assert.ok(audio.size>100);assert.equal(audio.type,'audio/mp4');
      assert.equal(options.body.get('model'),'XingChenAGI/XingChenASR-V3.2-Ultra');
      if(failSecond && audioCalls===2)return new Response('busy',{status:503});
      if(emptySecond && audioCalls===2)return Response.json({text:''});
      return Response.json({text:`第 ${audioCalls} 段：转写内容。`});
    }
    const data=JSON.parse(options.body);assert.equal(data.messages.at(-1).content,'总结');
    assert.equal(data.model,'deepseek-ai/DeepSeek-V4.1-Flash');
    assert.match(data.messages[1].content,/转写/);
    return Response.json({choices:[{message:{content:'总结结果'}}]});
  };
  try {
    assert.equal((await localFetch(base)).status,200);
    assert.equal((await localFetch(base+'/server.mjs')).status,404);
    assert.equal((await localFetch(base+'/api/jobs/none')).status,403);
    const {token}=await(await localFetch(base+'/api/config')).json();
    const headers={'x-app-token':token,'x-provider':'siliconflow','x-api-key':'test-key'};
    assert.equal((await localFetch(base+'/api/export',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
    const input=path.join(temporary,'test.mp3');
    await runFFmpeg(['-nostdin','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','601','-c:a','libmp3lame','-b:a','32k',input]);
    const audio=await readFile(input);
    const start=async()=>{
      const res=await localFetch(base+'/api/transcribe',{method:'POST',headers:{...headers,'x-filename':encodeURIComponent('测试.mp3')},body:audio});
      assert.equal(res.status,202);return (await res.json()).id;
    };
    const poll=async id=>{
      for(let attempt=0;attempt<200;attempt++){
        const job=await(await localFetch(base+'/api/jobs/'+id,{headers})).json();
        if(job.status!=='working')return job;await new Promise(r=>setTimeout(r,100));
      }
      throw new Error('Test job timed out');
    };
    const job=await poll(await start());assert.equal(job.status,'done',job.message);assert.equal(job.total,2);assert.match(job.text,/第 1 段[\s\S]*第 2 段/);
    assert.ok(Math.abs(job.duration-601)<0.2);assert.equal(job.audioCoverageComplete,true);
    assert.equal(job.segments[0].start,0);assert.ok(Math.abs(job.segments[0].end-600)<0.2);
    assert.ok(Math.abs(job.segments[1].end-job.duration)<0.15);assert.equal(job.segments[1].status,'done');
    assert.match(job.text,/\[00:00:00 – 00:10:00\]/);assert.match(job.text,/00:10:01/);
    audioCalls=0;failSecond=true;
    // Completion status is visible just before temporary-file cleanup releases the slot.
    await new Promise(r=>setTimeout(r,200));
    const partial=await poll(await start());assert.equal(partial.status,'error');assert.equal(partial.completed,1);assert.match(partial.text,/第 1 段/);assert.match(partial.message,/503/);
    assert.equal(partial.segments[0].status,'done');assert.equal(partial.segments[1].status,'failed');assert.doesNotMatch(partial.text,/00:10:01/);
    await new Promise(r=>setTimeout(r,200));audioCalls=0;failSecond=false;emptySecond=true;
    const empty=await poll(await start());assert.equal(empty.status,'done');assert.equal(empty.segments[1].status,'empty');assert.match(empty.text,/未返回文字/);
    const chat=await localFetch(base+'/api/chat',{method:'POST',headers,body:JSON.stringify({model:'deepseek-ai/DeepSeek-V4.1-Flash',transcript:job.text,messages:[{role:'user',content:'总结'}]})});assert.equal((await chat.json()).text,'总结结果');
    const markdown=job.text+'\n\n# 录音转写\n\n中文 <内容> & test\n## 要点\n- 事项';
    const md=await localFetch(base+'/api/export',{method:'POST',headers,body:JSON.stringify({text:markdown,format:'md'})});assert.equal(await md.text(),markdown);
    const docx=await localFetch(base+'/api/export',{method:'POST',headers,body:JSON.stringify({text:markdown,format:'docx'})});assert.match(docx.headers.get('content-type'),/wordprocessingml/);
    const data=Buffer.from(await docx.arrayBuffer());assert.equal(data.subarray(0,2).toString(),'PK');assert.ok(data.includes(Buffer.from('&lt;内容&gt; &amp;')));assert.ok(data.includes(Buffer.from('[00:00:00 – 00:10:00]')));
    const {writeFile}=await import('node:fs/promises');await writeFile(path.resolve('.runtime/verified-export.docx'),data);
    assert.deepEqual(await readFile(path.join(exportDir,'转写文稿.docx')),data);
    const save=async()=>{
      const res=await localFetch(base+'/api/export',{method:'POST',headers,body:JSON.stringify({text:markdown,format:'md',filename:'../测试录音.m4a',saveOnly:true})});assert.equal(res.status,200);return res.json();
    };
    const saved=await save(),duplicate=await save();assert.equal(saved.filename,'测试录音.md');assert.equal(duplicate.filename,'测试录音 (1).md');assert.equal(path.dirname(saved.path),exportDir);
    assert.equal((await readFile(saved.path,'utf8')).replace(/^\ufeff/,''),markdown);
    const invalid=await localFetch(base+'/api/transcribe',{method:'POST',headers:{...headers,'x-filename':'bad.exe'},body:'x'});assert.equal(invalid.status,400);
  } finally {globalThis.fetch=localFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
});
