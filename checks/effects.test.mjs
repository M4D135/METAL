import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../src/effects.js',import.meta.url),'utf8'),scope);
const Effects=scope.window.FEffects,camera={pos:[0,1.62,5],yaw:0,pitch:0,fov:74};
const geometryScope={window:{}};vm.runInNewContext(readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8').replace('window.FRender={create};','window.FRender={create,geometry};'),geometryScope);
const geometry=geometryScope.window.FRender.geometry(),plain=v=>JSON.parse(JSON.stringify(v));
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function vertices(m){
  const range=geometry.ranges[m.shape],out=[],[rx,ry,rz]=m.r||[0,0,0],c=[rx,ry,rz].map(Math.cos),s=[rx,ry,rz].map(Math.sin),indices=new Set();
  for(let j=range.offset/2;j<range.offset/2+range.count;j++)indices.add(geometry.indices[j]);
  for(const i of indices){let x=geometry.vertices[i*6]*m.s[0],y=geometry.vertices[i*6+1]*m.s[1],z=geometry.vertices[i*6+2]*m.s[2];[y,z]=[c[0]*y-s[0]*z,s[0]*y+c[0]*z];[x,z]=[c[1]*x+s[1]*z,-s[1]*x+c[1]*z];out.push([c[2]*x-s[2]*y+m.p[0],s[2]*x+c[2]*y+m.p[1],z+m.p[2]]);}
  return out;
}
function validate(meshes){for(const m of meshes){assert(geometry.ranges[m.shape]);assert(m.p.concat(m.s,m.r).every(Number.isFinite));assert(m.s.every(v=>v>0));assert.equal(m.surface,'object');if(m.fx)assert(m.alpha>0&&m.alpha<=.94);}}

test('effects are deterministic read-only views of authoritative ages and disappear when expired',()=>{
  assert.equal(Effects.build({}, {},camera).length,0);assert.equal(Effects.flash({},camera),0);
  const state=freeze({time:2,explosions:[{id:1,x:0,y:1,z:-2,age:.04,life:.8,radius:4,power:8,seed:772}],debris:[{x:1,y:2,z:-3,size:[.12,.18,.1],age:.2,life:1.5,seed:5,mat:3}]});
  const before=JSON.stringify(state),first=Effects.build(state,{},camera),second=Effects.build(state,{},camera);validate(first);assert.deepEqual(plain(first),plain(second));assert.equal(JSON.stringify(state),before);
  assert(first.some(m=>m.effectPart==='blast-core'));assert(first.some(m=>m.effectPart==='shock-ring'));assert(first.some(m=>m.effectPart==='debris'));assert(Effects.flash(state,camera)>0);
  const later=Effects.build({...state,explosions:[{...state.explosions[0],age:.5}]},{},camera);assert(later.some(m=>m.effectPart==='blast-dust'));assert(!later.some(m=>m.effectPart==='blast-core'));
  assert.equal(Effects.build({explosions:[{...state.explosions[0],age:.8}],debris:[{...state.debris[0],age:1.5}]},{},camera).length,0);
  const queued={explosions:[{...state.explosions[0],age:-.2,kind:'boss'}]};assert.equal(Effects.build(queued,{},camera).length,0);assert.equal(Effects.flash(queued,camera),0,'queued giant-death lobes must wait for their actual simulation start');
});

test('rocket tips, fins and tumbling grenades fit entirely inside their real swept collision sphere',()=>{
  for(const kind of ['rocket','grenade'])for(const velocity of [[1,0,0],[0,1,0],[0,0,-1],[2,3,-4],[-5,-2,3],[0,0,0]])for(const age of [0,.17,1.23]){
    const q={kind,id:7,owner:'player',x:2,y:6.4,z:-3,vx:velocity[0],vy:velocity[1],vz:velocity[2],radius:kind==='rocket'?.24:.17,age,life:4,fuse:2};
    const meshes=Effects.build({projectiles:[q]}, {},{pos:[2,7,-1]});validate(meshes);
    const bodies=meshes.filter(m=>!m.fx);assert(bodies.length>=2);
    for(const m of bodies)for(const p of vertices(m))assert(Math.hypot(p[0]-q.x,p[1]-q.y,p[2]-q.z)<=q.radius+1e-7,kind+' '+m.effectPart+' escapes its physical sphere');
  }
});

test('presses, blades and spikes occupy exactly the current physical box without invented motion',()=>{
  for(const kind of ['press','blade','spikes'])for(const angle of [0,.7,2.1]){
    const box=kind==='blade'?{minX:-.14,maxX:.14,minY:1,maxY:3,minZ:-2,maxZ:0}:{minX:-1,maxX:1,minY:0,maxY:kind==='spikes'?.7:1.4,minZ:-2,maxZ:0};
    const trap={id:1,kind,x:0,y:0,z:-1,box,angle,progress:.3,hot:true,warning:false};
    const meshes=Effects.build({time:1,traps:[trap]}, {},camera);validate(meshes);assert(meshes.length>0);
    for(const m of meshes)for(const p of vertices(m))for(let k=0;k<3;k++)assert(p[k]>=box[['minX','minY','minZ'][k]]-1e-7&&p[k]<=box[['maxX','maxY','maxZ'][k]]+1e-7,kind+' '+m.effectPart+' escapes collision');
    assert.deepEqual(plain(meshes),plain(Effects.build({time:40,traps:[trap]}, {},camera)),'a stopped hazard cannot move merely because render time advances');
    assert.equal(Effects.build({traps:[{...trap,destroyed:true}]},{},camera).length,0);
  }
  const warning=Effects.build({traps:[{kind:'spikes',x:0,y:3.2,z:-1,w:2,d:2,box:null,warning:true}]},{},camera);
  assert(warning.length===4&&warning.every(m=>m.effectPart==='spike-warning'));
  assert.equal(Effects.build({traps:[{kind:'spikes',x:0,y:0,z:0,box:null,warning:false}]},{},camera).length,0);
});

test('steam starts at the exposed nozzle and remains within the actual directed hot volume',()=>{
  for(const d of [[1,0,0],[0,1,0],[0,0,-1],[.6,0,.8]]){
    const pipe={id:4,x:0,y:1,z:-1,nozzle:[d[0]*.46,1+d[1]*.46,-1+d[2]*.46],dx:d[0],dy:d[1],dz:d[2],length:3,radius:.45,active:true,hot:true};
    const meshes=Effects.build({time:2.4,pipes:[pipe]},{},camera),steam=meshes.filter(m=>m.effectPart==='steam');assert(steam.length>=3);validate(meshes);
    assert.deepEqual(plain(meshes.find(m=>m.effectPart==='pipe-warning').p),pipe.nozzle);
    for(const m of steam){const delta=m.p.map((v,k)=>v-pipe.nozzle[k]),along=delta.reduce((n,v,k)=>n+v*d[k],0),radial=Math.hypot(...delta.map((v,k)=>v-along*d[k])),r=m.s[0]/2;assert(along-r>=-1e-7&&along+r<=pipe.length+1e-7);assert(radial+r<=pipe.radius+1e-7);}
    assert(!Effects.build({pipes:[{...pipe,hot:false,warning:true}]},{},camera).some(m=>m.effectPart==='steam'));
    assert.equal(Effects.build({pipes:[{...pipe,active:false}]},{},camera).length,0);
  }
});

test('settled wide roof slabs keep their bottom on the floor throughout their fade',()=>{
  const q={x:0,y:3.32,z:0,vx:0,vy:0,vz:0,size:[2.4,.24,1.8],life:2.5,seed:91,mat:3,resting:true};
  let yaw;
  for(const age of [.1,1.1,2.1,2.4]){
    const state=freeze({debris:[{...q,age}]}),m=Effects.build(state,{}, {pos:[0,5,4]}).find(m=>m.effectPart==='debris');assert(m);
    assert.equal(m.r[0],0);assert.equal(m.r[2],0);yaw??=m.r[1];assert.equal(m.r[1],yaw);
    assert(Math.abs(Math.min(...vertices(m).map(p=>p[1]))-3.2)<1e-7,'a landed slab cannot spin through the floor or float upward while fading');
    if(age===.1)assert.equal(m.s[0],2.4,'rectangular destruction sizes stay intact');
  }
});

test('boss circles, exact annuli and swept capsules remain visible at large arena edges and at the feet',()=>{
  const base={id:1,x:0,y:0,z:0,warning:false,active:true,age:.5,duration:2,tell:.6,activeDuration:1.4,phase:2};
  const attacks=[{...base,kind:'ring',radius:28,currentRadius:12,innerRadius:9},{...base,kind:'slam',radius:8},{...base,kind:'sweep',dx:1,dz:0,width:2,length:20}];
  const state={bossAttacks:attacks,time:2},meshes=Effects.build(state,{},camera);validate(meshes);
  const ring=meshes.find(m=>m.effectPart==='boss-ring');assert.equal(ring.s[0],24);assert.equal(ring.innerRatio,.75);assert(ring.fxPriority==='hazard');
  const sweep=meshes.find(m=>m.effectPart==='boss-sweep');assert.equal(sweep.s[0],4);assert.equal(sweep.s[2],20);assert.equal(sweep.p[0],10);
  assert.equal(meshes.filter(m=>m.effectPart==='boss-sweep-cap').length,2);
  const edge=Effects.build({bossAttacks:[{...base,kind:'ring',currentRadius:40,innerRadius:36}]},{},{pos:[112,1.62,0]});assert(edge.some(m=>m.effectPart==='boss-ring'),'visible outer edge must not be culled by centre distance');
  const feet=Effects.build(state,{}, {pos:[0,1.62,0]},{backend:'canvas2d'});assert(feet.some(m=>m.effectPart==='boss-ring'));
  assert.equal(Effects.build({bossAttacks:[{...base,kind:'slam',radius:8,active:false,warning:false}]},{},camera).length,0);
});

test('cosmetic storm budgets keep hazards/projectile bodies and do not mutate or simulate debris',()=>{
  const state={time:3,explosions:Array.from({length:24},(_,i)=>({x:(i%4)-2,y:1,z:-3-Math.floor(i/4),age:.25,life:.8,radius:5,seed:i})),debris:Array.from({length:96},(_,i)=>({x:(i%8)-4,y:2,z:-3,age:.3,life:2,size:[.1,.15,.1],seed:i})),
    projectiles:[{kind:'rocket',x:0,y:1,z:-4,vx:0,vy:0,vz:-18,age:1,radius:.24}],traps:[{kind:'press',box:{minX:1,maxX:3,minY:0,maxY:2,minZ:-4,maxZ:-2},hot:true}]};
  freeze(state);const before=JSON.stringify(state);
  for(const backend of ['canvas2d','webgl2'])for(const quality of ['low','auto','high']){
    const meshes=Effects.build(state,{},camera,{backend,quality});validate(meshes);const tier={low:0,auto:1,high:2}[quality];
    assert(meshes.filter(m=>m.fx).length<=(backend==='canvas2d'?[24,44,64]:[48,96,144])[tier]);
    assert(meshes.filter(m=>m.effectPart==='debris').length<=(backend==='canvas2d'?[8,18,28]:[18,38,60])[tier]);
    assert(meshes.some(m=>m.effectPart==='rocket-body'));assert(meshes.some(m=>m.effectPart==='press-body'));
    for(const m of meshes.filter(m=>m.effectPart==='debris'))assert.equal(m.p[1],2,'rendering must not integrate another gravity step');
  }
  assert.equal(JSON.stringify(state),before);
});
