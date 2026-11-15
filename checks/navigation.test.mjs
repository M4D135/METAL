import test from 'node:test';
import assert from 'node:assert/strict';
import {stateDigest} from '../tools/proof/digest.mjs';
import {loadRealm} from '../tools/realm-loader.mjs';
const modules=['fmath','passages','renderer','profiles','world','destruction','economy','brain','simulation'];
const realm=loadRealm({modules,transform:(name,src)=>name==='simulation'?src.replace('nav:{connected,heights:',`nav:{connected,probeGoal(e,x,z,budget=2){routeBudget=budget;routeWork=6000;return setGoal(e,x,z,'advance');},probeRoute(e,x,z,budget=2){routeBudget=budget;routeWork=6000;return route(e,x,z);},heights:`):src});
const {FSimulation,FWorld,FBrain}=realm.window;
function fixture(extra={}){return {seed:96,generation:5,spawn:{x:0,z:0,yaw:0},bounds:{minX:-8,maxX:8,minZ:-8,maxZ:8},colliders:[],enemies:[],pickups:[],cores:[],exit:{x:7,z:7},...extra};}
function expected(cells,w,closed){const c=new Int32Array(cells.length).fill(-1),neighbors=i=>[i%w?i-1:-1,i%w<w-1?i+1:-1,i-w,i+w];let id=0;for(let i=0;i<cells.length;i++)if(cells[i]&&c[i]<0){const q=[i];c[i]=id;for(let p=0;p<q.length;p++)for(const j of neighbors(q[p]))if(j>=0&&j<cells.length&&cells[j]&&c[j]<0&&!closed.has([Math.min(j,q[p]),Math.max(j,q[p])].join(':'))){c[j]=id;q.push(j);}id++;}return c;}
function verify(g,cells,w,closed){const wanted=expected(cells,w,closed);for(let i=0;i<cells.length;i++)for(let j=0;j<cells.length;j++)if(cells[i]&&cells[j])assert.equal(g.component(i)===g.component(j),wanted[i]===wanted[j],i+'/'+j);for(let i=0;i<cells.length;i++)for(let k=0;k<4;k++){const j=g.neighbor(i,k);if(j>=0)assert.equal(!!(g.open[i]&(1<<k)),!!(g.open[j]&(1<<(k^1))));}}
test('local openings and closures retain the exact partition within the repair budget',()=>{
 const w=11,cells=new Uint8Array(w*w).fill(1),closed=new Set(),g=FSimulation.navigationGraph(cells,w,(i,j)=>!closed.has([Math.min(i,j),Math.max(i,j)].join(':')));g.flush();verify(g,cells,w,closed);
 let random=96;const rnd=n=>((random=(Math.imul(random,1664525)+1013904223)>>>0)%n);
 for(let change=0;change<80;change++){const i=rnd(cells.length);cells[i]=1-cells[i];g.invalidate(i);const j=g.neighbor(i,1);if(j>=0){const key=i+':'+j;closed.has(key)?closed.delete(key):closed.add(key);g.invalidate(j);}assert.equal(g.component(0),-1);let guard=0;while(!g.ready){const before=g.stats.edgeTests;g.pump(3);assert(g.stats.edgeTests-before<=3);assert(++guard<1000);}verify(g,cells,w,closed);}
});
test('changes during repair cannot expose obsolete components',()=>{
 const cells=new Uint8Array(400).fill(1),g=FSimulation.navigationGraph(cells,20,()=>true);g.flush();for(let i=10;i<400;i+=20){cells[i]=0;g.invalidate(i);}for(let i=0;i<100;i++)g.pump(2);cells[10]=1;g.invalidate(10);g.flush();verify(g,cells,20,new Set());g.clear();g.flush();verify(g,cells,20,new Set());
});
test('disconnected goals fail before budget consumption, while deferral preserves the current route',()=>{
 const wall={minX:-.4,maxX:.4,minY:0,maxY:3,minZ:-8,maxZ:3};
 const sim=FSimulation.create(fixture({colliders:[wall]})),e={x:-4,z:0,type:0,baseY:0,goalX:-4,goalZ:4,path:[0],pathAt:0,tactic:'advance',thinkWait:.6};
 const before={...e,path:e.path.slice()};assert.equal(sim.nav.probeGoal(e,4,0,0),false);assert.deepEqual({...e,thinkWait:before.thinkWait},before);
 assert(Array.isArray(sim.nav.probeRoute(e,4,0,2)));
 const split=FSimulation.create(fixture({colliders:[{...wall,maxZ:8}]}));assert.equal(split.nav.probeRoute(e,4,0,0),null);
});
test('press and blade footprints are independent of pose and removed after destruction',()=>{
 const sim=FSimulation.create(fixture({traps:[{id:'blade',kind:'blade',x:0,y:0,z:0,w:.5,d:2,h:1,axis:'x',travel:2}]})),nav=sim.nav;
 assert.equal(nav.canTraverse(-4,0,4,0),false);const before=Array.from(nav.edgeOpen);for(let i=0;i<120;i++)sim.step(1/60,{});assert.deepEqual(Array.from(nav.edgeOpen),before);
 sim.state.traps[0].destroyed=true;sim.state.traps[0].hp=0;sim.state.traps[0].box=null;sim.state.traps[0].hot=sim.state.traps[0].warning=false;const saved=sim.snapshot();assert(sim.restore(saved));assert.equal(nav.canTraverse(-4,0,4,0),true);
});
for(const [name,index,opts] of [['legacy',0,undefined],['elevated',2,undefined],['campaign',5,{campaign:true,campaignVersion:2}],['profiles',17,{campaign:true,campaignVersion:2,profiles:true}]])test(name+': every baked edge matches the static body sweep and restores synchronously',()=>{
 const world=FWorld.create(96,index,opts),sim=FSimulation.create(world),nav=sim.nav;assert(nav.ready);
 for(let i=0;i<nav.cells.length;i++)if(nav.cells[i])for(const [j,bit,back] of [[i%nav.nx<nav.nx-1?i+1:-1,2,1],[i+nav.nx,8,4]])if(j>=0&&j<nav.cells.length&&nav.cells[j]){
  const expected=nav.canTraverse(...nav.coord(i),...nav.coord(j),.4);assert.equal(nav.edgeTest(i,j),expected,`${i}/${j}`);assert.equal(!!(nav.edgeOpen[i]&bit),expected,`${i}/${j}`);assert.equal(!!(nav.edgeOpen[j]&back),expected);
 }
 const labels=Array.from(nav.cells,(_,i)=>nav.component(i)),saved=sim.snapshot();assert(sim.restore(saved));assert(nav.ready);assert.deepEqual(Array.from(nav.cells,(_,i)=>nav.component(i)),labels);
});
test('timely CPU and asynchronous advice commit at the same simulation deadline',async()=>{
 let tick=0;const pending=[],world=fixture({generation:6,enemies:[{x:-3,z:-6,type:0},{x:3,z:-6,type:1}],bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}});
 const brains=[FBrain.create({mode:'cpu'}),...[1,10].map(delay=>({status:{generation:0},evaluate(rows){const result={scores:FBrain.cpu(rows),count:rows.length,generation:0,backend:'webnn'};return new Promise(resolve=>pending.push({at:tick+delay,resolve,result}));}}))];
 const sims=brains.map(brain=>FSimulation.create(world,{brain}));
 for(tick=0;tick<240;tick++){
  for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=tick){pending[i].resolve(pending[i].result);pending.splice(i,1);}await Promise.resolve();await Promise.resolve();
  for(const sim of sims){sim.state.player.hp=100;sim.step(1/60,{moveX:tick%120<60?.4:-.4});}
  const hashes=sims.map(sim=>stateDigest(sim.state));assert.equal(hashes[1],hashes[0],'early '+tick);assert.equal(hashes[2],hashes[0],'late '+tick);
  for(const sim of sims)sim.state.events.length=0;
  if(tick===119){const saves=sims.map(sim=>JSON.stringify(sim.snapshot()));assert.equal(saves[0],saves[1]);assert.equal(saves[0],saves[2]);}
 }
 assert(sims[0].state.aiStats.neuralApplied>0);sims.forEach(sim=>sim.dispose());
});
test('attack commitments stay bounded by difficulty without stopping lateral movement',()=>{
 for(let difficulty=0;difficulty<3;difficulty++){
  const sim=FSimulation.create(fixture({bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},enemies:Array.from({length:8},(_,i)=>({x:(i%4-1.5)*3,z:-7-Math.floor(i/4)*4,type:0,role:'flanker'}))}));sim.setDifficulty(difficulty);let maximum=0,moved=false;
  for(let i=0;i<180;i++){sim.state.player.hp=100;sim.step(1/60,{});const aiming=sim.state.enemies.filter(e=>e.hp>0&&(e.windup>0||e.burstLeft>0||e.rushTime>0)).length;maximum=Math.max(maximum,aiming);assert(aiming<=2+difficulty);moved ||= sim.state.enemies.some(e=>e.moveSpeed>.1);}
  assert(maximum>0);assert(moved);sim.dispose();
 }
});
test('checkpoint boundaries retain deterministic tactics, caches and CPU advice',()=>{
 const world=FWorld.create(96,5,{campaign:true,campaignVersion:2,profiles:true}),a=FSimulation.create(world,{brain:FBrain.create({mode:'cpu'})});
 for(let i=0;i<90;i++){a.state.player.hp=100;a.step(1/60,{});a.state.events.length=0;}
 const saved=a.snapshot(),b=FSimulation.create(world,{brain:FBrain.create({mode:'cpu'})});assert(b.restore(saved));
 // Restore intentionally removes presentation events; both hosts consumed them at the checkpoint.
 a.state.events.length=b.state.events.length=0;b.state.destructionRevision=a.state.destructionRevision;
 for(let i=0;i<180;i++){const input={moveX:.5,moveY:1,fire:i%20<4,switchProfile:i===60};for(const sim of [a,b]){sim.state.player.hp=100;sim.step(1/60,input);}assert.equal(stateDigest(a.state),stateDigest(b.state),'restored tick '+i);assert(a.state.aiStats.spawnRays<=64);a.state.events.length=b.state.events.length=0;}
 assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));a.dispose();b.dispose();
});
test('flanks stay on usable floor and a guard on the outer fringe can return',()=>{
 const world=fixture({walkable:[{x:0,z:0,y:0,w:16,d:16,substrate:true},{x:0,z:0,y:0,w:8,d:8}],enemies:[{x:6,z:0,type:0,role:'assault'}]}),sim=FSimulation.create(world),e=sim.state.enemies[0];e.cooldown=30;
 const actor={...e,x:0,z:0,baseY:0,hasMemory:true,lastSeenX:0,lastSeenZ:0};assert.equal(sim.nav.probeGoal(actor,6,0),true);assert(actor.goalX<=4);
 for(let i=0;i<180;i++){sim.state.player.hp=100;sim.step(1/60,{});}assert(e.x<4,'an actor outside the authored floor must be able to return');
});
