import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
function load(api={}){
  const window={...api},context={window,setTimeout,clearTimeout};vm.createContext(context);
  for(const name of ['brain','destruction','economy','simulation'])vm.runInContext(readFileSync(root+'src/'+name+'.js','utf8'),context,{filename:name+'.js'});
  return window;
}
// The stub independently evaluates the actual graph submitted to WebNN; it does
// not call FBrain.cpu or know its weights. This tests both graph and tensor API.
function webnn(options={}){
  const control={contexts:[],options:[],dispatches:0,reads:0,hold:false,reject:false,corrupt:false,waiting:[]};
  const descriptor=(shape,data)=>({shape,data:new Float32Array(data)});
  function evalNode(node,inputs){
    if(node.kind==='input')return descriptor(node.shape,inputs[node.name].data);
    if(node.kind==='constant')return descriptor(node.shape,node.data);
    const a=evalNode(node.a,inputs),b=node.b&&evalNode(node.b,inputs);
    if(node.kind==='relu')return descriptor(a.shape,a.data.map(v=>Math.max(0,v)));
    if(node.kind==='add')return descriptor(a.shape,a.data.map((v,i)=>v+b.data[i%b.data.length]));
    const [rows,inner]=a.shape,cols=b.shape[1],data=new Float32Array(rows*cols);
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){let sum=0;for(let k=0;k<inner;k++)sum+=a.data[i*inner+k]*b.data[k*cols+j];data[i*cols+j]=sum;}
    return descriptor([rows,cols],data);
  }
  class Builder{
    constructor(context){this.context=context;}
    input(name,d){return {kind:'input',name,shape:d.shape};}
    constant(d,data){return {kind:'constant',shape:d.shape,data:new Float32Array(data)};}
    matmul(a,b){return {kind:'matmul',a,b};}
    add(a,b){return {kind:'add',a,b};}
    relu(a){return {kind:'relu',a};}
    async build(outputs){const graph={node:outputs.scores,destroyed:false,destroy(){this.destroyed=true;}};this.context.graph=graph;return graph;}
  }
  const ml={async createContext(arg){
    control.options.push(arg);if(options.failCreate)throw new Error('unsupported');
    let lose;const context={accelerated:options.accelerated===undefined?true:options.accelerated,tensors:[],destroyed:false,lost:new Promise(resolve=>{lose=resolve;}),lose,
      async createTensor(d){const tensor={...d,data:new Float32Array(d.shape.reduce((a,b)=>a*b,1)),destroyed:false,destroy(){this.destroyed=true;}};this.tensors.push(tensor);return tensor;},
      writeTensor(tensor,data){assert.equal(this.destroyed,false);tensor.data.set(data);},
      dispatch(graph,inputs,outputs){control.dispatches++;assert.equal(graph.destroyed,false);outputs.scores.data.set(evalNode(graph.node,inputs).data);},
      readTensor(tensor){control.reads++;if(control.reject)return Promise.reject(new Error('device failed'));const data=tensor.data.slice();if(control.corrupt)data[0]=NaN;if(control.hold)return new Promise((resolve,reject)=>control.waiting.push({resolve:()=>resolve(data.buffer),reject}));return Promise.resolve(data.buffer);},
      destroy(){this.destroyed=true;lose({message:'destroyed'});}};
    context.lose=lose;control.contexts.push(context);
    if(options.holdCreate)await new Promise(resolve=>{control.releaseCreate=resolve;});
    return context;
  }};
  return {control,navigator:{ml},MLGraphBuilder:Builder};
}
const rows=Array.from({length:16},(_,n)=>Array.from({length:16},(_,i)=>((n*11+i*7+3)%37)/36));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const json=v=>JSON.parse(JSON.stringify(v));
const maxIndex=(scores,start=0,end=4)=>{let best=start;for(let i=start+1;i<end;i++)if(scores[i]>scores[best])best=i;return best;};

