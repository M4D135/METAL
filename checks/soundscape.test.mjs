import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const scope={};vm.createContext(scope);
for(const name of ['destruction','economy','simulation','soundscape'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),scope);
const {FSimulation,FSoundscape}=scope;
function world(extra={}){
  return {seed:96,stage:0,generation:5,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-25,maxX:25,minZ:-25,maxZ:25},
    colliders:[],meshes:[],lights:[],enemies:[],cores:[],pickups:[],hazards:[],rooms:[],corridors:[],exit:{x:24,y:0,z:24},...extra};
}
function scene(extra={}){return FSimulation.create(world(extra));}

test('A nearby material impact is directional; distance and height silence remote impacts',()=>{
  const sim=scene(),sound=FSoundscape.create(),base={name:'materialImpact',material:'metal',seed:17,power:3,y:1.62,z:0};
  const right=sound.event(sim,{...base,x:3}),left=sound.event(sim,{...base,x:-3});
  assert(right.pan>.9&&left.pan<-.9);assert.equal(right.level,left.level);
  assert(right.level>sound.event(sim,{...base,x:12}).level);
  assert.equal(sound.event(sim,{...base,x:40}).level,0);
  assert.equal(sound.event(sim,{...base,x:1,y:40}).level,0,'Vertical separation is real acoustic distance');
  assert.equal(right.material,'metal');assert.equal(right.seed,17);
  sim.state.player.yaw=Math.PI;assert(sound.event(sim,{...base,x:3}).pan<-.9);
});

test('Real collision rays muffle a source behind a wall but preserve an impact on its visible face',()=>{
  const sim=scene({colliders:[{minX:3,maxX:3.5,minY:0,maxY:4,minZ:-3,maxZ:3}]}),sound=FSoundscape.create();
  const hidden=sound.event(sim,{name:'materialBreak',x:6,y:1.62,z:0});
  assert.equal(hidden.occluded,1);
  const clear=sound.event(scene(),{name:'materialBreak',x:6,y:1.62,z:0});
  assert(hidden.level<clear.level*.4);
  assert.equal(sound.event(sim,{name:'materialImpact',x:3,y:1.62,z:0}).occluded,0,'The struck face must not muffle itself');
});

test('Intact nearby machines and hot leaks are the only continuous indoor emitters',()=>{
  const sim=scene({machinery:[{type:'fan',speed:1,size:1,x:4,y:2,z:0,destructibleId:'fan'}],ambience:[{type:'screen',x:1,y:1,z:0}]}),sound=FSoundscape.create();
  const first=sound.sample(sim);assert.equal(first.machinery.kind,'fan');assert(first.machinery.level>0&&first.machinery.pan>.9);assert.equal(first.steam.level,0);
  sim.state.world.machinery[0].speed=0;assert.equal(sound.sample(sim).machinery.level,0);
  sim.state.lifts.push({x:-3,y:0,z:0,moving:true});const lift=sound.sample(sim);assert.equal(lift.machinery.kind,'lift');assert(lift.machinery.pan<-.9);
  sim.state.lifts[0].moving=false;sim.state.pipes.push({x:0,y:1.5,z:3,nozzle:[0,1.5,3],hot:true,broken:false});assert(sound.sample(sim).steam.level>0);
  sim.state.pipes[0].broken=true;assert.equal(sound.sample(sim).steam.level,0);
  const absent={state:sim.state,ray:sim.ray,destruction:{revision:3,isAlive:()=>false}};
  sim.state.world.machinery[0].speed=1;assert.equal(sound.sample(absent).machinery.level,0,'Destroyed machinery must stop making sound');
  assert.equal(sound.sample(scene()).machinery.level,0);assert.equal(sound.sample(scene()).steam.level,0);
});

test('Occlusion probes are bounded, cached, and invalidated by destruction and door movement',()=>{
  const sim=scene(),sound=FSoundscape.create();let calls=0,blocked=true;
  const proxy={state:sim.state,destruction:{revision:0,isAlive:()=>true},ray:(o,d,far)=>{calls++;return blocked?1:far;}};
  const source={x:8,y:1.62,z:0};assert.equal(sound.locate(proxy,source).occluded,1);sound.locate(proxy,source);assert.equal(calls,1);
  for(let i=0;i<80;i++)sound.locate(proxy,{x:5+i*.2,y:1.62,z:4});assert(calls<=12);
  sim.state.time=.13;blocked=false;proxy.destruction.revision++;assert.equal(sound.locate(proxy,source).occluded,0);
  sim.state.doors.push({progress:0});sim.state.time=.3;blocked=true;assert.equal(sound.locate(proxy,source).occluded,1);
  sim.state.doors[0].progress=1;blocked=false;assert.equal(sound.locate(proxy,source).occluded,0);
});

test('A louder unobstructed machine can replace an occluded closer one; player actions stay centered',()=>{
  const sim=scene({machinery:[{type:'fan',speed:1,size:1,x:4,y:1.62,z:0},{type:'piston',speed:1,size:1,x:-5,y:1.62,z:0}],colliders:[{minX:2,maxX:2.5,minY:0,maxY:4,minZ:-2,maxZ:2}]}),sound=FSoundscape.create();
  const mix=sound.sample(sim);assert.equal(mix.machinery.kind,'piston');assert(mix.machinery.pan<0);
  const own=sound.event(sim,{name:'rocket',owner:'player',x:.3,y:1.4,z:-.6});assert.equal(own.level,1);assert.equal(own.pan,0);
  assert.equal(sound.event(sim,{name:'explosion',owner:'player',x:40,y:0,z:0}).occluded,1,'The player’s distant explosion is still a world sound');
});

// MIX-05 (lot 11b T6) : les telegraphes du boss sont des alertes de jeu.
test('les annonces du boss portent a 90 m et ne descendent pas sous 0,6 de niveau dans l enclos (MIX-05)',()=>{
  const sound=FSoundscape.create(),base={name:'bossTell',seed:3,y:1.62,z:0};
  const dans=scene(world({bossArena:{x:0,y:0,z:0,r:28}})),loin=scene(world({bossArena:{x:400,y:0,z:400,r:28}}));
  const ici=sound.event(dans,{...base,x:17}),hors=sound.event(loin,{...base,x:17});
  assert.equal(ici.level,.6,'dans l enclos, l annonce est tenue a 0,6 la ou la distance la laissait a '+hors.level.toFixed(4));
  assert(hors.level>0&&hors.level<.6,'hors de l enclos la loi de distance reprend, mesuree a '+hors.level.toFixed(4));
  assert.equal(ici.pan,hors.pan,'le plancher de niveau ne touche pas le panoramique');
  assert(sound.event(loin,{...base,x:60}).level>0,'la portee 90 m porte l annonce bien au-dela des 36 m du decor');
  assert.equal(sound.event(loin,{...base,x:95}).level,0,'et elle s arrete a 90 m');
  const rugissement=sound.event(dans,{name:'bossRoar',seed:3,y:1.62,z:0,x:17}),lointain=sound.event(loin,{name:'bossRoar',seed:3,y:1.62,z:0,x:17});
  assert.equal(rugissement.level,.6,'le rugissement, la claque, la phase et le tell partagent le plancher, la ou le rugissement seul atteignait '+lointain.level.toFixed(4));
  assert.equal(lointain.level,.5274885145482389,'hors de l enclos, le rugissement garde sa portee de 100 m sans plancher');
});
