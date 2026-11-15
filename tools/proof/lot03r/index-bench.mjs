import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const [base,head,out]=process.argv.slice(2),{loadModules}=await import(pathToFileURL(head+'/tools/proof/render-scene.mjs'));
const sources=[base,head].map(root=>readFileSync(root+'/src/renderer.js','utf8'));
const worlds=loadModules(head,['fmath','renderer','passages','world']);
const builders=sources.map(renderer=>loadModules(head,['renderer'],{renderer:renderer.replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,spatialIndex,environmentInfo};')}).FRender);
const sha=text=>createHash('sha256').update(text).digest('hex');
const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return{p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],mean:a.reduce((a,b)=>a+b,0)/a.length,samples:a.length};};
const report={schema:'metal-03r-index-bench-v1',node:process.version,domain:'Node main realm',clock:'performance.now wall milliseconds; not GPU or FPS',updateScenario:'one replacement per revision; shared added/removed delta; 200 warmup + 3000 alternating samples',base,head,sourceSha256:sources.map(sha),worlds:[]};
for(const stage of [17,6]){
  const w=worlds.FWorld.create(96,stage,{campaign:true,campaignVersion:2}),environment=builders[1].environmentInfo(w.environment),original=w.meshes;
  const identities=new WeakMap();let serial=0;const identity=e=>{if(!identities.has(e.mesh))identities.set(e.mesh,serial++);return identities.get(e.mesh);};
  const coords=i=>[w.spawn.x+Math.sin(i*.013)*85,1.62+Math.sin(i*.04)*8,w.spawn.z+Math.cos(i*.017)*85],ranges=[75,32,18];
  const a0=builders[0].spatialIndex(original,environment),a3=builders[1].spatialIndex(original,environment);let checksum=0;
  for(let i=0;i<120;i++)assert.deepEqual(a0.query(coords(i),ranges).map(identity),a3.query(coords(i),ranges).map(identity));
  function queryPair(indices){const times=[[],[]],buffers=[[],[]];for(let i=0;i<1700;i++)for(const j of i%2?[0,1]:[1,0]){const eye=coords(i),t=performance.now();checksum+=indices[j].query(eye,ranges,buffers[j]).length;const elapsed=performance.now()-t;if(i>=200)times[j].push(elapsed);}return times.map(stats);}
  const query=queryPair([a0,a3]),queryControl=queryPair([builders[0].spatialIndex(original,environment),builders[0].spatialIndex(original,environment)]);
  function updatePair(which){let meshes=original.slice(),indices=which.map(i=>builders[i].spatialIndex(meshes,environment));const times=[[],[]];let dirtyCells=0;
    for(let step=0;step<3200;step++){
      const at=(step*977)%meshes.length,old=meshes[at],next={...old,p:[old.p[0],old.p[1]+(step%2?.02:-.02),old.p[2]]};meshes=meshes.slice();meshes[at]=next;
      for(const j of step%2?[0,1]:[1,0]){const t=performance.now();indices[j]=builders[which[j]].spatialIndex(meshes,environment,indices[j],{added:[next],removed:[old],full:false});const elapsed=performance.now()-t;if(step>=200)times[j].push(elapsed);}
      if(step%100===0){const eye=coords(step);assert.deepEqual(indices[0].query(eye,ranges).map(identity),indices[1].query(eye,ranges).map(identity));}
      dirtyCells+=indices[1].changedCells||0;
    }
    return {cost:times.map(stats),meanChangedCells:dirtyCells/3200};
  }
  const update=updatePair([0,1]),updateControl=updatePair([0,0]);
  const entry={world:'camp:'+stage,seed:96,meshes:original.length,dense:a3.dense,query,queryControl,queryCorrectedRatio:(query[1].p50/query[0].p50)/(queryControl[1].p50/queryControl[0].p50),update,updateControl,updateCorrectedRatio:(update.cost[1].p50/update.cost[0].p50)/(updateControl.cost[1].p50/updateControl.cost[0].p50),identicalQueryResultsAndOrder:true,checksum};report.worlds.push(entry);console.log(JSON.stringify(entry));
}
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
