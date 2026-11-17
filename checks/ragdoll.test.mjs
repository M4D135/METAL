// Humanoid machines fall as jointed bodies; rubble rolls like its shape (David, 16/11/2026).
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{}};vm.createContext(ctx);
for(const n of ['fmath','passages','renderer','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});
const {FSimulation:S}=ctx.window,plain=x=>JSON.parse(JSON.stringify(x));
const world=enemies=>({seed:96,stage:0,generation:6,spawn:{x:0,y:0,z:8,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},walkable:[{x:0,y:0,z:0,w:40,d:40}],colliders:[],rooms:[{id:0,x:0,y:0,z:0,w:24,d:24}],enemies,cores:[{x:0,y:0,z:18},{x:2,y:0,z:18},{x:4,y:0,z:18}],pickups:[],mechanisms:[],doors:[],lifts:[],jumpPads:[],traps:[],meshes:[],lights:[],exit:{x:-18,y:0,z:18}});

test('A destroyed endoskeleton separates into its actual components, and the save keeps them',()=>{
  const sim=S.create(world([{x:0,y:0,z:-2,yaw:0,type:1,variant:'endo'}]),{rigidBodies:true}),r=sim.rigid,e=sim.state.enemies[0],p=sim.state.player;
  for(let i=0;i<600&&e.hp>0;i++){p.hp=100;p.yaw=Math.atan2(e.x-p.x,p.z-e.z);p.pitch=Math.atan2(e.baseY+1.1-(p.y+1.62),Math.hypot(e.x-p.x,e.z-p.z));sim.fire();sim.step(1/60);sim.state.events.length=0;}
  assert.equal(e.hp,0);const parts=r.rows.filter(q=>q.kind==='wreck');assert.equal(parts.length,7,'torso, head, two arms, two legs and the gun');
  assert(parts.some(q=>q.visuals?.some(v=>v.actorPart==='endo-skull'&&v.shape.startsWith('metal-hum-'))),'the real procedural skull, not a proxy sphere');const before=parts.map(q=>r.physics.body(q.handle).pos[1]);
  for(let i=0;i<180;i++){sim.step(1/60);sim.state.events.length=0;}
  const after=parts.map(q=>r.physics.body(q.handle).pos[1]),torso=parts[0],limbs=parts.slice(1,6);
  assert(after.every(y=>y>-.05&&y<1.6),'everything lies on the floor');assert(after[0]<before[0]-.3,'the torso fell');
  assert(parts.every(q=>q.visuals?.length),'all separated parts retain their source mesh');
  assert(after[0]<before[0],'physical fall, not expiry');
  const copy=S.create(world([{x:0,y:0,z:-2,yaw:0,type:1,variant:'endo'}]),{rigidBodies:true});assert(copy.restore(sim.snapshot()));assert.deepEqual(plain(copy.snapshot()),plain(sim.snapshot()));
});

test('A kamikaze blast tears its own body apart',()=>{
  const sim=S.create(world([{x:0,y:0,z:-1,yaw:Math.PI,type:1,variant:'kamikaze'}]),{rigidBodies:true}),r=sim.rigid,e=sim.state.enemies[0];
  for(let i=0;i<240&&e.hp>0;i++){sim.state.player.hp=100;sim.step(1/60);sim.state.events.length=0;}
  assert.equal(e.hp,0);for(let i=0;i<60;i++){sim.step(1/60);sim.state.events.length=0;}
  const parts=r.rows.filter(q=>q.kind==='wreck');assert(parts.length>=4);const a=r.physics.body(parts[0].handle).pos;
  assert(parts.slice(1).some(q=>{const b=r.physics.body(q.handle).pos;return Math.hypot(a[0]-b[0],a[2]-b[2])>1.5;}),'at least one limb torn away');
});

test('Rubble rolls like its shape: trunks and pipes as capsules, foliage as balls, slabs as boxes',()=>{
  const sim=S.create(world([]),{rigidBodies:true}),r=sim.rigid;let id=1000;
  const drop=(shape,size)=>{const q={id:++id,shape,size,x:id-1000,y:3,z:-4,vx:0,vy:0,vz:0,rotation:[0,0,Math.PI/2],angularVelocity:[0,0,0],mass:20,material:'wood',mat:10,structural:true,resting:false};r.rubble(q);const row=r.rows.find(x=>x.rubbleId===q.id);return r.physics.body(row.handle);};
  const trunk=drop('cylinder',[.5,3,.5]),ball=drop('foliage',[1.2,1,1.2]),slab=drop('box',[2,.2,1]);
  assert.equal(trunk.shape,'capsule');assert.equal(ball.shape,'sphere');assert.equal(slab.shape,'box');
});
