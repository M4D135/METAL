import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../src/effects.js',import.meta.url),'utf8'),scope);
const Effects=scope.window.FEffects,camera={pos:[0,1.62,5],yaw:0,pitch:0,fov:74};
const geometryScope={window:{}};vm.runInNewContext(readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,geometry};'),geometryScope);
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
    assert.equal(Effects.build({pipes:[{...pipe,broken:true}]},{},camera).length,0,'A missing nozzle cannot render residual steam even if old active flags remain');
  }
});

test('detonations separate a fast expanding pressure front, hot fire, ballistic embers and lingering cold smoke',()=>{
  const blast={id:8,x:0,y:2,z:-8,life:2.4,radius:4.5,power:55,seed:887},make=age=>Effects.build({time:10,explosions:[{...blast,age}]},{},camera,{quality:'high'});
  const first=make(.04),early=make(.25),late=make(1.4);for(const meshes of [first,early,late])validate(meshes);
  assert(first.some(m=>m.effectPart==='blast-core'));assert(!early.some(m=>m.effectPart==='blast-core'));
  const front=age=>make(age).find(m=>m.effectPart==='shock-ring');assert(front(.3).s[0]>front(.05).s[0]*1.8);assert(front(.3).innerRatio>.9);
  assert(early.some(m=>m.effectPart==='fire-cloud'&&m.emissive>2));assert(early.some(m=>m.effectPart==='blast-ember'));
  assert(late.some(m=>m.effectPart==='blast-dust'));assert(!late.some(m=>['blast-core','shock-ring','fire-cloud'].includes(m.effectPart)));
  assert.equal(make(2.4).length,0);assert.deepEqual(plain(early),plain(make(.25)),'Rendering must not add independent timers or physics');
  const many=Array.from({length:12},(_,i)=>({...blast,id:i,x:(i%4)*2-3,z:-8-Math.floor(i/4)*2,age:.04,seed:i}));
  const storm=Effects.build({explosions:many},{},camera,{quality:'auto'});assert(storm.filter(m=>m.effectPart==='shock-ring').length===12,'Each simultaneous visible explosion retains its pressure front');assert(storm.filter(m=>m.fx).length<=96);
});

test('blast lighting is anchored to live sources, fades independently of smoke and retains a fixed light budget',()=>{
  const blast={id:1,x:4,y:1.3,z:-8,age:.04,life:2.4,radius:4.5,power:55},state=freeze({player:{x:0,y:0,z:0},explosions:[blast]});
  const light=Effects.lights(state)[0];assert.deepEqual(plain(light.p),[4,1.3,-8]);assert(light.power>20);assert(light.range>10);
  assert(Effects.lights({...state,explosions:[{...blast,age:.5}]})[0].power<light.power*.2);
  assert.equal(Effects.lights({...state,explosions:[{...blast,age:1.4}]}).length,0,'Lingering smoke must not keep glowing');
  assert.equal(Effects.lights({...state,explosions:[{...blast,age:-.1}]}).length,0);
  const storm={player:state.player,explosions:Array.from({length:24},(_,i)=>({...blast,id:i,x:i+2})),projectiles:Array.from({length:48},(_,i)=>({kind:'rocket',x:i,y:1,z:-12,age:.2,life:3}))};
  assert.equal(Effects.lights(storm).length,4);assert.deepEqual(plain(Effects.lights(state)),plain([light]));
});

