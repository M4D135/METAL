// Allocation par sim.step sans harnais (delta used_heap_size, GC écartés) + profil d'allocation échantillonné.
// node --max-semi-space-size=128 simalloc.mjs <ferro> [world] [steps]
import {readFileSync} from 'node:fs';import vm from 'node:vm';import v8 from 'node:v8';import inspector from 'node:inspector';import {performance} from 'node:perf_hooks';
const [root,wname='campaign-9',N='600']=process.argv.slice(2);const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation,FBrain}=ctx.window;
const W={'legacy-s0':[0],'campaign-9':[9,{campaign:true,campaignVersion:2}],'campaign-0':[0,{campaign:true,campaignVersion:2}]}[wname];
const world=FWorld.create(96,W[0],W[1]),sim=FSimulation.create(world,{armorSystem:true,brain:FBrain.create({mode:'cpu'})});const s=sim.state;
const input={moveX:0,moveY:1,sprint:true,lookX:.01,lookY:0,fire:false};
for(let i=0;i<120;i++)sim.step(1/60,input);
const heap=()=>v8.getHeapStatistics().used_heap_size;let total=0,n=0;const per=[];
const session=new inspector.Session();session.connect();const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:4096});
for(let i=0;i<+N;i++){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;const h=heap();sim.step(1/60,input);const d=heap()-h;if(d>=0){total+=d;n++;per.push(d);}}
const {profile}=await post('HeapProfiler.stopSampling');
const self=new Map();(function walk(node,stack){const cf=node.callFrame,key=(cf.functionName||'(anon)')+' '+cf.url.split('/').pop()+':'+(cf.lineNumber+1);self.set(key,(self.get(key)||0)+node.selfSize);for(const c of node.children)walk(c,stack);})(profile.head,[]);
const all=[...self.values()].reduce((a,b)=>a+b,0);
per.sort((a,b)=>a-b);
console.log(wname,'KB/step avg',(total/n/1024).toFixed(0),'p50',(per[per.length>>1]/1024).toFixed(0),'p95',(per[Math.floor(per.length*.95)]/1024).toFixed(0),'max',(per.at(-1)/1024).toFixed(0),'enemies',s.enemies.length);
console.log('Allocation échantillonnée (part du total, auto) :');
for(const [k,v] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,14))console.log((v/all*100).toFixed(1).padStart(5)+'%',k);
