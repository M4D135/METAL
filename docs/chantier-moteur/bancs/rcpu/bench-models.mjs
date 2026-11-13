// RCPU: game.js models() breakdown by section (time + meshes produced), tour scenario.
// usage: node bench-models.mjs <ferroRoot> [frames=3000] [world=camp:17] [quality=auto]
import {scene,GPROF,resetGProf,timers} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':'),quality=process.argv[5]||'auto';
const S=scene(root,{world:[kind,+idx],quality,instrument:true});
const label={419:'machinery+ambience+systems',420:'FEffects.build + spread',427:'setup + actorFilter',432:'cores',451:'enemies (FActors.build)',452:'pickups+loot (supplyModel)',458:'trophies',465:'exit',466:'bullets',467:'particles',472:'pulse',584:'weapons/shield overlay'};
let total=0,tags={};
for(let i=0;i<frames+120;i++){
  if(i===120){resetGProf();total=0;tags={};for(const k in timers){timers[k].ms=0;timers[k].calls=0;}}
  const r=S.frame(1/60,{tour:true});if(i>=120)total+=r.modelsMs;
}
const n=GPROF.frames;
console.log('world',kind+':'+idx,'quality',quality,'frames',n,'models mean',(total/n*1000).toFixed(1),'us');
for(const [line,ms] of [...GPROF.ms].sort((a,b)=>b[1]-a[1]))console.log(String(line).padStart(4),(label[line]||'').padEnd(30),(ms/n*1000).toFixed(1).padStart(7),'us/frame',(GPROF.count.get(line)/n).toFixed(1).padStart(7),'meshes/frame');
for(const [k,v] of Object.entries(timers))console.log('  timer',k,(v.ms/n*1000).toFixed(1),'us/frame',(v.calls/n).toFixed(2),'calls/frame');
const s=S.sim.state;console.log('pickups',s.pickups.length,'loot',(s.loot||[]).length,'debris',(s.debris||[]).length,'structural',(s.debris||[]).filter(d=>d.structural).length);
