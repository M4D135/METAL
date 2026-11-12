import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const context={window:{}};
for(const name of ['world','destruction'])vm.runInNewContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
const {FWorld,FDestruction}=context.window;
const box=(p,s,extra={})=>({shape:'box',p,s,mat:3,...extra});
const bounds=m=>({minX:m.p[0]-m.s[0]/2,maxX:m.p[0]+m.s[0]/2,minY:m.p[1]-m.s[1]/2,maxY:m.p[1]+m.s[1]/2,minZ:m.p[2]-m.s[2]/2,maxZ:m.p[2]+m.s[2]/2});
const vol=c=>(c.maxX-c.minX)*(c.maxY-c.minY)*(c.maxZ-c.minZ);
function fixture(){
  const meshes=[box([0,-.2,0],[20,.4,20],{ground:true}),box([0,2,0],[10,4,.6]),box([0,2,-.315],[9.6,3.5,.025]),box([0,1.2,-.34],[.10,.10,.03]),box([14,2,0],[4,4,.6])];
  return {seed:96,stage:0,generation:5,meshes,colliders:[{...bounds(meshes[1]),mesh:1},{...bounds(meshes[4]),mesh:4}],lights:[],destructibles:[{id:'wall',kind:'wall',strength:18,meshes:[1,2,3],colliders:[0]},{id:'remote',kind:'wall',strength:18,meshes:[4],colliders:[1]}],pipes:[]};
}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))deepFreeze(v);}return value;}
function blocked(d,x,z,y=0,r=.28){return d.colliders.some(c=>c.minY<y+1.8&&c.maxY>y+.06&&Math.hypot(Math.max(c.minX-x,0,x-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ))<r);}
function matching(d){for(const c of d.colliders){const m=d.meshes[c.mesh];assert(m,'solid has no rendered piece');const b=bounds(m);for(const k of Object.keys(b))assert(Math.abs(b[k]-c[k])<1e-8,'visible piece differs from collision bounds');}}

test('explosion opens a body-height local breach with real surviving jambs and no floating cladding',()=>{
  const world=deepFreeze(fixture()),before=JSON.stringify(world),d=FDestruction.create(world);
  assert(d.meshes.every((m,i)=>m===world.meshes[i]),'pristine drawing order changed');
  assert(blocked(d,0,0));const hit=d.blast([0,1.25,-.44],2.8,55);
  assert(hit.changed&&hit.revision===1&&hit.debris.length>0);
  for(let z=-2;z<=2;z+=.08)assert(!blocked(d,0,z),'body cannot traverse the displayed opening');
  assert(blocked(d,4,0),'entire wall vanished instead of a local breach');
  assert(blocked(d,14,0),'unrelated wall disappeared');matching(d);
  const ray=d.raycast([0,1.2,-3],[0,0,1],6);assert.equal(ray,null,'attached panel or screw floats across the hole');
  assert(d.raycast([4,1.2,-3],[0,0,1],6),'surviving jamb is no longer targetable');
  assert.equal(JSON.stringify(world),before,'controller mutated original world');
  assert(hit.debris.every(p=>p.velocity.length===3&&p.size.every(n=>n>0)&&p.life>0));
});

test('ordinary fire accumulates structural damage and each persistent cut remains local',()=>{
  const d=FDestruction.create(fixture());
  for(let i=0;i<8;i++)assert.equal(d.hit([0,1.2,-.31],2,[0,0,1]).changed,false);
  assert.equal(d.revision,0);assert.equal(d.snapshot().states[0].damage,16);
  assert(d.hit([0,1.2,-.31],2,[0,0,1]).changed);assert.equal(d.revision,1);
  assert(blocked(d,4,0));const gouge=d.raycast([0,1.2,-2],[0,0,1],4);assert(gouge&&gouge.distance>2.1,'first group of bullets left no visible indentation');
  for(let i=0;i<9;i++){const hit=d.raycast([0,1.2,-2],[0,0,1],4);if(hit)d.hit(Array.from(hit.point),2,[0,0,1]);}
  assert.equal(d.raycast([0,1.2,-2],[0,0,1],4),null);
  assert(d.raycast([1.5,1.2,-2],[0,0,1],4),'bullet cut became a full rocket opening');matching(d);
});