test('The original CPU network has finite bounded scores and meaningful approach, flank, retreat and hold decisions',()=>{
  const {FBrain}=load(),inputs=[
    [.8,0,0,1,1,0,0,0,1,0,0,1,0,0,0,0],
    [.35,0,0,1,1,0,0,0,0,1,0,1,0,0,0,0],
    [.08,.8,.8,1,1,.3,.2,0,0,0,0,1,0,0,1,0],
    [.375,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0]
  ],scores=FBrain.cpu(inputs);
  assert.deepEqual(inputs.map((_,i)=>maxIndex(scores.slice(i*8,i*8+8))),[0,1,2,3]);
  assert(Array.from(scores).every(Number.isFinite));assert.equal(FBrain.cpu(rows).length,128);
  assert.throws(()=>FBrain.cpu([Array(16).fill(NaN)]));assert.throws(()=>FBrain.cpu(Array(17).fill(rows[0])));
  assert.throws(()=>FBrain.cpu([Array(15).fill(0)]));
});

test('WebNN builds once, uses the current accelerated/low-power API, and matches the independent CPU path',async()=>{
  const stub=webnn(),{FBrain}=load(stub),brain=FBrain.create({mode:'auto'});
  const [a,b]=await Promise.all([brain.prepare(),brain.prepare()]);assert.equal(a.backend,'webnn');assert.equal(b.accelerated,true);
  assert.equal(stub.control.contexts.length,1);assert.deepEqual(json(stub.control.options[0]),{powerPreference:'low-power',accelerated:true});
  assert.match(brain.status.label,/non exposé/);assert.doesNotMatch(brain.status.label,/NPU actif/);
  const actual=await brain.evaluate(rows),expected=FBrain.cpu(rows);assert.equal(actual.backend,'webnn');assert.equal(actual.count,16);
  for(let i=0;i<expected.length;i++)assert(Math.abs(actual.scores[i]-expected[i])<1e-5);
  await brain.prepare();assert.equal(stub.control.contexts.length,1,'The graph is reused across sector preparation');
  assert.equal(stub.control.dispatches,2,'One actual warmup and one gameplay batch');
  brain.dispose();assert(stub.control.contexts[0].destroyed);assert(stub.control.contexts[0].tensors.every(t=>t.destroyed));
});

test('Unavailable, rejected and unverified accelerators fall back honestly to the same CPU scores',async()=>{
  for(const api of [{},webnn({failCreate:true}),webnn({accelerated:false}),webnn({accelerated:null})]){
    const {FBrain}=load(api),brain=FBrain.create();await brain.prepare();assert.equal(brain.status.backend,'cpu');assert.equal(brain.status.accelerated,false);
    assert.deepEqual(Array.from(brain.evaluate(rows).scores),Array.from(FBrain.cpu(rows)));brain.dispose();
  }
});

test('Mode switches dispose device resources and a failed or lost context returns to functional CPU decisions',async()=>{
  const stub=webnn(),{FBrain}=load(stub),brain=FBrain.create();await brain.prepare();const first=stub.control.contexts[0];
  await brain.setMode('cpu');assert(first.destroyed);assert.equal(brain.status.reason,'selected');assert.equal(brain.evaluate(rows).backend,'cpu');
  await brain.setMode('auto');assert.equal(stub.control.contexts.length,2);stub.control.reject=true;
  const failed=await brain.evaluate(rows);assert.equal(failed.backend,'cpu');assert.deepEqual(Array.from(failed.scores),Array.from(FBrain.cpu(rows)));assert.equal(brain.status.reason,'inference-failed');
  stub.control.reject=false;await brain.setMode('auto');stub.control.contexts.at(-1).lose({message:'unplugged'});await flush();assert.equal(brain.status.backend,'cpu');assert.equal(brain.status.reason,'context-lost');brain.dispose();
});

test('Inference has one in-flight dispatch, a deadline, numeric rejection and no unbounded hardware queue',async()=>{
  const stub=webnn(),{FBrain}=load(stub),brain=FBrain.create();await brain.prepare();stub.control.hold=true;
  const pending=brain.evaluate(rows),before=stub.control.dispatches;
  for(let i=0;i<20;i++)assert.equal(brain.evaluate(rows).backend,'cpu');assert.equal(stub.control.dispatches,before);
  const timed=await pending;assert.equal(timed.backend,'cpu');assert.equal(brain.status.reason,'inference-timeout');
  stub.control.waiting.shift().resolve();await flush();assert.equal(brain.status.backend,'cpu');
  stub.control.hold=false;await brain.setMode('auto');stub.control.corrupt=true;assert.equal((await brain.evaluate(rows)).backend,'cpu');brain.dispose();
});

