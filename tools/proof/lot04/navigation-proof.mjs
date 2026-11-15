import {loadRealm} from '../../realm-loader.mjs';
import {stateDigest,snapshotDigest} from '../digest.mjs';
import {environment,summarize} from '../common.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),[reference,out]=process.argv.slice(2),baseline=readFileSync(reference,'utf8'),modules=['fmath','passages','renderer','profiles','world','destruction','economy','brain','simulation'];
function expose(src){return src.replace('nav:{',`nav:{probeRoute(e,x,z){routeBudget=Infinity;${src.includes('routeWork=')?'routeWork=Infinity;':''}return route(e,x,z);},`);}
const a=loadRealm({root,modules,transform:(name,src)=>name==='simulation'?expose(baseline):src}),b=loadRealm({root,modules,transform:(name,src)=>name==='simulation'?expose(src):src});
const report={environment:environment(),baselineLoaded:a.loadedSha256.simulation,candidateSource:b.sourceSha256.simulation,steps:0,rows:[],note:'AI behavior intentionally differs. Paired replay equality compares two current instances; reference only supplies CPU timings. Timings are main-realm thread CPU, not FPS or GPU.'};
const now=()=>process.threadCpuUsage(),cost=t=>{const v=process.threadCpuUsage(t);return v.user+v.system;};
for(const [name,index,options] of [['legacy0',0,undefined],['legacy2',2,undefined],['campaign6',5,{campaign:true,campaignVersion:2}],['campaign17',17,{campaign:true,campaignVersion:2}],['profiles6',5,{campaign:true,campaignVersion:2,profiles:true}],['profiles17',17,{campaign:true,campaignVersion:2,profiles:true}]]){
 const world=b.window.FWorld.create(96,index,options),sims=[],creation=[];for(const realm of [a,b,b]){const t=now();sims.push(realm.window.FSimulation.create(world,{brain:realm.window.FBrain.create({mode:'cpu'})}));creation.push(cost(t));}
 let random=42;const rnd=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296),cells=Array.from(sims[0].nav.cells,(v,i)=>v?i:-1).filter(i=>i>=0),routes=[[],[]],found=[0,0];
 for(let i=0;i<80;i++){const start=sims[0].nav.coord(cells[Math.floor(rnd()*cells.length)]),end=sims[0].nav.coord(cells[Math.floor(rnd()*cells.length)]);for(const k of i%2?[1,0]:[0,1]){const t=now(),path=sims[k].nav.probeRoute({x:start[0],z:start[1],type:0,bossScale:1},...end);routes[k].push(cost(t));if(Array.isArray(path))found[k]++;}}
 // Reset caches consistently for the paired current replay.
 for(const sim of sims)sim.snapshot();
 const stepTimes=[[],[]];let maxSearches=0,maxSpawnRays=0,maxNavCells=0;
 for(let i=0;i<1800;i++){
  const input={moveX:Math.sin(i/90),moveY:1,sprint:true,fire:i%20<6,dash:i%240===0,lookX:.01,lookY:0,jump:i%180===0,jumpHeld:i%180<20,switchProfile:!!options?.profiles&&i%360===0};
  for(const sim of sims){const s=sim.state;s.player.hp=Math.max(s.player.hp,80);if(i%300===0&&s.encounters.length){const q=s.encounters[Math.floor(i/300)%s.encounters.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}}
  for(const k of i%2?[1,0]:[0,1]){const t=now();sims[k].step(1/60,input);stepTimes[k].push(cost(t));}sims[2].step(1/60,input);
  assert.equal(stateDigest(sims[1].state),stateDigest(sims[2].state),name+' deterministic tick '+i);report.steps++;
  const st=sims[1].state.aiStats;maxSearches=Math.max(maxSearches,st.pathSearches);maxSpawnRays=Math.max(maxSpawnRays,st.spawnRays||0);maxNavCells=Math.max(maxNavCells,st.navUpdates||0);for(const sim of sims)sim.state.events.length=0;
 }
 const final=[snapshotDigest(sims[1]),snapshotDigest(sims[2])];assert.equal(final[0].sha256,final[1].sha256);assert(maxSearches<=2);assert(maxSpawnRays<=64);assert(maxNavCells<=768);
 const row={name,creationUs:creation.slice(0,2),routes:routes.map(summarize),found,steps:stepTimes.map(summarize),maxSearches,maxSpawnRays,maxNavCells,snapshot:final[0].sha256};report.rows.push(row);console.log(JSON.stringify(row));sims.forEach(sim=>sim.dispose());
}
report.deterministic=true;writeFileSync(out,JSON.stringify(report,null,2));