test('spark trails end at the ballistic tip while cold smoke and hot sparks keep distinct material tags',()=>{
  const blast={id:1,x:0,y:3,z:-5,age:.4,life:2.4,radius:4.5,power:55,seed:887},state=freeze({time:3,explosions:[blast]});
  const first=Effects.build(state,{},camera,{quality:'high'});validate(first);
  const sparks=first.filter(m=>m.effectPart==='blast-ember'),smoke=first.filter(m=>m.effectPart==='blast-dust');
  assert(sparks.length>0&&sparks.every(m=>m.fxSpark&&!m.fxSmoke&&!m.fxFire&&m.s[1]>m.s[0]*2));
  assert(smoke.length>0&&smoke.every(m=>m.fxSmoke&&!m.fxSpark&&!m.fxFire));
  assert(first.filter(m=>m.effectPart==='fire-cloud').every(m=>m.fxFire&&!m.fxSmoke&&!m.fxSpark));
  // Follow the actual tip twice: its horizontal velocity stays constant and
  // its vertical displacement includes gravity, independently of render time.
  const tip=m=>{const a=matrixFor(m.r),direction=[a[1],a[4],a[7]];return m.p.map((v,k)=>v+direction[k]*m.s[1]/2);};
  function matrixFor(r){const [x,y,z]=r,c=[x,y,z].map(Math.cos),s=[x,y,z].map(Math.sin);return [c[2]*c[1],c[2]*s[1]*s[0]-s[2]*c[0],c[2]*s[1]*c[0]+s[2]*s[0],s[2]*c[1],s[2]*s[1]*s[0]+c[2]*c[0],s[2]*s[1]*c[0]-c[2]*s[0],-s[1],c[1]*s[0],c[1]*c[0]];}
  const a=tip(sparks[0]),later=Effects.build({time:50,explosions:[{...blast,age:.6}]},{},camera,{quality:'high'}),b=tip(later.find(m=>m.effectPart==='blast-ember'));
  assert(Math.abs((b[0]-blast.x)/.6-(a[0]-blast.x)/.4)<1e-8);
  assert(Math.abs((b[2]-blast.z)/.6-(a[2]-blast.z)/.4)<1e-8);
  assert(Math.abs((b[1]-blast.y+3*.6*.6)/.6-(a[1]-blast.y+3*.4*.4)/.4)<1e-8);
  assert.equal(Effects.build({explosions:[{...blast,age:1.4}]},{},camera).filter(m=>m.fxSpark).length,0);
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

test('trophy lighting follows persisted discoveries and grace, retains its ground anchor and yields to combat lights',()=>{
  const world={trophies:[{id:7,key:'rifle',x:2,y:3.5,z:-4}]};
  const make=(phase,discovered=[])=>freeze({player:{x:2,y:3.5,z:0},world,campaign:{version:1,discovered,trophies:[{id:7,phase,timer:phase==='grace'?3:0}]}});
  assert.equal(Effects.lights(make('sealed')).length,0,'sealed trophies cannot reveal themselves through a live light');
  const state=make('grace',['rifle']),saved=JSON.stringify(state),light=Effects.lights(state)[0];
  assert.deepEqual(plain(light.p),[2,5.6,-4]);assert(light.power>0&&light.range>0);
  assert.equal(JSON.stringify(state),saved);assert.deepEqual(plain(Effects.lights(JSON.parse(saved))),plain([light]));
  for(const phase of ['trial','complete']){const permanent=Effects.lights(make(phase,['rifle']))[0];assert(permanent.power>0&&permanent.power<light.power);assert.deepEqual(plain(permanent.p),[2,5.6,-4]);}
  assert(Effects.lights(make('sealed',['rifle']))[0].power>0,'loadout discovery also lights a revisited pedestal');
  assert.equal(Effects.lights({...state,player:{x:300,y:0,z:300}}).length,0,'offscreen remote trophy lights do not occupy the pool');
  assert.equal(Effects.lights({world}).length,0,'the legacy path does not activate campaign light');
  const blasts=Array.from({length:4},(_,i)=>({id:i,x:i+1,y:4,z:-3,age:.04,life:2.4,radius:4,power:55}));
  const crowded=Effects.lights({...state,explosions:blasts});assert.equal(crowded.length,4);assert(crowded.every(l=>!l.trophy),'combat transients retain all four existing slots');
  const one=Effects.lights({...state,explosions:blasts.slice(0,1)});assert.equal(one.length,2);assert(!one[0].trophy&&one[1].trophy);
});
