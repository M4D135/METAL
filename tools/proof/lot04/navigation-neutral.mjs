import {loadRealm} from '../../realm-loader.mjs';
import {stateDigest,snapshotDigest} from '../digest.mjs';
import {environment,summarize} from '../common.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),[candidate,out]=process.argv.slice(2),candidateSource=readFileSync(candidate,'utf8');
const modules=['fmath','passages','renderer','profiles','world','destruction','economy','brain','simulation'];
const expose=src=>src.replace('nav:{cells:nav,','nav:{probeRoute(e,x,z){routeBudget=2;return route(e,x,z);},cells:nav,');
const a=loadRealm({root,modules,transform:(name,src)=>name==='simulation'?expose(src):src}),b=loadRealm({root,modules,transform:(name,src)=>name==='simulation'?expose(candidateSource):src});
const report={environment:environment(),baseline:a.sourceSha256.simulation,candidate:createHash('sha256').update(candidateSource).digest('hex'),pairs:0,rows:[]};
const now=()=>process.threadCpuUsage(),cost=t=>{const end=process.threadCpuUsage(t);return end.user+end.system;};
for(const [name,index,options] of [['legacy0',0,undefined],['legacy2',2,undefined],['campaign6',5,{campaign:true,campaignVersion:2}],['campaign17',17,{campaign:true,campaignVersion:2}],['profiles6',5,{campaign:true,campaignVersion:2,profiles:true}],['profiles17',17,{campaign:true,campaignVersion:2,profiles:true}]]){
 const sims=[a,b].map(q=>q.window.FSimulation.create(q.window.FWorld.create(96,index,options),{brain:q.window.FBrain.create({mode:'cpu'})})),times=[[],[]],probeTimes=[[],[]];
 let random=42;const rnd=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296),bounds=sims[0].state.world.bounds;
 for(let n=0;n<600;n++){
   const x=()=>bounds.minX+rnd()*(bounds.maxX-bounds.minX),z=()=>bounds.minZ+rnd()*(bounds.maxZ-bounds.minZ),args=[x(),z(),x(),z(),[.38,.4,1.05,1.5,2.8][n%5]],values=[];
   if(n%20===0)args[0]=bounds.minX-3;
   for(const k of n%2?[1,0]:[0,1]){const start=now();values[k]=sims[k].nav.canTraverse(...args);probeTimes[k].push(cost(start));}
   assert.equal(values[0],values[1],name+' traversal '+n);
 }
 const routes=[[],[]],cells=Array.from(sims[0].nav.cells,(v,i)=>v?i:-1).filter(i=>i>=0);let routesFound=0;
 for(let n=0;n<60;n++){
   const start=sims[0].nav.coord(cells[Math.floor(rnd()*cells.length)]),end=sims[0].nav.coord(cells[Math.floor(rnd()*cells.length)]),paths=[];
   for(const k of n%2?[1,0]:[0,1]){const t=now();paths[k]=sims[k].nav.probeRoute({x:start[0],z:start[1],type:n%5===0?3:0,bossScale:n%5===0?1.8:1},...end);routes[k].push(cost(t));}
   assert.deepEqual(paths[0],paths[1],name+' route '+n);if(paths[0]!==null)routesFound++;
 }
 let searches=0;
 for(let i=0;i<1200;i++){
   const input={moveX:Math.sin(i/90),moveY:1,sprint:true,fire:i%20<6,dash:i%240===0,lookX:.01,lookY:0,jump:i%180===0,jumpHeld:i%180<20,switchProfile:!!options?.profiles&&i%360===0};
   for(const sim of sims){const s=sim.state;s.player.hp=Math.max(s.player.hp,70);if(i%300===0&&s.encounters?.length){const q=s.encounters[Math.floor(i/300)%s.encounters.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}}
   for(const k of i%2?[1,0]:[0,1]){const start=now();sims[k].step(1/60,input);times[k].push(cost(start));}
   assert.equal(stateDigest(sims[0].state),stateDigest(sims[1].state),name+' step '+i);report.pairs++;searches+=sims[0].state.aiStats.pathSearches;
   for(const sim of sims)sim.state.events.length=0;
 }
 const final=sims.map(snapshotDigest);assert.equal(final[0].sha256,final[1].sha256,name+' checkpoint');
 report.rows.push({name,searches,steps:times.map(summarize),traversals:probeTimes.map(summarize),routes:routes.map(summarize),routesFound,snapshot:final[0].sha256});for(const sim of sims)sim.dispose();
 console.log(JSON.stringify({name,searches,pairs:report.pairs,routeMeans:routes.map(x=>summarize(x).meanUs),routesFound,stepMeans:times.map(x=>summarize(x).meanUs),traversalMeans:probeTimes.map(x=>summarize(x).meanUs)}));
}
report.identical=true;writeFileSync(out,JSON.stringify(report,null,2));
