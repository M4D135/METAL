// Reconstruction paresseuse : damage() ne fait plus rebuild() à chaque plomb ; les tableaux meshes/colliders/lights
// sont reconstruits au premier accès. Rejeu de trace : mêmes états, mêmes colliders, moins de reconstructions.
import {readFileSync} from 'node:fs';import {loadFast,fnv,q,mean} from './lib.mjs';
const count=["    function rebuild(next=states){","    function rebuild(next=states){globalThis.__RB&&globalThis.__RB();"];
const lazy=[
  count,
  ["        rebuild();revision++;result.revision=revision;","        dirty=true;revision++;result.revision=revision;"],
  ["    rebuild();\n    function raycast(","    let dirty=false;const fresh=()=>{if(dirty){dirty=false;rebuild();}};\n    rebuild();\n    function raycast("],
  ["    return {get meshes(){return meshes;},get colliders(){return colliders;},get lights(){return lights;},","    return {get meshes(){fresh();return meshes;},get colliders(){fresh();return colliders;},get lights(){fresh();return lights;},"],
  ["      rebuild();revision=options.exactRevision?value.revision:Math.max(revision+1,value.revision);return true;","      dirty=false;rebuild();revision=options.exactRevision?value.revision:Math.max(revision+1,value.revision);return true;"],
];
const A=loadFast({patches:{destruction:[count]},modules:['renderer','world','destruction']}),L=loadFast({patches:{destruction:lazy},modules:['renderer','world','destruction']});
for(const file of process.argv.slice(2)){
  const {summary,calls}=JSON.parse(readFileSync(new URL('./'+file,import.meta.url),'utf8'));const out=[];
  for(const [name,W] of [['immédiat',A],['paresseux',L]]){
    const world=W.FWorld.create(96,summary.index,{campaign:true,campaignVersion:2}),d=W.FDestruction.create(world);let rebuilds=0,revs=0,last=-1,h=2166136261,time=0;globalThis.__RB=()=>{rebuilds++;};
    const sync=()=>{const c=d.colliders,m=d.meshes;h=Math.imul(h^c.length,16777619);h=Math.imul(h^m.length,16777619);};   // ce que fait syncDestruction en fin de tir, une fois par pas
    for(const [step,src,point,power,r,direction,ignoreId] of calls){
      if(step!==last&&last>=0){const t=performance.now();sync();time+=performance.now()-t;}last=step;
      const t=performance.now(),res=r>0?d.blast(point,r,power,ignoreId??undefined):d.hit(point,power,direction??undefined);time+=performance.now()-t;if(res.changed)revs++;
    }
    sync();out.push({name,révisions:revs,reconstructions:rebuilds,étatFinal:fnv(JSON.stringify(d.snapshot())),colliders:fnv(JSON.stringify(d.colliders)),maillages:d.meshes.length,suiteDesTailles:(h>>>0).toString(16),msDestruction:+time.toFixed(1)});
  }
  console.log(file,JSON.stringify(out));
}
