import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadRealm} from '../tools/realm-loader.mjs';
const wasm={console,URL,TextEncoder,TextDecoder,performance,setTimeout,clearTimeout,atob};wasm.window=wasm;wasm.self=wasm;wasm.globalThis=wasm;vm.createContext(wasm);
for(const name of ['physx-runtime','physx'])vm.runInContext(readFileSync(new URL('../src/ferro/'+name+'.js',import.meta.url),'utf8'),wasm);await wasm.FPhysX.init();
const {FWorld,FSimulation}=loadRealm({globals:{FPhysX:wasm.FPhysX},modules:['fmath','passages','renderer','physics-geometry','profiles','world','destruction','economy','actors','simulation']}).window;
const overlaps=(a,b)=>['X','Y','Z'].every(k=>a['max'+k]>b['min'+k]+1e-6&&a['min'+k]<b['max'+k]-1e-6);
const wall={minX:1.5,maxX:1.6,minY:0,maxY:4,minZ:-5,maxZ:5};
const fixture=()=>({seed:96,stage:0,generation:6,index:0,spawn:{x:-8,y:0,z:-8,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},walkable:[{x:0,y:0,z:0,w:40,d:40}],colliders:[wall],enemies:[],pickups:[],cores:[8,10,12].map((x,id)=>({id,x,y:0,z:8})),exit:{x:18,y:0,z:18},traps:[{id:'wheel',kind:'blade',x:0,y:.1,baseY:0,z:0,w:.3,d:1.6,h:1.8,axis:'x',travel:4,period:8,active:2,warning:1,phase:0,damage:26}]});
test('the actual wheel simulation stops before a thin wall throughout its cycle',()=>{
 const w=fixture(),s=FSimulation.create(w);let maxX=-Infinity,minX=Infinity;
 for(let i=0;i<1200;i++){
  s.step(1/120);const b=s.state.traps[0].box;assert(!overlaps(b,wall));assert(b.maxX<=wall.minX+1e-7);maxX=Math.max(maxX,b.maxX);minX=Math.min(minX,b.minX);
 }
 assert(wasm.FPhysX.queryCount>0,'METAL trap code must use the real WASM queries');
 assert(maxX>1.49&&minX< -4,'the wheel still moves and reaches its wall stop');
 const copy=FSimulation.create(w);assert(copy.restore(s.snapshot()));
 for(let i=0;i<120;i++){s.step(1/120);copy.step(1/120);assert.deepEqual(copy.state.traps,s.state.traps);}
});
test('a legacy wheel initially embedded in a wall is recovered toward its rail centre',()=>{
 const w=fixture(),s=FSimulation.create(w),t=s.state.traps[0];
 t.box={minX:1.45,maxX:1.75,minY:.1,maxY:1.9,minZ:-.8,maxZ:.8};s.step(1/120);
 assert(!overlaps(t.box,wall));assert(t.box.maxX<=wall.minX);assert(FSimulation.create(w).restore(s.snapshot()));
});
test('generated presses and wheels stay outside static walls and retain valid checkpoints',()=>{
 for(const seed of [1,96,2026])for(const index of [0,2,5]){
  const w=FWorld.create(seed,index,{campaign:true,campaignVersion:2,profiles:true});w.enemies=[];w.encounters=[];
  const s=FSimulation.create(w);
  for(let i=0;i<200;i++){
   s.step(.05);
   for(const t of s.state.traps)if(t.box&&!t.destroyed)for(const c of w.colliders)assert(!overlaps(t.box,c),`${seed}/${index} ${t.id} overlaps a static collider at ${s.state.time}`);
   if(i===0||i===60||i===199)assert(FSimulation.create(w).restore(s.snapshot()),`${seed}/${index}: checkpoint ${i}`);
  }
 }
});
