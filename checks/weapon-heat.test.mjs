import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{}};vm.createContext(ctx);for(const n of ['destruction','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx);const S=ctx.window.FSimulation;
const world=()=>({seed:96,stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},walkable:[{x:0,y:0,z:0,w:40,d:40}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{id:0,x:10,y:0,z:10},{id:1,x:12,y:0,z:10},{id:2,x:14,y:0,z:10}],exit:{x:16,y:0,z:10},progression:{version:1,weaponSlots:4,startWeapons:[true,true,true,true],startAmmo:[180,36,12,16],ammoCaps:[180,36,12,16],maxActive:8}});
const fresh=()=>S.create(world()),advance=(s,seconds,input={})=>{for(let t=0;t<seconds-1e-9;t+=1/60)s.step(Math.min(1/60,seconds-t),input);},copy=v=>JSON.parse(JSON.stringify(v));
test('Held rifle fires eighty shots per ten seconds at 30/60/120/144 Hz when heat is isolated',()=>{
 for(const hz of [30,60,120,144]){const sim=fresh();for(let i=0;i<hz*10;i++){sim.state.weaponHeat[0]=sim.state.player.heat=0;sim.state.weaponOverheated[0]=sim.state.player.overheated=false;sim.step(1/hz,{fire:true});assert(sim.state.weaponCooldowns.every(v=>v>=0));sim.state.events.length=0;}assert.equal(sim.state.shots,80,hz+' Hz');}
});
test('Continuous fire has bounded thermal downtime and switching to a cool weapon works immediately',()=>{
 const sim=fresh();let first=-1,over=0;for(let i=0;i<600;i++){sim.step(1/60,{fire:true});if(sim.state.events.some(e=>e.name==='overheat')&&first<0)first=sim.state.time;if(sim.state.player.overheated)over++;sim.state.events.length=0;}
 assert(first>=3.5&&first<=7,first+' s');assert(sim.state.shots>=60&&sim.state.shots<=72,sim.state.shots+' shots');assert(over/600<.25);
 const hot=fresh();for(let i=0;i<600&&!hot.state.weaponOverheated[0];i++)hot.step(1/60,{fire:true});assert(hot.state.weaponOverheated[0]);assert(hot.selectWeapon(1));assert.equal(hot.state.player.overheated,false);assert(hot.fire());assert(hot.state.weaponOverheated[0]);advance(hot,.5);assert(hot.state.weaponOverheated[0]);advance(hot,1.5);assert.equal(hot.state.weaponOverheated[0],false);
});
test('Left-hand heat does not lock the right weapon and pulse cools its own weapon',()=>{
 const sim=fresh();sim.selectLeftWeapon(1);sim.state.weaponHeat[1]=1;sim.state.weaponOverheated[1]=true;assert(sim.fire());assert.equal(sim.fireLeft(),false);assert.equal(sim.state.player.heat,sim.state.weaponHeat[0]);const left=sim.state.weaponHeat[1];sim.pulse();assert.equal(sim.state.weaponHeat[0],0);assert.equal(sim.state.weaponHeat[1],left);
});
test('Thermal state round-trips, old checkpoints migrate and malformed arrays are rejected atomically',()=>{
 const sim=fresh();sim.fire();const saved=sim.snapshot(),restored=fresh();assert(restored.restore(saved));assert.deepEqual(copy(restored.snapshot()),copy(saved));
 const old=copy(saved);delete old.state.weaponHeat;delete old.state.weaponOverheated;old.state.player.heat=.42;old.state.player.overheated=true;assert(restored.restore(old));assert.deepEqual(copy(restored.snapshot()),old);assert(restored.state.weaponHeat.every(v=>v===.42));assert(restored.state.weaponOverheated.every(v=>v===true));
 for(const change of [v=>v.state.weaponHeat.pop(),v=>v.state.weaponHeat[0]=NaN,v=>v.state.weaponOverheated[0]=1,v=>delete v.state.weaponHeat,v=>v.state.weaponHeat[0]=.7]){const bad=copy(saved);change(bad);const before=JSON.stringify(restored.snapshot());assert.equal(restored.restore(bad),false);assert.equal(JSON.stringify(restored.snapshot()),before);}
});
test('Release discards timing credit and snapshot continuation has identical firing cadence',()=>{
 const sim=fresh();sim.step(1/60,{fire:true});advance(sim,1);sim.step(1/60,{fire:true});assert.equal(sim.state.weaponCooldowns[0],.125);
 advance(sim,.65,{fire:true});const clone=fresh();assert(clone.restore(sim.snapshot()));for(let i=0;i<180;i++){sim.step(1/60,{fire:true});clone.step(1/60,{fire:true});assert.equal(sim.state.shots,clone.state.shots);assert.deepEqual(copy(sim.state.weaponHeat),copy(clone.state.weaponHeat));}
});
test('Legacy three-slot worlds retain the original shared thermal format',()=>{const w=world();delete w.progression;const sim=S.create(w);sim.fire();assert(sim.state.player.heat>0);assert.equal(sim.state.weaponHeat,undefined);assert.equal(sim.snapshot().state.weaponHeat,undefined);});