test('removed supports detach upper pieces and collapse their roof with attached fixtures',()=>{
  const meshes=[box([-3,2,0],[.6,4,.6]),box([3,2,0],[.6,4,.6]),box([0,4.2,0],[8,.4,5]),box([0,3.8,0],[5,.12,.25])];
  const world={seed:7,generation:5,stage:0,meshes,colliders:meshes.slice(0,3).map((m,mesh)=>({...bounds(m),mesh})),destructibles:[
    {id:'a',kind:'support',strength:8,meshes:[0],colliders:[0]},
    {id:'b',kind:'support',strength:8,meshes:[1],colliders:[1]},
    {id:'roof',kind:'roof',strength:18,meshes:[2,3],colliders:[2],supports:['a','b'],supportRatio:.38}
  ],lights:[{p:[0,3.5,0],color:[1,1,1],power:8,destructibleId:'roof'}]};
  const d=FDestruction.create(world);d.blast([-3,.55,0],1.05,55);
  assert(!d.isAlive('a')&&d.isAlive('roof'),'unsupported column upper half remained in the air');
  const result=d.blast([3,.55,0],1.05,55);assert(result.collapsed.includes('roof'));
  assert.equal(d.meshes.length,0);assert.equal(d.colliders.length,0);assert.equal(d.lights.length,0);
});

test('raycast follows visible cylinders, spheres, octahedra and hollow torus instead of filled AABBs',()=>{
  for(const [shape,p,s,origin,dir,shouldHit] of [
    ['sphere',[0,0,0],[2,2,2],[.95,.95,-3],[0,0,1],false],
    ['sphere',[0,0,0],[2,2,2],[0,0,-3],[0,0,1],true],
    ['cylinder',[0,0,0],[2,2,2],[.95,3,.95],[0,-1,0],false],
    ['cylinder',[0,0,0],[2,2,2],[0,3,0],[0,-1,0],true],
    ['octa',[0,0,0],[2,2,2],[.8,.8,-3],[0,0,1],false],
    ['octa',[0,0,0],[2,2,2],[0,0,-3],[0,0,1],true],
    ['ring',[0,0,0],[2,2,2],[0,3,0],[0,-1,0],false],
    ['ring',[0,0,0],[2,2,2],[.87,3,0],[0,-1,0],true]
  ]){
    const d=FDestruction.create({seed:0,meshes:[{shape,p,s,mat:0}],colliders:[]});
    assert.equal(!!d.raycast(origin,dir,6),shouldHit,shape+' incorrect primitive ray');
  }
});

test('pressure leaks happen once and survive an exact-revision snapshot round trip',()=>{
  const world=fixture();world.destructibles[0].kind='pipe';world.destructibles[0].strength=3;world.pipes=[{id:'hot',destructibleId:'wall'}];
  const d=FDestruction.create(world),result=d.hit([0,1.2,-.31],5);assert.deepEqual(Array.from(result.pipeLeaks),['hot']);
  assert.equal(d.blast([0,1.2,0],5,80).pipeLeaks.length,0);
  const saved=JSON.parse(JSON.stringify(d.snapshot())),copy=FDestruction.create(world);assert(copy.restore(saved,{exactRevision:true}));
  assert.equal(JSON.stringify(copy.snapshot()),JSON.stringify(saved));assert.equal(JSON.stringify(copy.meshes),JSON.stringify(d.meshes));assert.equal(JSON.stringify(copy.colliders),JSON.stringify(d.colliders));
});

test('invalid restoration is atomic and cannot inject IDs, fragments or non-finite coordinates',()=>{
  const d=FDestruction.create(fixture());d.blast([0,1.2,-.4],2.8,55);const saved=JSON.parse(JSON.stringify(d.snapshot())),before=JSON.stringify(saved),meshes=d.meshes,colliders=d.colliders;
  const variants=[{...saved,signature:'wrong'}, {...saved,revision:-1}, {...saved,leaks:['missing']}];
  const mutate=f=>{const s=JSON.parse(JSON.stringify(saved));f(s);variants.push(s);};
  mutate(s=>s.states.push({...s.states[0]}));mutate(s=>s.states[0].id='new-body');mutate(s=>s.states[0].cuts[0].minX=NaN);mutate(s=>s.states[0].cuts[0].maxX=10000);mutate(s=>s.states[0].damage=999);
  for(const bad of variants){assert.equal(d.restore(bad),false);assert.equal(JSON.stringify(d.snapshot()),before);assert.equal(d.meshes,meshes);assert.equal(d.colliders,colliders);}
});

