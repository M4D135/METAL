import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation,FMotion}=loadRealm({modules:['fmath','passages','renderer','physics-geometry','profiles','world','destruction','economy','motion','simulation']}).window;
const fixture=(extra={})=>({seed:96,index:0,stage:0,generation:6,campaign:true,campaignVersion:2,profileVersion:1,progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},spawn:{x:0,y:2,z:0,yaw:0},bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},walkable:[{x:0,y:0,z:0,w:200,d:200}],colliders:[],enemies:[],pickups:[],cores:[85,88,91].map((x,id)=>({id,x,y:0,z:85})),exit:{x:94,y:0,z:85},...extra});
const advance=(s,time,input={},fps=120)=>{for(let t=0;t<time-1e-9;t+=1/fps)s.step(Math.min(1/fps,time-t),input);};
const plain=x=>JSON.parse(JSON.stringify(x));
test('light moves along view pitch, strafes, and hovers indefinitely without fuel',()=>{
 for(const fps of [20,60,120]){
  const s=FSimulation.create(fixture()),p=s.state.player;p.pitch=Math.PI/4;
  advance(s,1,{moveY:1},fps);assert(p.y>4&&p.z< -2);assert.equal(s.state.jetpack.fuel,4);
  advance(s,2,{},fps);const stopped=[p.x,p.y,p.z];advance(s,12,{},fps);
  assert.deepEqual([p.x,p.y,p.z],stopped);assert(p.airborne);assert(!s.state.dead);
  const y=p.y;advance(s,.5,{moveX:1},fps);assert(p.x>1);assert(Math.abs(p.y-y)<1e-6);
  advance(s,1,{descendHeld:true},fps);assert(p.y<y-3);const low=p.y;
  advance(s,1,{jumpHeld:true},fps);assert(p.y>low+2);assert.equal(s.state.jetpack.fuel,4);
  assert.equal(s.state.locomotion.stridePhase,0);assert(!s.state.events.some(e=>e.name==='jump'||e.name==='land'));
 }
});
test('boost consumes fuel but an empty tank never removes basic flight',()=>{
 const s=FSimulation.create(fixture());s.state.jetpack.fuel=.05;
 advance(s,.05,{moveY:1,sprint:true});assert.equal(s.state.jetpack.fuel,0);
 const p=s.state.player,z=p.z;advance(s,.2,{moveY:1,sprint:true});assert(p.z<z-.4);assert(p.airborne);
 advance(s,1,{jumpHeld:true});assert(p.y>4);assert(s.state.jetpack.fuel>0);
});
test('flight cannot cross thin walls, ceilings or floors',()=>{
 const wall={minX:-5,maxX:5,minY:0,maxY:8,minZ:-2.02,maxZ:-2},ceiling={minX:-5,maxX:5,minY:6,maxY:6.02,minZ:-5,maxZ:5};
 const s=FSimulation.create(fixture({colliders:[wall,ceiling]})),p=s.state.player;
 advance(s,2,{moveY:1,sprint:true},20);assert(p.z>=-1.72-1e-8);
 advance(s,2,{jumpHeld:true},20);assert(p.y+1.8<=6+1e-8);
 advance(s,2,{descendHeld:true},20);assert(p.y>=0);assert(!s.state.dead);
});
test('mid-flight checkpoint and parked companion preserve exact replay',()=>{
 const w=fixture(),a=FSimulation.create(w);advance(a,.4,{moveY:1,jumpHeld:true,sprint:true});
 const b=FSimulation.create(w);assert(b.restore(a.snapshot()));
 for(let i=0;i<80;i++){const input={moveX:1,descendHeld:i>40};a.step(1/120,input);b.step(1/120,input);}
 assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));
 const light=plain(a.state.player);a.switchProfile();advance(a,.5,{moveX:1});a.switchProfile();
 for(const k of ['x','y','z','airVX','airVY','airVZ'])assert.equal(a.state.player[k],light[k]);
});
test('heavy still falls, walks, and jumps',()=>{
 const s=FSimulation.create(fixture());s.switchProfile();advance(s,2);assert.equal(s.state.player.y,0);assert(!s.state.player.airborne);
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