test('A context created after cancellation is destroyed and cannot revive a CPU-selected backend',async()=>{
  const stub=webnn({holdCreate:true}),{FBrain}=load(stub),brain=FBrain.create(),pending=brain.prepare();
  await flush();await brain.setMode('cpu');stub.control.releaseCreate();await pending;
  assert.equal(brain.status.backend,'cpu');assert.equal(brain.status.reason,'selected');assert(stub.control.contexts[0].destroyed);brain.dispose();
});

function world(extra={}){return {seed:'brain',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:45,z:45},{x:48,z:45},{x:51,z:45}],exit:{x:54,z:45},...extra};}
function advance(sim,seconds){for(let t=0;t<seconds-1e-8;t+=.025){sim.state.player.hp=100;sim.step(Math.min(.025,seconds-t));}}
function delayed(){const requests=[];return {requests,status:{generation:0},evaluate(features){let resolve;const promise=new Promise(r=>{resolve=r;});requests.push({features,resolve});return promise;}};}
function answer(request,action=1,generation=0){const scores=new Float32Array(request.features.length*8);for(let i=0;i<request.features.length;i++)scores[i*8+action]=9;request.resolve({scores,count:request.features.length,backend:'webnn',generation});}

test('Real CPU neural scores alter an observed enemy flank through normal navigation and preserve wall collision',()=>{
  const {FBrain,FSimulation}=load(),w=world({enemies:[{x:0,y:0,z:-12,type:1,role:'flanker'}],colliders:[{minX:1.25,maxX:1.35,minY:0,maxY:3,minZ:-15,maxZ:-6}]}),brain=FBrain.create({mode:'cpu'}),sim=FSimulation.create(w,{brain}),baseline=FSimulation.create(w);
  sim.state.enemies[0].cooldown=baseline.state.enemies[0].cooldown=30;advance(sim,3.5);advance(baseline,3.5);
  const enemy=sim.state.enemies[0];assert(sim.state.aiStats.neuralApplied>0);assert.equal(sim.state.aiStats.neuralBackend,'cpu');assert(Math.abs(enemy.x-baseline.state.enemies[0].x)>.2,'The network must change actual movement, not only a label');assert.equal(sim.blocked(enemy.x,enemy.z,.38,enemy.baseY),false);
  assert(sim.state.aiStats.pathSearches<=2);brain.dispose();
});

test('Only observed information enters the policy; hidden player coordinates and undeployed reserves never enter a batch',()=>{
  const {FSimulation}=load(),captured=[];
  for(const px of [-10,10]){
    const spy={status:{generation:0},evaluate(features){captured.push(json(features));return {scores:new Float32Array(features.length*8),count:features.length,backend:'cpu',generation:0};}};
    const sim=FSimulation.create(world({spawn:{x:px,y:0,z:0,yaw:0},colliders:[{minX:-30,maxX:30,minY:0,maxY:5,minZ:-2.1,maxZ:-1.9}],enemies:[{x:0,y:0,z:-12,type:1}],progression:{version:1,maxActive:8,startWeapons:[true,false,false],startAmmo:[48,0,0]}}),{brain:spy});
    Object.assign(sim.state.enemies[0],{hasMemory:true,active:true,seen:false,lastSeenX:0,lastSeenY:1.45,lastSeenZ:-5,memory:7,cooldown:30,thinkWait:2});sim.step(.025);
  }
  assert.equal(captured.length,2);assert.deepEqual(captured[0],captured[1]);assert.equal(captured[0][0][3],0,'The policy knows that the current target is not visible');
  let calls=0;const brain={status:{generation:0},evaluate(){calls++;throw new Error('A reserve must never be evaluated');}};
  const sim=FSimulation.create(world({progression:{version:1,maxActive:8,startWeapons:[true,false,false],startAmmo:[48,0,0]},enemies:[{x:0,y:0,z:-4,type:0,deployed:false}],encounters:[{id:'later',trigger:{x:40,y:0,z:40,w:4,d:4},maxActive:4,waves:[{enemyIds:[0]}],spawnEntries:[{x:0,y:0,z:-4}]}]}),{brain});advance(sim,1);assert.equal(calls,0);
});

