// DRAW : structure des listes visibles (plages par cellule et par forme, candidats contre visibles) et partage des sommets.
// usage : node vis.mjs [monde=camp:17] [images=300]
import {scene,rep} from './h.mjs';
const [kind,idx]=(process.argv[2]||'camp:17').split(':'),frames=+(process.argv[3]||300);
const acc={n:0,shown:0,cand:0,pairs8:0,pairs16:0,pairs32:0,runs16:0,sun:0,sunN:0,lamp:0,lampN:0,torch:0,torchN:0,levels:[0,0,0],statTotal:0};
let geo=null;
const cell=(e,s)=>Math.floor(e.p[0]/s)+','+Math.floor(e.p[2]/s);
const hooks={
  geo(data,indices,ranges){geo={};for(const [name,r] of Object.entries(ranges)){const first=r.offset/2,set=new Set();for(let i=first;i<first+r.count;i++){const v=indices[i]*6;set.add(data.slice(v,v+6).join(','));}geo[name]={triangles:r.count/3,sommetsEmis:r.count,sommetsUniques:set.size};}},
  view(shown,q){acc.n++;acc.shown+=shown.length;acc.cand+=q.world.query(q.eye,q.ranges).length;acc.statTotal=q.world.entries.length;
    const p8=new Set(),p16=new Set(),p32=new Set();for(const e of shown){const s=e.mesh.shape||'box';p8.add(cell(e,8)+s);p16.add(cell(e,16)+s);p32.add(cell(e,32)+s);acc.levels[e.detail]++;}
    acc.pairs8+=p8.size;acc.pairs16+=p16.size;acc.pairs32+=p32.size;},
  sun(casters){acc.sun+=casters.length;acc.sunN++;},
  lamp(casters){acc.lamp+=casters.length;acc.lampN++;},
  torch(casters){acc.torch+=casters.length;acc.torchN++;}
};
const patch=c=>rep(c,"return {vertices:new Float32Array(data),indices:new Uint16Array(indices),ranges};","__H('geo',data,indices,ranges);return {vertices:new Float32Array(data),indices:new Uint16Array(indices),ranges};",'geo');
const S=scene({world:[kind,+idx],hooks,patch});
for(let i=0;i<60;i++)S.frame();
for(const k in acc)if(typeof acc[k]==='number')acc[k]=0;acc.levels=[0,0,0];
for(let i=0;i<frames;i++)S.frame();
const per=v=>+(v/acc.n).toFixed(1);
const shapes={};let all=0;for(const e of S.world.meshes){const s=e.shape||'box';shapes[s]=(shapes[s]||0)+1;all++;}
console.log(JSON.stringify({monde:kind+':'+idx,images:acc.n,statiquesDuMonde:all,formes:shapes,octetsLignesStatiques:all*64,
  vue:{candidatsDansLaPortee:per(acc.cand),visiblesApresChamp:per(acc.shown),rejetesParLeChamp:+(1-acc.shown/acc.cand).toFixed(3),parNiveauDeDetail:acc.levels.map(per),
    plagesCelluleForme:{c8:per(acc.pairs8),c16:per(acc.pairs16),c32:per(acc.pairs32)}},
  projeteurs:{soleil:+(acc.sun/Math.max(1,acc.sunN)).toFixed(1),lampe:+(acc.lamp/Math.max(1,acc.lampN)).toFixed(1),torche:+(acc.torch/Math.max(1,acc.torchN)).toFixed(1)},
  indicesParImage:{octetsUint16:Math.round((acc.shown+acc.sun+acc.torch)/acc.n*2),octetsLignes64:Math.round((acc.shown+acc.sun+acc.torch)/acc.n*64)},
  geometrie:geo},null,1));
