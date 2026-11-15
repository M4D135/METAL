import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const c={ArrayBuffer,Float32Array};vm.createContext(c);vm.runInContext(readFileSync(new URL('../src/jobs.js',import.meta.url),'utf8'),c);const J=c.FJobs;
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fake(){let time=0,tick,worker;const w={performance:{now:()=>time},navigator:{hardwareConcurrency:8},document:{hidden:false,querySelectorAll:()=>[{textContent:'// shared source'}]},Blob:class{},URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){}},setInterval(fn){tick=fn;return 1;},clearInterval(){tick=null;},Worker:class{constructor(){worker=this;this.posts=[];this.dead=false;}postMessage(m){this.posts.push(m);}terminate(){this.dead=true;}}};return{w,get worker(){return worker;},receive:m=>worker.onmessage({data:m}),advance(n){time+=n;tick?.();}};}
test('stream preserves object key order and bounds large array messages',()=>{
 const data={a:1,meshes:Array.from({length:4501},(_,i)=>({id:i,p:[i,2,3]})),seed:96,colliders:[{x:1}],notes:'test'},messages=[];J.stream(9,data,m=>messages.push(m));assert.equal(messages[0].t,'head');assert.deepEqual(Object.keys(messages[0].value),Object.keys(data));const out=structuredClone(messages[0].value);for(const m of messages.slice(1,-1)){assert(m.value.length<=2000);assert.equal(m.at,out[m.key].length);out[m.key].push(...m.value);}assert.equal(JSON.stringify(out),JSON.stringify(data));assert.equal(messages.at(-1).t,'done');assert.throws(()=>J.stream(1,{},()=>{},0));
});
test('worker protocol assembles streamed values and transfers PCM buffers',async()=>{
 const f=fake(),j=J.create({environment:f.w,handlers:{world:()=>{}},bootstrap:'boot();'}),p=j.request('world',{seed:96});assert.equal(j.mode,'starting');assert.equal(f.worker.posts.length,0);f.receive({t:'ready'});assert.equal(j.mode,'worker');const id=f.worker.posts[0].id,pcm=new Float32Array([.1,-.2]),trans=[];
 J.stream(id,{meshes:[{id:1},{id:2}],pcm},(message,buffers)=>{trans.push(...(buffers||[]));f.receive(message);},1);const out=await p;assert.equal(out.meshes.length,2);assert.equal(out.pcm,pcm);assert(trans.includes(pcm.buffer));assert.equal(j.stats.chunks,2);j.dispose();assert(f.worker.dead);
});
test('a startup failure or invalid partial stream retries the same job locally',async()=>{
 for(const failure of ['startup','stream']){const f=fake();let calls=0;const j=J.create({environment:f.w,handlers:{world:q=>{calls++;return {seed:q.seed,meshes:[1,2]};}},bootstrap:'boot();'}),p=j.request('world',{seed:7});if(failure==='startup')f.worker.onerror({preventDefault(){}});else{f.receive({t:'ready'});f.receive({t:'head',id:1,value:{meshes:[]}});f.receive({t:'part',id:1,key:'meshes',at:3,value:[999]});}assert.deepEqual(await p,{seed:7,meshes:[1,2]});assert.equal(calls,1);assert.equal(j.mode,'main');assert(f.worker.dead);j.dispose();}
});
test('watchdog suspends while hidden and recovers a stuck worker once visible',async()=>{
 const f=fake(),j=J.create({environment:f.w,handlers:{value:()=>42},bootstrap:'boot();'}),p=j.request('value',{});f.w.document.hidden=true;f.advance(5000);assert.equal(j.mode,'starting');f.w.document.hidden=false;f.advance(1000);assert.equal(j.mode,'starting');f.advance(3001);assert.equal(await p,42);assert.equal(j.reason,'timeout');j.dispose();
});
test('disposal rejects in-flight work, ignores stale messages, and rejects later calls',async()=>{
 const f=fake(),j=J.create({environment:f.w,handlers:{value:()=>42},bootstrap:'boot();'}),p=j.request('value',{});j.dispose();await assert.rejects(p,/disposed/);f.receive({t:'done',id:1});await assert.rejects(j.request('value'),/disposed/);
});
test('no worker, constrained mobile and explicit main mode retain working handlers',async()=>{
 for(const kind of ['absent','mobile','forced']){const f=fake();if(kind==='absent')delete f.w.Worker;if(kind==='mobile'){f.w.matchMedia=()=>({matches:true});f.w.navigator.hardwareConcurrency=2;}const j=J.create({environment:f.w,handlers:{value:q=>q+1},bootstrap:'boot();',forceMain:kind==='forced'});assert.equal(j.mode,'main');assert.equal(await j.request('value',4),5);await assert.rejects(j.request('missing'),/Unknown/);j.dispose();}
});
test('worker server returns errors and answers pings without executing an unknown job',async()=>{
 const messages=[],endpoint={postMessage:m=>messages.push(m)};J.serve({ok:q=>({value:q}),bad:()=>{throw new Error('bad data');}},endpoint);assert.equal(messages[0].t,'ready');await endpoint.onmessage({data:{t:'ping'}});assert.equal(messages[1].t,'pong');await endpoint.onmessage({data:{t:'job',id:1,name:'bad'}});assert.equal(messages.at(-1).t,'error');await endpoint.onmessage({data:{t:'job',id:2,name:'ok',data:7}});assert.equal(messages.at(-1).t,'done');assert.equal(messages.at(-2).value.value,7);
});
