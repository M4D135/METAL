import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const context={window:{}};vm.createContext(context);
for(const name of ['fmath','passages','renderer','world','destruction','economy','simulation']){
 let code=readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8');
 if(name==='simulation'){
  const marker='return {state:s,get destruction';assert.equal(code.split(marker).length,2);
  // Test-only facade in evaluated memory: no production file is written.
  code=code.replace(marker,'return {__reviewSync:syncDestruction,__reviewSystems:updateSystems,__reviewPump:pumpNav,state:s,get destruction');
 }
 vm.runInContext(code,context);
}
const {FSimulation}=context.window;
function fixture(decor=false){const w={seed:'review-nav-contract',stage:0,generation:5,spawn:{x:0,z:0,yaw:0},bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},enemies:[{x:-15,z:-8,type:0},{x:-15,z:15,type:0}],pickups:[],cores:[{id:0,x:15,z:20},{id:1,x:18,z:20},{id:2,x:21,z:20}],exit:{x:24,z:20},meshes:[{shape:'box',p:[0,2,-8],s:[12,4,.18],r:[0,0,0],mat:3}],lights:[],walkable:[{x:0,y:0,z:0,w:60,d:60}],colliders:[{minX:-6,maxX:6,minY:0,maxY:4,minZ:-8.09,maxZ:-7.91,mesh:0}],destructibles:[{id:'wall',kind:'wall',strength:18,meshes:[0],colliders:[0]}]};if(decor){w.meshes.unshift({shape:'box',p:[0,1,10],s:[.4,2,.4],mat:3});w.colliders[0].mesh=1;w.destructibles[0].meshes=[1];w.destructibles.unshift({id:'tree',kind:'tree',strength:5,meshes:[0],colliders:[]});}return w;}
function prepare(decor=false){const sim=FSimulation.create(fixture(decor));for(const e of sim.state.enemies){e.goalX=15;e.goalZ=e.z;e.path=[sim.nav.idx(15,e.z)];e.pathAt=0;e.planWait=1.5;e.thinkWait=1;}return sim;}
function cut(sim){assert(sim.destruction.blast([0,1.25,-8.44],2.8,55).changed);sim.__reviewSync();assert.equal(sim.blocked(0,-8),false);}
function flushSystems(sim){sim.__reviewSystems(0);}
test('local invalidation catches string-pulled crossing segment but preserves distant route and wait',()=>{const sim=prepare(),[cross,far]=sim.state.enemies,farPath=far.path;cut(sim);assert.equal(cross.planWait,1.5);flushSystems(sim);assert.equal(cross.planWait,0);assert.equal(cross.path.length,0);assert.equal(far.planWait,1.5);assert.strictEqual(far.path,farPath);sim.__reviewPump();assert(sim.state.aiStats.navUpdates>0&&sim.state.aiStats.navUpdates<768);});
test('decorative revision and render offset change leave nav map, cached edges and actor routes untouched',()=>{const sim=prepare(true),before=Array.from(sim.nav.cells),paths=sim.state.enemies.map(e=>e.path);sim.nav.edgeKnown.fill(7);sim.nav.edgeOpen.fill(5);assert(sim.destruction.hit([0,1,10],100,[0,0,1]).changed);sim.__reviewSync();flushSystems(sim);sim.__reviewPump();assert.deepEqual(Array.from(sim.nav.cells),before);assert(sim.nav.edgeKnown.every(v=>v===7));assert(sim.nav.edgeOpen.every(v=>v===5));assert.equal(sim.state.aiStats.navUpdates,0);for(let i=0;i<paths.length;i++){assert.strictEqual(sim.state.enemies[i].path,paths[i]);assert.equal(sim.state.enemies[i].planWait,1.5);}});
test('unknown solid dirty area conservatively resets all paths and queues full grid in bounded batches',()=>{const sim=prepare();const original=sim.destruction.delta;sim.destruction.delta=cursor=>{const q=original(cursor);return {...q,dirtyAABB:null,colliders:{...q.colliders,dirtyAABB:null}};};sim.nav.edgeKnown.fill(7);sim.nav.edgeOpen.fill(5);cut(sim);flushSystems(sim);for(const e of sim.state.enemies){assert.equal(e.path.length,0);assert.equal(e.planWait,0);}assert(sim.nav.edgeKnown.every(v=>v===0));assert(sim.nav.edgeOpen.every(v=>v===0));sim.__reviewPump();assert.equal(sim.state.aiStats.navUpdates,768);assert(sim.state.aiStats.navPending>0);});

test('checkpoint after a breach matches restored nav; invalid restoration preserves live state and cursor',()=>{
const world={seed:'review-nav-delay',stage:0,generation:5,spawn:{x:0,z:0,yaw:0},bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},enemies:[],pickups:[],cores:[{id:0,x:15,z:15},{id:1,x:18,z:15},{id:2,x:21,z:15}],exit:{x:24,z:15},meshes:[{shape:'box',p:[0,2,-8],s:[12,4,.18],r:[0,0,0],mat:3}],lights:[],walkable:[{x:0,y:0,z:0,w:60,d:60}],colliders:[{minX:-6,maxX:6,minY:0,maxY:4,minZ:-8.09,maxZ:-7.91,mesh:0}],destructibles:[{id:'wall',kind:'wall',strength:18,meshes:[0],colliders:[0]}]};
const sim=FSimulation.create(world);const idx=sim.nav.idx(0,-8);assert.equal(sim.nav.cells[idx],0);
assert(sim.destruction.blast([0,1.25,-8.44],2.8,55).changed);sim.step(0);
assert.equal(sim.blocked(0,-8),false,'physical breach immediate');
const beforeSnapshot={nav:sim.nav.cells[idx],updates:sim.state.aiStats.navUpdates,pending:sim.state.aiStats.navPending};
const saved=sim.snapshot(),copy=FSimulation.create(world);assert(copy.restore(saved));
const result={beforeSnapshot,liveNavAfterSnapshot:sim.nav.cells[idx],restoredNav:copy.nav.cells[idx],equalAfterSnapshot:JSON.stringify(Array.from(sim.nav.cells))===JSON.stringify(Array.from(copy.nav.cells))};
assert.equal(result.equalAfterSnapshot,true,'checkpoint must materialise deferred dirty nav, including navDelay before anything entered navPending');
const stable=JSON.stringify(sim.snapshot()),destruction=sim.destruction,token=destruction.delta().token,meshes=destruction.meshes,colliders=destruction.colliders;
for(const alter of [q=>{q.destruction.signature='wrong';},q=>{q.timers.fireWait=-1;},q=>{q.state.player.hp=NaN;}]){
 const invalid=JSON.parse(stable);alter(invalid);assert.equal(sim.restore(invalid),false);assert.equal(JSON.stringify(sim.snapshot()),stable);assert.strictEqual(sim.destruction,destruction);assert.strictEqual(destruction.meshes,meshes);assert.strictEqual(destruction.colliders,colliders);assert.strictEqual(destruction.delta(token).token,token);assert.equal(destruction.delta(token).full,false);
}
});
