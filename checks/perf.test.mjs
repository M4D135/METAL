// Modest computers (David, 16/11/2026): first-launch preset and effect governor.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{}};vm.createContext(ctx);
for(const n of ['perf','options'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});
const {MetalPerf:P,FOptions:O}=ctx.window;

test('The graphics chip, cores and memory choose a tier',()=>{
  const tier=(name,cores=8,memory=8)=>P.tier({name,cores,memory});
  for(const name of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)','Intel(R) HD Graphics 5500','Mesa Intel(R) UHD Graphics 600 (GLK 3)','ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)','llvmpipe (LLVM 15.0.7, 256 bits)','Mali-G52','Adreno (TM) 506','AMD Radeon(TM) Vega 8 Graphics'])assert.equal(tier(name),'low',name);
  for(const name of ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)','Apple M1','ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)','AMD Radeon Graphics','',undefined])assert.equal(tier(name),'mid',String(name));
  for(const name of ['NVIDIA GeForce RTX 3060/PCIe/SSE2','ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11)','AMD Radeon RX 6700 XT','Apple M3 Max'])assert.equal(tier(name),'high',name);
  assert.equal(tier('NVIDIA GeForce RTX 4090',2),'low','two cores');assert.equal(tier('Apple M1',8,2),'low','two gigabytes');
});

test('The first launch lightens integrated graphics once, and never the native resolution',()=>{
  const prefs=O.defaults(false);assert.equal(prefs.autoTune,true);assert.equal(prefs.perfVersion,undefined);
  const done=P.preset(prefs,{tier:'low'});assert.equal([...done.changes].sort().join(),'bloom,quality,reflections,shadows');
  assert.equal(prefs.quality,'low');assert.equal(prefs.reflections,'off');assert.equal(prefs.shadows,false);assert.equal(prefs.bloom,false);assert.equal(prefs.renderScale,1);assert.equal(prefs.perfVersion,1);
  prefs.shadows=true;assert.equal(P.preset(prefs,{tier:'low'}),null);assert.equal(prefs.shadows,true,'a later choice stays');
  const mid=O.defaults(false);P.preset(mid,{tier:'mid'});assert.equal(mid.quality,'auto');assert.equal(mid.reflections,'probe');assert.equal(mid.perfVersion,1);
  assert.equal(O.normalize({perfVersion:1}).perfVersion,1);assert.equal(O.normalize({perfVersion:7}).perfVersion,undefined);assert.equal(O.normalize({autoTune:false}).autoTune,false);
});

test('The governor switches one effect off after a sustained low frame rate, then waits',()=>{
  const g=P.governor(),prefs=O.defaults(false),feed=(fps,n,playing=true,cadence=60)=>{const steps=[];for(let i=0;i<n;i++){const s=g.sample(fps,{cadence,playing,prefs});if(s){steps.push(s.key);prefs[s.key]=s.value;}}return steps;};
  assert.deepEqual(feed(30,20,false),[],'never outside play');
  assert.deepEqual(feed(58,30),[],'a healthy frame rate changes nothing');
  assert.deepEqual(feed(40,6),['reflections']);assert.deepEqual(feed(40,8),[],'waits after a step');
  assert.deepEqual(feed(40,6),['shadows']);feed(40,8);assert.deepEqual(feed(40,6),['bloom']);feed(40,8);assert.deepEqual(feed(40,6),['quality']);feed(40,8);
  assert.deepEqual(feed(40,30),[],'nothing left to switch off');assert.equal(prefs.renderScale,1,'the native resolution is never lowered');
  const calm=P.governor(),off={...O.defaults(false),autoTune:false};for(let i=0;i<30;i++)assert.equal(calm.sample(10,{cadence:60,playing:true,prefs:off}),null);
  const thirty=P.governor(),p30=O.defaults(false);let step=null;for(let i=0;i<12&&!step;i++)step=thirty.sample(27,{cadence:30,playing:true,prefs:p30});assert.equal(step,null,'27 fps is fine at a 30 fps cadence');
});
