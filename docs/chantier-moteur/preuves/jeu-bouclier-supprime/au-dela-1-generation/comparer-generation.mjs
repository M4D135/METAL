// Compare la génération avant/après : mêmes groupes destructibles, mêmes
// affectations de maillages, mêmes colliers, ramassages et ennemis.
// Usage : node comparer-generation.mjs <racine-avant> <racine-apres> [--seeds 96,7,1234] [--worlds 18]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const positional=args.filter((q,i)=>!q.startsWith('--')&&!args[i-1]?.startsWith('--'));
const [rootA,rootB]=positional;
if(!rootA||!rootB)throw new Error('deux racines sont requises');
const seeds=option('--seeds','96,7,1234').split(',').map(Number),count=Number(option('--worlds',18));
const A=loadRealm({root:rootA,realm:'main'}).window,B=loadRealm({root:rootB,realm:'main'}).window;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const shape=w=>({destructibles:sha(w.destructibles),trees:sha(w.trees.map(t=>[t.mesh,t.meshCount,t.destructibleId])),meshes:sha(w.meshes.map(m=>[m.shape,m.mat,m.p,m.s,m.r,m.destructibleId,m.region,m.category,m.assembly,m.detail,m.terrain,m.ground,m.indestructible])),colliders:sha(w.colliders),pickups:sha(w.pickups),enemies:sha(w.enemies.map(e=>[e.type,e.x,e.z,e.weapon,e.drop,e.trophyGuard]))});
let checked=0;const bad=[];
for(const seed of seeds)for(let index=0;index<count;index++)for(const options of [undefined,{campaign:true},{campaign:true,campaignVersion:2}]){
  const a=shape(A.FWorld.create(seed,index,options)),b=shape(B.FWorld.create(seed,index,options));
  checked++;
  for(const key of Object.keys(a))if(a[key]!==b[key])bad.push({seed,index,options:options??'classique',champ:key,avant:a[key].slice(0,12),apres:b[key].slice(0,12)});
}
console.log(JSON.stringify({mondes:checked,seeds,count,empreintes:{destructibles:'sha256',maillages:'sha256',colliers:'sha256',ramassages:'sha256',ennemis:'sha256',arbres:'sha256'},ecarts:bad,identique:bad.length===0},null,1));
