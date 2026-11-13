// STAB : composition des 21 mondes (18 campagne v2 + 3 historiques) pour choisir les mondes du recensement.
// node worldscan.mjs <racine METAL>   (domaine principal, lecture seule)
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root=process.argv[2];globalThis.window=globalThis;
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInThisContext(readFileSync(root+'/src/'+n+'.js','utf8'),{filename:n+'.js'});
const cases=[];for(let i=0;i<18;i++)cases.push(['c'+i,i,{campaign:true,campaignVersion:2}]);for(let i=0;i<3;i++)cases.push(['l'+i,i,undefined]);
for(const [label,idx,opts] of cases){
  const t=performance.now();const w=FWorld.create(96,idx,opts);const ms=performance.now()-t;
  const shapes={};let foliage=0,wind=0;
  for(const m of w.meshes){shapes[m.shape||'box']=(shapes[m.shape||'box']||0)+1;if(m.foliage||/leaf|foliage|canopy|tree|bush|grass|frond/.test(String(m.shape)+String(m.mat)+String(m.kind||'')))foliage++;if(m.wind)wind++;}
  const env=w.environment||{};
  console.log(label,JSON.stringify({genMs:+ms.toFixed(0),title:w.title,biome:env.biome,meshes:w.meshes.length,foliage,wind,trees:(w.trees||w.vegetation||[]).length,lights:w.lights.length,enemies:w.enemies.length,boss:w.enemies.filter(e=>e.type===3).length,arena:!!w.bossArena,encounters:(w.encounters||[]).length,machinery:(w.machinery||[]).length,outdoor:env.outdoorZones?.length||0,size:w.size||w.bounds,shapes:Object.entries(shapes).sort((a,b)=>b[1]-a[1]).slice(0,8)}));
}
