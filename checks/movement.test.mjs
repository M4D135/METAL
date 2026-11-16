import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FRenderMesh} from './mesh-fixture.mjs';

const ctx={window:{}};vm.createContext(ctx);
for(const name of ['destruction','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),ctx,{filename:name+'.js'});
const S=ctx.window.FSimulation,plain=v=>JSON.parse(JSON.stringify(v));
const actorsCtx={window:{FRender:{mesh:FRenderMesh}}};vm.createContext(actorsCtx);
for(const name of ['actors','avatars'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),actorsCtx,{filename:name+'.js'});
const {FActors,MetalAvatars}=actorsCtx.window;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function arena(kind='colossus'){return {seed:96,stage:0,generation:6,spawn:{x:0,y:0,z:18,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},walkable:[{x:0,y:0,z:0,w:80,d:80}],colliders:[],meshes:[],lights:[],enemies:[{x:0,y:0,z:0,type:3,bossScale:5.4,bossKind:kind,maxHp:130,arena:{x:0,z:0,r:28}}],cores:[{id:0,x:-35,y:0,z:35},{id:1,x:-33,y:0,z:35},{id:2,x:-31,y:0,z:35}],pickups:[],exit:{x:35,y:0,z:35}};}
function awake(kind){const sim=S.create(arena(kind));sim.step(1/60);const e=sim.state.enemies[0];assert(e.bossAwake);return {sim,e,p:sim.state.player};}
const run=(sim,seconds,each=()=>{})=>{for(let i=0;i<Math.round(seconds*60);i++){sim.state.player.hp=100;sim.state.dead=false;each(i);sim.step(1/60);}};

test('A giant turns toward its target at a bounded rate: 60 deg/s, 90 deg/s in phase 2, never a jump',()=>{
  for(const phase of [0,2]){
    const {sim,e,p}=awake('custodian');e.phase=phase;let largest=0,previous=e.yaw;
    // The player circles to the giant's back: the old code turned it 180 degrees in one step.
    p.x=0;p.z=-20;run(sim,6,()=>{const step=Math.abs(wrap(e.yaw-previous));largest=Math.max(largest,step);previous=e.yaw;});
    assert(largest<=(phase===2?1.57:1.05)/60+1e-9,'turn step '+largest);
    const want=Math.atan2(e.aimX-e.x,e.z-e.aimZ);assert(Math.abs(wrap(want-e.yaw))<.05,'it ends up facing its aim');
  }
});

test('A giant walks heavily between attacks: it closes in, backs away from a hugging player, and its steps are events',()=>{
  const far=awake('colossus');far.e.bossClock=4;far.p.x=0;far.p.z=27;const z0=far.e.z;
  far.e.lastSeenX=0;far.e.lastSeenZ=27;far.e.seen=true;far.e.hasMemory=true;far.e.memory=7;
  const steps=[];run(far.sim,2,()=>{far.e.bossClock=Math.max(far.e.bossClock,1);steps.push(...far.sim.state.events.filter(q=>q.name==='bossStep'));far.sim.state.events.length=0;});
  const moved=far.e.z-z0;assert(moved>1.8&&moved<2.6,'advances at about 1.2 m/s: '+moved);assert(steps.length>=2,'heavy steps are emitted');
  for(const q of steps)assert(q.impact===10&&q.material==='metal'&&Number.isFinite(q.x));
  const near=awake('colossus');near.e.bossClock=4;near.p.x=0;near.p.z=9.5;near.e.lastSeenX=0;near.e.lastSeenZ=9.5;near.e.seen=true;near.e.hasMemory=true;near.e.memory=7;
  const before=Math.hypot(near.e.x-near.p.x,near.e.z-near.p.z);run(near.sim,1,()=>{near.e.bossClock=Math.max(near.e.bossClock,1);});
  assert(Math.hypot(near.e.x-near.p.x,near.e.z-near.p.z)>before+.5,'backs away from a player at its feet');
});

test('Turning and walking giants remain deterministic through a checkpoint',()=>{
  const {sim,e,p}=awake('siegebreaker');p.x=14;p.z=-12;run(sim,3);const point=plain(sim.snapshot()),copy=S.create(arena('siegebreaker'));assert(copy.restore(point));
  for(let i=0;i<240;i++){for(const s of [sim,copy]){s.state.player.hp=100;s.state.dead=false;s.step(1/60,{moveX:i%120<60?1:-1});}}
  assert.deepEqual(plain(copy.snapshot()),plain(sim.snapshot()));assert(Number.isFinite(e.yaw)&&Math.abs(e.yaw)<=Math.PI+1e-9);
});

test('A sweep is announced by the boss winding up its body, not by a detached bar',()=>{
  const boss={id:4,type:3,x:0,z:0,baseY:0,yaw:0,hp:100,maxHp:100,bossScale:5.4,bossKind:'siegebreaker',bossAwake:true,attackLabel:'Balayage',awareness:'combat'};
  const rest=FActors.build({...boss,windup:0,windupMax:1.6},{time:1,distance:20}),tell=FActors.build({...boss,windup:.1,windupMax:1.6},{time:1,distance:20});
  assert(!tell.some(m=>/sweep-blade/.test(m.actorPart||'')),'no floating bar');
  const cannon=meshes=>meshes.find(m=>m.actorPart==='custodian-shoulder-1');
  assert(Math.hypot(cannon(tell).p[0]-cannon(rest).p[0],cannon(tell).p[2]-cannon(rest).p[2])>1,'the torso turns away before the sweep');
  assert.deepEqual(Array.from(cannon(tell).color),[1,.52,.09],'the cannon mounts glow orange');
  const heart=meshes=>meshes.find(m=>m.actorPart==='titan-heart').p;assert.deepEqual(Array.from(heart(tell)),Array.from(heart(rest)),'the real weak point never moves with the wind-up');
});

test('Machines may be drawn with an eased heading without touching their simulation state',()=>{
  const machine={id:2,type:1,x:1,z:2,baseY:0,yaw:0,hp:10,awareness:'patrol'};
  const drawn=FActors.build(machine,{time:0,distance:5,yaw:Math.PI/2}),turned=FActors.build({...machine,yaw:Math.PI/2},{time:0,distance:5});
  assert.deepEqual(plain(drawn),plain(turned));assert.equal(machine.yaw,0);
});

test('The third-person heavy turns its legs toward the movement while torso and gun keep the aim',()=>{
  const player={x:0,y:0,z:0,yaw:0,pitch:0},still=MetalAvatars.heavy(player,{blend:1,phase:1,distance:3}),side=MetalAvatars.heavy(player,{blend:1,phase:1,distance:3,legYaw:1});
  const part=(meshes,name)=>meshes.find(m=>m.actorPart===name);
  for(const name of ['torso','helmet','visor','rifle-receiver'])assert.deepEqual(Array.from(part(side,name).p),Array.from(part(still,name).p),name+' keeps the aim');
  for(const name of ['boot--1','boot-1'])assert(Math.hypot(...part(side,name).p.map((v,k)=>v-part(still,name).p[k]))>.05,name+' follows the movement');
});