test('repeated local demolition stays bounded and only removes physical volume',()=>{
  const d=FDestruction.create(fixture());let previous=d.colliders.reduce((n,c)=>n+vol(c),0);
  for(let i=0;i<70;i++){
    d.blast([((i*7)%17)/2-4,.5+(i%4)*.6,-.4],.7+(i%3)*.2,55);
    const current=d.colliders.reduce((n,c)=>n+vol(c),0);assert(current<=previous+1e-7,'demolition created new solid volume');previous=current;
    assert(d.colliders.length<=24&&d.meshes.length<150,'unbounded fragmentation');matching(d);
  }
  assert.equal(d.hit([0,1,0],NaN).changed,false);assert.equal(d.blast([Infinity,1,0],4,50).changed,false);
});

test('generated scenery, trees and buildings are attached to persistent destructible groups',()=>{
  for(let stage=0;stage<3;stage++){
    const world=FWorld.create(96,stage),d=FDestruction.create(world),original=JSON.stringify(world);
    assert.equal(d.meshes.length,world.meshes.length);assert(d.meshes.every((m,i)=>m===world.meshes[i]));
    const tree=world.trees.find(t=>t.solid),members=world.destructibles.find(g=>g.id===tree.destructibleId).meshes;
    const result=d.blast([tree.x,tree.y+.8,tree.z],2,55);assert(result.changed&&!d.isAlive(tree.destructibleId));
    for(const i of members)assert(!d.meshes.includes(world.meshes[i]),'tree crown remains after trunk destruction');
    const pipe=world.pipes[0],leak=d.hit([pipe.x,pipe.y,pipe.z],5);assert(leak.pipeLeaks.includes(pipe.id));
    const roof=world.destructibles.find(g=>g.kind==='roof'&&g.region.startsWith('room-'));
    for(const id of roof.supports){const support=world.destructibles.find(g=>g.id===id);for(const ci of support.colliders){const c=world.colliders[ci];d.blast([(c.minX+c.maxX)/2,c.minY+.9,(c.minZ+c.maxZ)/2],12,1000);}}
    assert(!d.isAlive(roof.id),'building roof survives removal of all supports');
    const arch=world.destructibles.find(g=>g.kind==='roof'&&g.region==='arena-monument-0');let fall;
    for(const id of arch.supports){const pillar=world.destructibles.find(g=>g.id===id),c=world.colliders[pillar.colliders[0]];fall=d.blast([(c.minX+c.maxX)/2,c.minY+.9,(c.minZ+c.maxZ)/2],4.2,55);}
    assert(!d.isAlive(arch.id)&&fall.collapsed.includes(arch.id),'monumental lintel floats after both piers collapse');
    assert(fall.debris.some(p=>p.size[0]>1&&p.size[1]<.4),'large falling lintel produces only tiny cube chips');

    for(const p of [world.spawn,world.exit,...world.cores,...world.mechanisms,...world.jumpPads.flatMap(p=>[p,p.target])])assert.equal(FWorld.floorHeight(world,p.x,p.z),p.y,'destruction removed required carrying terrain');
    assert.equal(JSON.stringify(world),original);matching(d);
    const copy=FDestruction.create(world);assert(copy.restore(JSON.parse(JSON.stringify(d.snapshot())),{exactRevision:true}));assert.equal(JSON.stringify(copy.colliders),JSON.stringify(d.colliders));
  }
});


test('a working pressure burst spares only its own source while external fire still ruptures it',()=>{
  const world=fixture();world.destructibles[0].kind='pipe';world.destructibles[0].strength=3;world.pipes=[{id:'hot',destructibleId:'wall'}];
  const index=world.meshes.length;world.meshes.push(box([1,1.2,-1],[.4,.4,.4]));world.colliders.push({...bounds(world.meshes[index]),mesh:index});
  world.destructibles.push({id:'nearby',kind:'prop',strength:3,meshes:[index],colliders:[2]});
  const d=FDestruction.create(world),burst=d.blast([0,1.2,-.4],2.8,55,'wall');
  assert(burst.changed&&!d.isAlive('nearby'),'source exemption protected unrelated nearby scenery');
  assert(d.isAlive('wall')&&blocked(d,0,0),'operating burst destroyed its own pipe');assert.equal(burst.pipeLeaks.length,0);
  assert(d.isAlive('remote'));const hit=d.hit([0,1.2,-.31],5);assert(!d.isAlive('wall')&&hit.pipeLeaks.includes('hot'),'external fire no longer ruptures source');
});
