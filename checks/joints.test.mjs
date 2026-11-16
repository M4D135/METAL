// Guardian joints (David, 16/11/2026): four small targets at the shoulders and
// hips in horde worlds; a broken joint drops its limb as rigid bodies.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{}};vm.createContext(ctx);
for(const n of ['fmath','passages','renderer','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});
const {FSimulation:S,FActors:A}=ctx.window,plain=v=>JSON.parse(JSON.stringify(v));
const world=(extra={})=>({seed:96,stage:0,index:0,chapter:0,campaign:true,campaignVersion:2,combatVersion:1,hordeVersion:1,generation:6,spawn:{x:0,y:0,z:-24,yaw:Math.PI},bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},walkable:[{x:0,y:0,z:0,w:120,d:120}],rooms:[{id:0,x:0,y:0,z:0,w:120,d:120}],mechanisms:[],doors:[],lifts:[],jumpPads:[],traps:[],meshes:[],lights:[],colliders:[],pickups:[],trophies:[],cores:[{x:45,y:0,z:45},{x:48,y:0,z:45},{x:51,y:0,z:45}],exit:{x:54,y:0,z:45},enemies:[{x:0,y:0,z:0,type:3,boss:true,bossScale:5.4,bossKind:'colossus',maxHp:250,arena:{x:0,y:0,z:0,r:28},deployed:true,...extra}],progression:{version:1,weaponSlots:5,startWeapons:[true,true,true,true,true],startAmmo:[10,36,0,16,1],ammoCaps:[180,36,12,16,1],maxActive:8}});
const steps=(sim,n,each=()=>{})=>{for(let i=0;i<n;i++){sim.state.player.hp=100;sim.state.dead=false;each(i);sim.step(1/60);}};
function breakJoint(sim,e,joint){
  const p=sim.state.player,events=[];sim.selectWeapon(4);
  for(let i=0;i<600&&e.joints[joint]>0;i++){
    e.weakTimer=3;e.weakPointOpen=true;const q=sim.weakPoints(e).find(q=>q.joint===joint);if(!q)break;
    p.yaw=Math.atan2(q.x-p.x,p.z-q.z);p.pitch=Math.atan2(q.y-(p.y+1.62),Math.hypot(q.x-p.x,q.z-p.z));
    sim.fire();steps(sim,1);events.push(...sim.state.events);sim.state.events.length=0;
  }
  return events;
}

test('Horde guardians offer four small joints; earlier worlds keep the single heart',()=>{
  for(const look of [undefined,'endo']){
    const sim=S.create(world(look?{bossLook:look}:{}),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0];
    assert.equal(e.joints.length,4);assert(e.joints.every(v=>v===Math.round(250*.19)));
    const points=sim.weakPoints(e);assert.equal(points.length,4);assert.equal(points.map(q=>q.joint).join(),'0,1,2,3');
    assert(points.every(q=>Math.abs(q.r-.15*5.4)<1e-9),'small targets');assert(points[0].x*points[1].x<0||Math.abs(points[0].x-points[1].x)>1,'left and right');
  }
  const old={...world()};delete old.hordeVersion;const sim=S.create(old,{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0];
  assert.equal(e.joints,undefined);const points=sim.weakPoints(e);assert.equal(points.length,1);assert.equal(points[0].joint,-1);assert(Math.abs(points[0].r-.36*5.4)<1e-9);
});

test('Hitting an exposed joint breaks it: the limb falls as rigid bodies and the save keeps it',()=>{
  const sim=S.create(world(),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0],hp=e.hp;
  const events=breakJoint(sim,e,0);
  assert.equal(e.joints[0],0,'the left shoulder broke');assert(events.some(q=>q.name==='jointBreak'&&q.joint===0));assert(events.some(q=>q.name==='weakHit'));
  assert(e.hp<hp-250*.06,'the break adds a heavy blow');assert(!sim.weakPoints(e).some(q=>q.joint===0));assert.equal(sim.weakPoints(e).length,3);
  const limbs=sim.rigid.rows.filter(q=>q.kind==='limb');assert(limbs.length>=2,'the gun and shoulder fall');
  const before=limbs.map(q=>sim.rigid.physics.body(q.handle).pos[1]);steps(sim,180);const after=limbs.map(q=>sim.rigid.physics.body(q.handle).pos[1]);
  assert(after[0]<before[0]-1,'the limb fell: '+before[0].toFixed(2)+' -> '+after[0].toFixed(2));
  assert(!A.build(e,{time:1,distance:40,quality:'high',backend:'webgl2'}).some(m=>/^custodian-(barrel|shoulder)--1$/.test(m.actorPart)),'no longer drawn');
  const point=sim.snapshot(),copy=S.create(world(),{rigidBodies:true});assert(copy.restore(point));assert.deepEqual(plain(copy.snapshot()),plain(point));
  for(const bad of [v=>{v.state.enemies[0].joints[1]=-5;},v=>{v.state.enemies[0].joints.push(3);},v=>{delete v.state.enemies[0].joints;}]){const q=plain(point);bad(q);assert.equal(copy.restore(q),false);}
});

test('A broken hip slows the giant and a broken shoulder costs a salvo',()=>{
  const run=joints=>{const sim=S.create(world(),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0];if(joints)e.joints=joints;e.bossClock=4;e.x=0;e.z=0;const x0=e.z;steps(sim,60,()=>{e.weakTimer=0;e.weakPointOpen=false;});return {moved:Math.hypot(e.x,e.z-x0),sim,e};};
  const whole=run(null),lame=run([47,47,0,0]);assert(whole.moved>.5,'it walks: '+whole.moved);assert(lame.moved<whole.moved*.5,'lame: '+lame.moved+' vs '+whole.moved);
  const salvo=joints=>{const sim=S.create(world(),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0];if(joints)e.joints=joints;e.bossClock=0;e.bossStep=2;e.bossKind='siegebreaker';steps(sim,2);return sim.state.bossAttacks.filter(a=>a.kind==='rocketZone').length;};
  const full=salvo(null),one=salvo([0,47,47,47]);assert(full>=2&&one===Math.max(1,full-1),'salvo '+full+' -> '+one);
});

test('With every joint gone, the chest core is the last target and always bare',()=>{
  const sim=S.create(world(),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0];e.joints=[0,0,0,0];steps(sim,2);
  const points=sim.weakPoints(e);assert.equal(points.length,1);assert.equal(points[0].joint,-1);assert(Math.abs(points[0].r-.2*5.4)<1e-9);
  assert(e.weakPointOpen,'the core stays bare');steps(sim,240);assert.equal(sim.state.bossAttacks.length,0,'a giant without limbs no longer attacks');
});

test('A humanoid giant that lost its legs sinks to the floor, and its targets sink with it',()=>{
  const sim=S.create(world({bossLook:'endo'}),{rigidBodies:true});steps(sim,1);const e=sim.state.enemies[0],standing=sim.weakPoints(e)[0].y;
  e.joints=[e.joints[0],e.joints[1],0,0];const low=sim.weakPoints(e)[0].y;assert(Math.abs(standing-low-.95*5.4)<1e-6,'targets sink '+(standing-low));
  const meshes=A.build(e,{time:1,distance:40,quality:'high',backend:'webgl2'}),joint=meshes.find(m=>m.actorPart==='titan-joint-0');assert(Math.abs(joint.p[1]-low)<1e-6,'drawn where it is hit');
  assert(!meshes.some(m=>/^(hum|endo)-(thigh|shin|foot|leg)/.test(m.actorPart)),'no legs left');
});
