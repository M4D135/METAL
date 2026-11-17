import test from 'node:test';import assert from 'node:assert/strict';import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation:S,FWorld:W,MetalProfiles:P,MetalPhysics:M,MetalDemo:D,FEffects:FX}=loadRealm({modules:['fmath','passages','renderer','support','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation','camera','demo-metal','effects']}).window;
const plain=v=>JSON.parse(JSON.stringify(v));
const fixture=(extra={})=>({seed:96,index:0,stage:0,generation:6,campaign:true,campaignVersion:2,combatVersion:1,profileVersion:1,supportDroneVersion:1,progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-80,maxX:80,minZ:-80,maxZ:80},walkable:[{x:0,y:0,z:0,w:160,d:160}],rooms:[],meshes:[],lights:[],colliders:[],enemies:[],cores:[],pickups:[],doors:[],lifts:[],mechanisms:[],traps:[],jumpPads:[],exit:{x:70,y:0,z:70},...extra});
const step=(sim,n,input={})=>{for(let i=0;i<n;i++){sim.step(1/60,input);sim.state.events.length=0;}};
const grenade=(sim,x,y,z)=>{const q={id:900,kind:'grenade',owner:'player',profile:'heavy',x,y,z,vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:3.6,damage:0,terrainPower:80,travel:0,bounces:0,resting:true};sim.state.projectiles.push(q);sim.rigid?.grenade(q);sim.step(1/60);};