test('Late inference is rejected after elapsed observation time, destruction, mode change or snapshot/restore',async()=>{
  const {FSimulation}=load();
  for(const cause of ['time','destruction','mode','restore']){
    const brain=delayed(),wall={minX:4.75,maxX:5.25,minY:0,maxY:3,minZ:-7,maxZ:-3},w=world({enemies:[{x:0,y:0,z:-12,type:1}],meshes:[{shape:'box',p:[5,1.5,-5],s:[.5,3,4],r:[0,0,0],mat:1}],colliders:[{...wall,mesh:0}],destructibles:[{id:'wall',kind:'wall',strength:3,meshes:[0],colliders:[0]}]}),sim=FSimulation.create(w,{brain});
    sim.state.enemies[0].cooldown=30;sim.step(.025);assert.equal(brain.requests.length,1);
    if(cause==='time')advance(sim,.85);
    if(cause==='destruction'){sim.destruction.blast([5,1.4,-5],3,50);sim.step(.025);assert(sim.state.destructionRevision>0);}
    if(cause==='mode')brain.status.generation++;
    if(cause==='restore'){const save=sim.snapshot();assert.equal(sim.restore(save),true);}
    answer(brain.requests[0]);await flush();sim.step(.025);assert.equal(sim.state.aiStats.neuralApplied,0,cause+' accepted an obsolete result');
    sim.dispose();
  }
});

test('Current asynchronous scores affect real tactics and disposal prevents an old sector from receiving future work',async()=>{
  const {FSimulation}=load(),brain=delayed(),sim=FSimulation.create(world({enemies:[{x:0,y:0,z:-12,type:1}]}),{brain});sim.state.enemies[0].cooldown=30;
  sim.step(.025);answer(brain.requests[0]);await flush();sim.step(.025);assert.equal(sim.state.aiStats.neuralApplied,0,'early advice must wait for its simulation deadline');advance(sim,.225);assert.equal(sim.state.aiStats.neuralApplied,1);assert.equal(sim.state.aiStats.neuralBackend,'webnn');
  sim.state.enemies[0].planWait=sim.state.enemies[0].thinkWait=0;sim.step(.025);assert.equal(sim.state.enemies[0].tactic,'flank');assert(Math.abs(sim.state.enemies[0].goalX)>1);
  advance(sim,.3);const request=brain.requests.at(-1);sim.dispose();answer(request);await flush();sim.step(.025);assert.equal(sim.state.aiStats.neuralApplied,1);
});

test('Boss policy uses the same neural scores to choose a different telegraphed attack inside its scripted family',()=>{
  const {FBrain,FSimulation}=load(),w=world({spawn:{x:0,y:0,z:23,yaw:0},enemies:[{x:0,y:0,z:0,type:3,bossScale:5.4,bossKind:'colossus',bossName:'Test',arena:{x:0,z:0,r:28},maxHp:130}]}),brain=FBrain.create({mode:'cpu'}),sim=FSimulation.create(w,{brain}),baseline=FSimulation.create(w);
  advance(sim,1.9);advance(baseline,1.9);const actual=sim.state.events.find(e=>e.name==='bossTell'),old=baseline.state.events.find(e=>e.name==='bossTell');
  assert.equal(actual.kind,'ring');assert.equal(old.kind,'slam');assert(sim.state.bossAttacks.every(a=>a.warning&&!a.active&&a.tell>=1.3));assert.equal(sim.state.player.hp,100);assert(sim.state.enemies[0].bossClock>2.6);brain.dispose();
});

test('Scheduling stays at four bounded batches per second and never waits for hardware during a simulation step',()=>{
  const {FSimulation}=load(),brain=delayed(),sim=FSimulation.create(world({enemies:Array.from({length:24},(_,i)=>({x:(i%6-2.5)*3,y:0,z:-8-Math.floor(i/6)*3,type:0}))}),{brain});
  for(const e of sim.state.enemies)e.cooldown=30;advance(sim,1);assert.equal(brain.requests.length,4,'Late results are abandoned at the four-per-second simulation deadline');assert(brain.requests[0].features.length<=16);assert(sim.state.time>=.99);sim.dispose();
});
