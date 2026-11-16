import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation,FMotion,MetalProfiles}=loadRealm({modules:['fmath','passages','renderer','physics-geometry','profiles','world','destruction','economy','motion','simulation']}).window;
const fixture=(extra={})=>({seed:96,index:0,stage:0,generation:6,campaign:true,campaignVersion:2,profileVersion:1,progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},spawn:{x:0,y:2,z:0,yaw:0},bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},walkable:[{x:0,y:0,z:0,w:200,d:200}],colliders:[],enemies:[],pickups:[],cores:[85,88,91].map((x,id)=>({id,x,y:0,z:85})),exit:{x:94,y:0,z:85},...extra});
const advance=(s,time,input={},fps=120)=>{for(let t=0;t<time-1e-9;t+=1/fps)s.step(Math.min(1/fps,time-t),input);};
const plain=x=>JSON.parse(JSON.stringify(x));
// Expeditions start with the heavy: these scenarios start with the drone.
const drone=(w=fixture())=>FSimulation.create(w,{profiles:MetalProfiles.fresh(undefined,'light')});
test('the drone flies level like the walking heavy whatever the view pitch, climbs and descends on its buttons, and hovers without fuel',()=>{
 for(const fps of [20,60,120]){
  const s=drone(),p=s.state.player;p.pitch=Math.PI/4;
  advance(s,1,{moveY:1},fps);assert(p.z< -3);assert(Math.abs(p.y-2)<1e-9,'looking up does not climb');assert.equal(s.state.jetpack.fuel,4);
  p.pitch=-Math.PI/4;let y=p.y;advance(s,.5,{moveY:1},fps);assert(Math.abs(p.y-y)<1e-9,'looking down does not dive');
  advance(s,2,{},fps);const stopped=[p.x,p.y,p.z];advance(s,12,{},fps);
  assert.deepEqual([p.x,p.y,p.z],stopped);assert(p.airborne);assert(!s.state.dead);
  y=p.y;advance(s,.5,{moveX:1},fps);assert(p.x>1);assert(Math.abs(p.y-y)<1e-6);
  advance(s,1,{jumpHeld:true},fps);assert(p.y>y+3);const high=p.y;
  advance(s,1,{descendHeld:true},fps);assert(p.y<high-3);assert.equal(s.state.jetpack.fuel,4);
  assert.equal(s.state.locomotion.stridePhase,0);assert(!s.state.events.some(e=>e.name==='jump'||e.name==='land'));
 }
});
test('boost nearly doubles the drone speed and spends its tank; an empty tank never removes basic flight',()=>{
 const slow=drone(),fast=drone();advance(slow,1,{moveY:1});advance(fast,1,{moveY:1,sprint:true});
 assert(fast.state.player.z<slow.state.player.z*1.7,'boost speed '+fast.state.player.z+' vs '+slow.state.player.z);
 assert(Math.abs(fast.state.jetpack.fuel-3)<1e-6,'one second of boost spends one unit');assert.equal(slow.state.jetpack.fuel,4);
 const s=drone();s.state.jetpack.fuel=.05;
 advance(s,.05,{moveY:1,sprint:true});assert.equal(s.state.jetpack.fuel,0);
 const p=s.state.player,z=p.z;advance(s,.2,{moveY:1,sprint:true});assert(p.z<z-.4);assert(p.airborne);
 advance(s,1,{jumpHeld:true});assert(p.y>4);assert(s.state.jetpack.fuel>0);
});
test('flight cannot cross thin walls, ceilings or floors',()=>{
 const wall={minX:-5,maxX:5,minY:0,maxY:8,minZ:-2.02,maxZ:-2},ceiling={minX:-5,maxX:5,minY:6,maxY:6.02,minZ:-5,maxZ:5};
 const s=drone(fixture({colliders:[wall,ceiling]})),p=s.state.player;
 advance(s,2,{moveY:1,sprint:true},20);assert(p.z>=-1.72-1e-8);
 advance(s,2,{jumpHeld:true},20);assert(p.y+1.8<=6+1e-8);
 advance(s,2,{descendHeld:true},20);assert(p.y>=0);assert(!s.state.dead);
});
test('mid-flight checkpoint and parked companion preserve exact replay',()=>{
 const w=fixture(),a=drone(w);advance(a,.4,{moveY:1,jumpHeld:true,sprint:true});
 const b=FSimulation.create(w);assert(b.restore(a.snapshot()));
 for(let i=0;i<80;i++){const input={moveX:1,descendHeld:i>40};a.step(1/120,input);b.step(1/120,input);}
 assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));
 const light=plain(a.state.player);a.switchProfile();advance(a,.5,{moveX:1});a.switchProfile();
 for(const k of ['x','y','z','airVX','airVY','airVZ'])assert.equal(a.state.player[k],light[k]);
});
test('heavy still falls, walks, and jumps',()=>{
 const s=FSimulation.create(fixture());assert.equal(s.state.activeProfile,'heavy');advance(s,2);assert.equal(s.state.player.y,0);assert(!s.state.player.airborne);
 advance(s,1,{moveY:1});assert(s.state.player.z< -3);assert(s.state.locomotion.stridePhase>0);
 s.step(1/120,{jump:true});advance(s,.2);assert(s.state.player.y>.5);advance(s,1);assert.equal(s.state.player.y,0);
});
test('flying camera ignores stride and stair impulses while keeping recoil',()=>{
 const a=FMotion.create({cameraSteps:true}),b=FMotion.create({cameraSteps:true});
 for(let i=0;i<120;i++){
  const signals={flying:true,time:i/60,grounded:true,groundY:i/100};
  const x=a.update(1/60,{speed:4,moveBlend:1,stridePhase:i*.3},signals),y=b.update(1/60,{speed:4,moveBlend:1,stridePhase:0},signals);
  assert.deepEqual(plain(x),plain(y));assert.equal(x.step,0);assert.equal(x.height,0);
 }
 a.impulse('shot');a.update(1/60,{}, {flying:true});assert.notEqual(a.view.weapon.offset[2],0);
});
test('the drone fires its weapon from both cannons at once, for one round and one heat step, and has no left hand',()=>{
 const s=drone();s.state.player.pitch=0;assert(s.selectWeapon(0));const ammo=s.state.inventory.ammo[0],heat=s.state.weaponHeat[0];
 assert(s.fire());const shot=s.state.events.filter(e=>e.name==='shot').at(-1);
 assert.equal(shot.twin,true);assert.equal(s.state.inventory.ammo[0],ammo-1);assert.equal(s.state.flash,1);assert.equal(s.state.leftFlash,1);
 assert(Math.abs(s.state.weaponHeat[0]-heat-.055)<1e-9);assert.equal(s.state.shots,1);
 assert.equal(s.state.equipment.left,null);assert.equal(s.selectLeftWeapon(1),false,'no left hand on the drone');
 // The left trigger also fires both cannons.
 advance(s,.3,{});s.step(1/120,{fireLeft:true});assert.equal(s.state.shots,2);assert.equal(s.state.inventory.ammo[0],ammo-2);
 // Back on the heavy, the left hand works again.
 s.switchProfile();assert(s.selectWeapon(3));assert(s.selectLeftWeapon(4));assert.equal(s.state.equipment.left,4);
 s.switchProfile();assert.equal(s.state.equipment.left,null);s.switchProfile();assert.equal(s.state.equipment.left,4,'the heavy keeps its left hand');
});
test('a twin-cannon volley lands two hits of 60 % on a machine: 1.2 times a single pistol shot',()=>{
 const dealt={};
 for(const profile of ['heavy','light']){
  const w=fixture({enemies:[{type:0,x:0,y:0,z:-7}]}),s=profile==='light'?drone(w):FSimulation.create(w),p=s.state.player,e=s.state.enemies[0];
  Object.assign(p,{x:0,y:2,z:0,airborne:profile==='light'});e.hp=e.maxHp=100;
  p.yaw=Math.atan2(e.x-p.x,p.z-e.z);p.pitch=Math.atan2(e.y-(p.y+1.62),Math.hypot(e.x-p.x,e.z-p.z));
  assert(s.selectWeapon(4));assert(s.fire());dealt[profile]=100-e.hp;
 }
 assert(dealt.heavy>0);assert(Math.abs(dealt.light/dealt.heavy-1.2)<.02,JSON.stringify(dealt));
});