test('new support worlds use a compact physical drone proxy; unused heavy proxy is parked',()=>{
 const w=fixture(),s=S.create(w,{rigidBodies:true});assert(s.rigid);s.switchProfile();step(s,3);const q=s.rigid.snapshot();assert(q.dronePlayer>0);assert(s.rigid.physics.body(q.player).pos[1]<-40);const d=s.rigid.physics.body(q.dronePlayer);assert.deepEqual(plain(d.size),[.56,.48,.56]);assert(Math.abs(d.pos[1]-(s.state.player.y+1.42))<.01);
  const copy=S.create(w,{rigidBodies:true});assert(copy.restore(plain(s.snapshot())));assert.deepEqual(plain(copy.snapshot()),plain(s.snapshot()));
  // The restored world must already agree before a single step is simulated, and
  // digest() must stay a pure observation of that state.
  assert.equal(copy.digest(),s.digest(),'digest agrees immediately after restore');
  const observed=s.snapshot();const first=s.digest();assert.equal(s.digest(),first);assert.equal(s.digest(),first);assert.deepEqual(plain(s.snapshot()),plain(observed));
  assert.equal(copy.rigid.hash(),s.rigid.hash());
  // restore() still invalidates the render and AI caches it depends on.
  const revision=s.state.destructionRevision;const copyRevision=copy.state.destructionRevision;
  assert(copy.restore(plain(s.snapshot())));assert.equal(copy.state.destructionRevision,copyRevision+1,'restore keeps bumping the invalidation counter');
  assert(s.restore(plain(s.snapshot())));assert.equal(s.state.destructionRevision,revision+1);
  // A real perturbation of the drone body or of its own resources is detected.
  const moved=S.create(w,{rigidBodies:true});assert(moved.restore(plain(observed)));const probe=moved.rigid.snapshot().dronePlayer;
  const quietBody=moved.digest();moved.rigid.physics.impulse(probe,0,moved.state.player.y+1.4,0,0,60,0);for(let i=0;i<10;i++){moved.step(1/60,{});moved.state.events=[];}
  assert.notEqual(moved.digest(),quietBody,'a pushed drone body changes the digest');moved.dispose();
  const drained=S.create(w,{rigidBodies:true});assert(drained.restore(plain(observed)));const quiet=drained.digest();drained.state.support.heat=.5;
  assert.notEqual(drained.digest(),quiet,'drone heat changes the digest');drained.dispose();
  for(let i=0;i<60;i++){const input={moveY:.3,moveX:.2,jumpHeld:i<10,interact:i>20};s.step(1/60,input);copy.step(1/60,input);s.state.events=[];copy.state.events=[];}assert.equal(copy.digest(),s.digest());
 s.switchProfile();step(s,3);assert(s.rigid.physics.body(q.dronePlayer).pos[1]<-40);assert(s.rigid.physics.body(q.player).pos[1]>-1);
 const bad=plain(s.snapshot());bad.rigidBodies.dronePlayer=bad.rigidBodies.player;const before=plain(s.snapshot());assert(!s.restore(bad));assert.deepEqual(plain(s.snapshot()),before);s.dispose();copy.dispose();
});
test('physical flight crosses the real duct without moving the heavy proxy through the door',()=>{
 const boxes=[{minX:-2,maxX:2,minY:0,maxY:3.55,minZ:-4,maxZ:-3},{minX:-2,maxX:2,minY:4.9,maxY:7,minZ:-4,maxZ:-3}];const w=fixture({colliders:boxes}),s=S.create(w,{rigidBodies:true});s.switchProfile();s.state.player.y=2.8;step(s,80,{moveY:1});assert(s.state.player.z<-4.5);const copy=S.create(w,{rigidBodies:true});assert(copy.restore(s.snapshot()));assert.equal(copy.rigid.hash(),s.rigid.hash());s.dispose();copy.dispose();
});
 test('all 18 support expedition loadouts and their full rigid checkpoints agree on ownership',()=>{
 for(let index=0;index<18;index++)for(const active of ['heavy','light']){const w=W.create(96,index,{campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1,supportDroneVersion:1}),carry=D.loadout(index,active,true),s=S.create(w,carry);assert(s.rigid);assert.equal(s.state.activeProfile,active,index+'/'+active);assert.equal(s.exportProfiles().version,2);const copy=S.create(w,carry);assert(copy.restore(s.snapshot()),index+'/'+active);assert.deepEqual(plain(copy.snapshot()),plain(s.snapshot()));assert.equal(copy.rigid.hash(),s.rigid.hash(),index+'/'+active);s.dispose();copy.dispose();}
});
test('a destroyed press stays destroyed through approach, cycles, render and saved continuation',()=>{
 const w=fixture({traps:[{id:'press',kind:'press',x:0,y:0,z:-8,w:3,d:.8,h:2,travel:3,period:7,phase:0,active:2,hp:18,damage:20}]}),s=S.create(w,{rigidBodies:true});step(s,1);const t=s.state.traps[0],b=t.box;grenade(s,0,(b.minY+b.maxY)/2,-8);assert(t.destroyed);assert(!t.box);assert(s.state.debris.length>0);assert(s.state.debris.length<=5);assert(s.state.debris.every(q=>Math.max(...q.size)<=.75+1e-9));
 // Follow ordinary movement toward the old press position, then observe two complete cycles.
 step(s,100,{moveY:1});step(s,900);assert(t.destroyed);assert.equal(t.box,null);assert(!FX.build(s.state,w,{pos:[0,2,-8]}).some(m=>m.effectPart==='press-body'));
 const copy=S.create(w,{rigidBodies:true});assert(copy.restore(plain(s.snapshot())));step(copy,420);assert(copy.state.traps[0].destroyed);assert.equal(copy.state.traps[0].box,null);s.dispose();copy.dispose();
});
test('destroyed doors never return, and small pieces never recreate a full door collider',()=>{
 const w=fixture({doors:[{id:'gate',x:0,y:0,z:-8,w:5,h:3,d:.5,requires:'lock'}],mechanisms:[{id:'lock',x:20,y:0,z:20}]}),s=S.create(w,{rigidBodies:true});grenade(s,0,1.5,-8);assert(s.state.doors[0].destroyed);const parts=s.state.debris.filter(q=>q.sourceId==='door:gate');assert(parts.length>0&&parts.length<=5);assert(parts.every(q=>Math.max(...q.size)<=.75+1e-9));step(s,70,{moveY:1});step(s,120);assert(s.state.doors[0].destroyed);assert(s.state.doors[0].open);assert(!s.blocked(0,-8,.28,0));const c=S.create(w,{rigidBodies:true});assert(c.restore(s.snapshot()));step(c,60);assert(c.state.doors[0].destroyed);s.dispose();c.dispose();
});
test('support wrecks retain every original named component but at most five bodies per actor',()=>{
 const w=fixture({enemies:[{type:1,variant:'endo',x:0,y:0,z:-8}]}),s=S.create(w,{rigidBodies:true}),e=s.state.enemies[0];s.rigid.wreck(e,{x:0,z:0});const rows=s.rigid.rows.filter(q=>q.kind==='wreck');assert(rows.length>0&&rows.length<=5);const expected=M.fracture(e,0,16).reduce((n,q)=>n+q.visuals.length,0);assert.equal(rows.reduce((n,q)=>n+q.visuals.length,0),expected);assert(rows.every(q=>q.visuals.length));s.dispose();
});
test('mixing a legacy class loadout into a support world is rejected explicitly',()=>{assert.throws(()=>S.create(fixture(),{profiles:P.fresh()}),/Invalid profiles/);});
