import test from 'node:test';import assert from 'node:assert/strict';import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation:S,FWorld:W,MetalProfiles:P,MetalSupport:D}=loadRealm({modules:['fmath','passages','renderer','support','profiles','world','destruction','economy','physics-geometry','simulation','motion']}).window;
const plain=x=>JSON.parse(JSON.stringify(x));
const fixture=(extra={})=>({seed:96,index:0,stage:0,generation:6,campaign:true,campaignVersion:2,combatVersion:1,profileVersion:1,supportDroneVersion:1,progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-80,maxX:80,minZ:-80,maxZ:80},walkable:[{x:0,y:0,z:0,w:160,d:160}],rooms:[],meshes:[],lights:[],colliders:[],enemies:[],cores:[],pickups:[],doors:[],lifts:[],mechanisms:[],traps:[],jumpPads:[],exit:{x:70,y:0,z:70},...extra});
const advance=(s,seconds,input={},hz=60)=>{for(let i=0;i<Math.round(seconds*hz);i++){s.step(1/hz,input);s.state.events.length=0;}};
test('heavy owns the collected arsenal; drone only its independent laser slot',()=>{const s=S.create(fixture());for(let i=0;i<5;i++)assert(s.selectWeapon(i));s.switchProfile();assert(s.selectWeapon(4));for(let i=0;i<4;i++)assert(!s.selectWeapon(i));assert(!s.selectLeftWeapon(4));assert.equal(s.exportProfiles().version,2);});
test('lasers fire with every ammunition pool empty, leave scenery intact and deal little damage',()=>{
 const w=fixture({enemies:[{type:1,x:0,y:0,z:-8}]}),sim=S.create(w),p=sim.state.player;sim.switchProfile();p.y=0;p.pitch=Math.atan2(1.05-1.62,8);sim.state.inventory.ammo.fill(0);const before=plain(sim.state.inventory),hp=sim.state.enemies[0].hp;
 assert(sim.fire());assert(sim.state.enemies[0].hp<hp);assert(hp-sim.state.enemies[0].hp<=.201);assert.deepEqual(plain(sim.state.inventory),before);assert.equal(sim.state.projectiles.length,0);assert.equal(sim.state.events.filter(e=>e.name==='laserBeam').length,2);assert(!sim.fire());
});
test('laser heat does not replace the heavy weapon heat; finite ammo is not consumed',()=>{
 const sim=S.create(fixture()),s=sim.state;sim.selectWeapon(3);s.weaponHeat[3]=.7;sim.switchProfile();assert(sim.fire());assert(s.player.heat>0);assert.equal(s.weaponHeat[3],.7);sim.switchProfile();assert.equal(s.player.heat,.7);assert.equal(s.inventory.ammo[3],8);
});
test('lasers stop at a wall and never remotely activate or destroy a terminal',()=>{
 const sim=S.create(fixture({colliders:[{minX:-2,maxX:2,minY:0,maxY:4,minZ:-3.2,maxZ:-3}],enemies:[{type:1,x:0,y:0,z:-5}],mechanisms:[{id:'terminal',x:0,y:0,z:-4,profileRequired:'light',activation:'hack'}]}));sim.switchProfile();const hp=sim.state.enemies[0].hp;assert(sim.fire());assert.equal(sim.state.enemies[0].hp,hp);assert(!sim.state.mechanisms[0].active);assert(!sim.state.mechanisms[0].destroyed);
});
test('stationary drone docks by position, heavy and distant drone cannot turn a pad on',()=>{
 const w=fixture({mechanisms:[{id:'pad',x:0,y:1,z:0,profileRequired:'light',activation:'dock',required:true}],doors:[{id:'gate',x:5,y:0,z:0,w:.5,d:4,h:3,requires:'pad'}]});
 const sim=S.create(w);advance(sim,1);assert(!sim.state.mechanisms[0].active);sim.switchProfile();advance(sim,.5);assert(!sim.state.mechanisms[0].active);advance(sim,.3);assert(sim.state.mechanisms[0].active);advance(sim,1.2);assert(sim.state.doors[0].open);
});
test('hack requires a held action and line of sight; release resets partial progress',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}]}));sim.switchProfile();assert(!sim.interact());advance(sim,.7,{interact:true});assert(!sim.state.mechanisms[0].active);assert(sim.state.support.progress>.5);advance(sim,.1);assert.equal(sim.state.support.progress,0);advance(sim,1.6,{interact:true});assert(sim.state.mechanisms[0].active);
});
test('switching character cancels hacking immediately, even between simulation steps',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}]}));sim.switchProfile();advance(sim,.8,{interact:true});
 assert.equal(sim.state.support.target,'hack');assert(sim.state.support.progress>.5);
 sim.switchProfile();assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
 sim.switchProfile();assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
 advance(sim,1.6,{interact:true});assert(sim.state.mechanisms[0].active,'the terminal is still hackable after the switch');
});
test('death by damage cancels the active hack',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}]}));sim.switchProfile();advance(sim,.8,{interact:true});assert(sim.state.support.progress>.5);
 sim.hurt(10000,false);assert(sim.state.dead);assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
 advance(sim,.5,{interact:true});assert(!sim.state.mechanisms[0].active);
});
test('death by fall cancels the active hack',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}]}));sim.switchProfile();advance(sim,.8,{interact:true});assert(sim.state.support.progress>.5);
 sim.state.player.y=-15;sim.step(1/60,{interact:true});assert(sim.state.dead);assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
});
test('pause cancels the held hack so resuming cannot continue a stale action',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}]}));sim.switchProfile();advance(sim,.8,{interact:true});assert(sim.state.support.progress>.5);
 sim.cancelSupportAction();assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
 advance(sim,.4,{interact:true});assert(!sim.state.mechanisms[0].active);assert(sim.state.support.progress<=.4+1e-9);
});
test('dock needs the drone inside its volume and forgets progress as soon as it leaves',()=>{
 const w=fixture({mechanisms:[{id:'pad',x:0,y:1,z:0,profileRequired:'light',activation:'dock',required:true}],doors:[{id:'gate',x:5,y:0,z:0,w:.5,d:4,h:3,requires:'pad'}]});
 const out=S.create(w);advance(out,1);out.switchProfile();out.state.player.x=.55;advance(out,1.2);assert(!out.state.mechanisms[0].active);assert.equal(out.state.support.target,null);
 const sim=S.create(w);advance(sim,1);sim.switchProfile();advance(sim,.3);assert.equal(sim.state.support.target,'pad');assert(sim.state.support.progress>0);assert(!sim.state.mechanisms[0].active);
 sim.state.player.x=6;advance(sim,.05);assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);assert(!sim.state.mechanisms[0].active);advance(sim,1.5);assert(!sim.state.mechanisms[0].active);assert(!sim.state.doors[0].open);
});
test('a hacked terminal pays its reward once and keeps its door open',()=>{
 const sim=S.create(fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack',required:true}],doors:[{id:'gate',x:5,y:0,z:0,w:.5,d:4,h:3,requires:'hack'}]}));sim.switchProfile();
 const xp=()=>sim.exportProfiles().classes.light.xp,gained=xp();advance(sim,1.6,{interact:true});
 assert(sim.state.mechanisms[0].active);assert.equal(xp()-gained,40);
 advance(sim,5,{interact:true});assert(sim.state.mechanisms[0].active);assert.equal(xp()-gained,40,'no duplicated experience');
 advance(sim,2);assert(sim.state.doors[0].open,'an opened door stays open');
});
test('stamina has bounded consumption, recovery delay and no exhausted sprint flicker',()=>{ const q=D.fresh();for(let i=0;i<300;i++)D.sprint(q,1/60,true);assert(q.stamina<1e-8);assert(q.exhausted);for(let i=0;i<30;i++)assert(!D.sprint(q,1/60,true));assert.equal(q.stamina,0);for(let i=0;i<120;i++)D.sprint(q,1/60,false);assert(q.stamina>1);assert(D.sprint(q,1/60,true));
 for(const hz of [20,60,120]){const a=D.fresh();for(let i=0;i<hz*2;i++)D.sprint(a,1/hz,true);assert(Math.abs(a.stamina-3)<1e-10);}
});
test('support checkpoint preserves laser, stamina, partial hack and rejects malformed resources atomically',()=>{
 const w=fixture({mechanisms:[{id:'hack',x:0,y:1,z:-1,profileRequired:'light',activation:'hack'}]}),s=S.create(w);s.switchProfile();advance(s,.5,{interact:true});s.fire();const snap=plain(s.snapshot()),copy=S.create(w);assert(copy.restore(snap));assert.deepEqual(plain(copy.snapshot()),snap);
 for(const mutate of [x=>x.state.support.stamina=-1,x=>x.state.support.cooldown=10,x=>x.state.support.target='missing',x=>delete x.supportDroneVersion]){const bad=plain(snap);mutate(bad);assert(!copy.restore(bad));assert.deepEqual(plain(copy.snapshot()),snap);}
});
test('legacy profiles and worlds retain historical defaults and geometry revision',()=>{
 const w=fixture();delete w.supportDroneVersion;const s=S.create(w);s.switchProfile();assert(s.selectWeapon(1));assert.equal(s.exportProfiles().version,1);assert.equal(s.snapshot().supportDroneVersion,undefined);assert(!s.state.support);
});
test('narrow overhead passage fits the drone collider but not the heavy; checkpoint inside restores',()=>{
 const boxes=[{minX:-2,maxX:2,minY:0,maxY:3.55,minZ:-4,maxZ:-3},{minX:-2,maxX:2,minY:4.9,maxY:7,minZ:-4,maxZ:-3}];const w=fixture({colliders:boxes}),s=S.create(w);s.switchProfile();s.state.player.y=2.8;advance(s,1.5,{moveY:1});assert(s.state.player.z<-4.3,'crossed the duct');s.state.player.z=-3.5;assert(S.create(w).restore(s.snapshot()),'restores narrow pose');const h=S.create(w);advance(h,1.5,{moveY:1});assert(h.state.player.z>-3);
});
test('all eighteen new worlds expose a real duct, pad, hack terminal and heavy bosses',()=>{
 for(let i=0;i<18;i++){const w=W.create(96,i,{campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1,supportDroneVersion:1});assert.equal(w.supportDroneVersion,1);assert(w.mechanisms.some(m=>m.activation==='dock'));assert(w.mechanisms.some(m=>m.activation==='hack'));assert(w.doors.some(d=>d.requires==='profile-dock'));assert(w.enemies.filter(e=>e.bossScale>1).every(e=>e.profileRequired==='heavy'));const s=S.create(w),d=w.profileGoals.duct;assert(!s.blocked(d.x,d.z,.28,d.y+1.18,undefined,undefined,undefined,.48));assert(S.create(w).restore(s.snapshot()));}
});
test('cockpit and mirrored emitter geometry stay procedural, bounded and overlay-only',()=>{for(const aspect of [.56,1,1.78,2.4]){const ms=D.cockpit({pos:[0,1.62,0],yaw:.2,pitch:.1,roll:0,fov:74},{aspect});assert(ms.length<=20);assert(ms.every(m=>m.overlay&&m.p.every(Number.isFinite)));assert.equal(ms.filter(m=>m.supportPart==='laser-emitter').length,2);}});
test('the abandoned profile is shielded and invulnerable while the other character is active',()=>{
 const sim=S.create(fixture());assert.equal(sim.state.activeProfile,'heavy');assert.equal(sim.state.parkedShield?.profile,'light');assert.equal(sim.state.parkedShield?.invincible,true);assert.equal(sim.invulnerable('light'),true);assert.equal(sim.invulnerable('heavy'),false);
 sim.switchProfile();assert.equal(sim.state.activeProfile,'light');assert.equal(sim.state.parkedShield?.profile,'heavy');assert.equal(sim.invulnerable('heavy'),true);assert.equal(sim.invulnerable('light'),false);
 const copy=S.create(fixture());assert(copy.restore(sim.snapshot()));assert.equal(copy.state.parkedShield?.profile,'heavy');assert.equal(copy.invulnerable('heavy'),true);
});
