// RGPU: statistiques statiques des mondes (meshes, formes, détail, matériaux, lumières, environnement).
// Usage : node worldstats.mjs <racine-ferro>
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2];
const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld}=ctx.window;
const rows=[];
const cases=[...[0,1,2].map(i=>['legacy',i,undefined]),...Array.from({length:18},(_,i)=>['campaign',i,{campaign:true}])];
for(const [kind,idx,opts] of cases){
  const w=FWorld.create(96,idx,opts);
  const shapes={},detail=[0,0,0],mats={};let tris=0;
  for(const m of w.meshes){shapes[m.shape||'box']=(shapes[m.shape||'box']||0)+1;detail[Math.max(0,Math.min(2,Math.floor(m.detail||0)))]++;mats[m.mat||0]=(mats[m.mat||0]||0)+1;}
  const L=w.lights||[];const pw=L.map(l=>l.power===undefined?1:l.power).sort((a,b)=>a-b),rg=L.map(l=>l.range||0).sort((a,b)=>a-b);
  const env=w.environment;
  rows.push({kind,idx,biome:env?.biome||null,outdoor:!!env,outdoorZones:env?.outdoorZones?.length||0,longView:env?.longViewZones?.length||0,meshes:w.meshes.length,shapes,detail,mats,lights:L.length,
    powerMin:pw[0],powerMed:pw[pw.length>>1],powerMax:pw[pw.length-1],rangeZero:rg.filter(r=>!(r>0)).length,rangeMed:rg[rg.length>>1],rangeMax:rg[rg.length-1],
    lightsHigh:L.filter(l=>l.p[1]>=2.5).length,fogDensity:env?.fogDensity});
}
for(const r of rows)console.log(JSON.stringify(r));
