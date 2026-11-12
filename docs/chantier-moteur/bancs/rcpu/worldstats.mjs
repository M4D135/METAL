// RCPU: composition des mondes (niveaux de détail, formes, rayons) pour dimensionner les requêtes du rendu.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2];
const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld}=ctx.window;
const cases=[['legacy-0',0,undefined],['legacy-1',1,undefined],['legacy-2',2,undefined],['camp-0',0,{campaign:true}],['camp-5',5,{campaign:true}],['camp-9',9,{campaign:true}],['camp-15',15,{campaign:true}],['camp-17',17,{campaign:true}]];
for(const [label,idx,opts] of cases){
  const w=FWorld.create(96,idx,opts);
  const lv=[0,0,0],maxR=[0,0,0],shapes={},big=[];
  for(const m of w.meshes){const d=Math.max(0,Math.min(2,Math.floor(m.detail||0)));lv[d]++;const s=m.s||[1,1,1],r=Math.hypot(...s)*.5;maxR[d]=Math.max(maxR[d],r);shapes[m.shape||'box']=(shapes[m.shape||'box']||0)+1;big.push(r);}
  big.sort((a,b)=>b-a);
  const env=w.environment;
  console.log(label,JSON.stringify({meshes:w.meshes.length,levels:lv,maxRadius:maxR.map(v=>+v.toFixed(1)),r_top5:big.slice(0,5).map(v=>+v.toFixed(1)),r_p99:+big[Math.floor(big.length*.01)].toFixed(2),r_over20:big.filter(v=>v>20).length,shapes,lights:w.lights.length,env:!!env,outdoorZones:env?.outdoorZones?.length||0,longViewZones:env?.longViewZones?.length||0,ambience:(w.ambience||[]).length,machinery:(w.machinery||[]).length,enemies:w.enemies.length}));
}
