// Paired direct destruction, including separate lazy render-list materialisation.
import {loadRealm} from '../../realm-loader.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [base,current,out]=process.argv.slice(2),A=loadRealm({root:base}),B=loadRealm({root:current});
const rows=[];let identical=true;
for(let pass=0;pass<6;pass++)for(const stage of [0,1,2]){
 const wa=A.window.FWorld.create(96,stage,{campaign:true,campaignVersion:2}),wb=B.window.FWorld.create(96,stage,{campaign:true,campaignVersion:2});
 const a=A.window.FDestruction.create(wa),b=B.window.FDestruction.create(wb);
 const points=wa.destructibles.slice(0,30).map(g=>wa.meshes[g.meshes[0]].p);
 for(let i=0;i<points.length;i++){
  const point=points[i],values={};
  for(const side of (pass+i)%2?['b','a']:['a','b']){
   const d=side==='a'?a:b,c0=process.threadCpuUsage(),t=performance.now(),result=d.blast(point,2.8,55),wall=performance.now()-t,cpu=process.threadCpuUsage(c0),c2=process.threadCpuUsage(),t2=performance.now(),meshes=d.meshes,renderWall=performance.now()-t2,renderCpu=process.threadCpuUsage(c2);
   values[side]={cpuUs:cpu.user+cpu.system,wallUs:wall*1000,renderUs:renderWall*1000,renderCpuUs:renderCpu.user+renderCpu.system,totalCpuUs:cpu.user+cpu.system+renderCpu.user+renderCpu.system,changed:result.changed,revision:d.revision};values[side+'Result']=result;
  }
  assert.deepEqual(values.aResult,values.bResult);assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.meshes,b.meshes);assert.deepEqual(a.colliders,b.colliders);assert.deepEqual(a.lights,b.lights);
  delete values.aResult;delete values.bResult;rows.push({pass,stage,index:i,excludedWarmup:pass===0,order:(pass+i)%2?'BA':'AB',...values});
 }
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,median=a=>{if(!a.length)return null;const v=a.slice().sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
const measured=rows.filter(r=>!r.excludedWarmup&&r.a.changed),summary={impacts:measured.length,aMeanCpuUs:mean(measured.map(r=>r.a.cpuUs)),bMeanCpuUs:mean(measured.map(r=>r.b.cpuUs)),pairedMedianRatio:median(measured.filter(r=>r.a.cpuUs>0).map(r=>r.b.cpuUs/r.a.cpuUs)),excludedQuantizedBlastPairs:measured.filter(r=>r.a.cpuUs<=0).length,aMeanRenderUs:mean(measured.map(r=>r.a.renderUs)),bMeanRenderUs:mean(measured.map(r=>r.b.renderUs)),aMeanRenderCpuUs:mean(measured.map(r=>r.a.renderCpuUs)),bMeanRenderCpuUs:mean(measured.map(r=>r.b.renderCpuUs)),aMeanTotalCpuUs:mean(measured.map(r=>r.a.totalCpuUs)),bMeanTotalCpuUs:mean(measured.map(r=>r.b.totalCpuUs)),pairedMedianTotalCpuRatio:median(measured.filter(r=>r.a.totalCpuUs>0).map(r=>r.b.totalCpuUs/r.a.totalCpuUs)),excludedQuantizedTotalPairs:measured.filter(r=>r.a.totalCpuUs<=0).length};
const report={schema:'metal-lot03s-revision-cost-v1',node:process.version,method:'Main realm; 1 warmup and 5 measured passes; AB/BA alternation per impact and pass; threadCpuUsage; blast and lazy mesh flatten timed separately then summed, equality assertions excluded; exact payload/mesh/collider/light/snapshot equality after every impact',variants:{a:A.sourceSha256,b:B.sourceSha256},identical,summary,rows};
writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(summary));
