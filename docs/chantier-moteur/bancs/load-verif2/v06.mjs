// LOAD-06: worldgen3 vs original, main realm, alternated, identity on seeds NOT used by round 1.
import {loadFast,med,fnv,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const W0=loadFast({mods:['world']}),W1=loadFast({mods:['world'],patches:toMap(PATCHES.worldgen3)});
const seeds=process.argv[2].split(',').map(Number),worlds=process.argv[3].split(',');
let same=0,total=0;const rows=[];
for(const seed of seeds)for(const spec of worlds){
  const [k,i]=spec.split(':');const mk=W=>k==='c'?W.FWorld.create(seed,+i,{campaign:true,campaignVersion:2}):k==='v1'?W.FWorld.create(seed,+i,{campaign:true}):W.FWorld.create(seed,+i);
  const t=[[],[]];let h0,h1,meshes;
  for(let r=0;r<2;r++){for(const v of (r%2?[1,0]:[0,1])){const t0=performance.now();const w=mk(v?W1:W0);t[v].push(performance.now()-t0);const h=fnv(JSON.stringify(w));if(v)h1=h;else{h0=h;meshes=w.meshes.length;}}}
  total++;if(h0===h1)same++;rows.push({seed,spec,meshes,orig:+Math.min(...t[0]).toFixed(0),fix:+Math.min(...t[1]).toFixed(0),gain:Math.round(100*(1-Math.min(...t[1])/Math.min(...t[0])))+'%',same:h0===h1});
}
console.log(JSON.stringify({identical:same+'/'+total}));for(const r of rows)console.log(JSON.stringify(r));
