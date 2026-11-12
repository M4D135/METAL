// Recensement des groupes destructibles par genre (kind), catégorie et matière sur les 39 mondes.
import {loadFast,worldList} from './lib.mjs';
const W=loadFast();const SEED=+process.env.SEED||96;
const tot={};const perWorld=[];
const catOf=(w,g)=>{const c=g.colliders.length?w.meshes[w.colliders[g.colliders[0]].mesh]:w.meshes[g.meshes[0]];return c.category||('(sans:mat'+c.mat+')');};
for(const {label,index,opts} of worldList()){
  const w=W.FWorld.create(SEED,index,opts);const row={label,meshes:w.meshes.length,colliders:w.colliders.length,groups:w.destructibles.length,kinds:{}};
  for(const g of w.destructibles){
    row.kinds[g.kind]=(row.kinds[g.kind]||0)+1;
    const key=g.kind+'|'+catOf(w,g)+'|s'+g.strength;const t=tot[key]||(tot[key]={n:0,worlds:new Set(),dims:[],meshCount:0});t.n++;t.worlds.add(label);t.meshCount+=g.meshes.length;
    if(g.colliders.length){const c=w.colliders[g.colliders[0]];t.dims.push([c.maxX-c.minX,c.maxY-c.minY,c.maxZ-c.minZ]);}
  }
  // meshes hors groupe (terrain, sol, indestructibles)
  const owned=new Set(w.destructibles.flatMap(g=>g.meshes));let free={terrain:0,ground:0,indestructible:0,other:0};
  w.meshes.forEach((m,i)=>{if(owned.has(i))return;if(m.indestructible)free.indestructible++;else if(m.terrain)free.terrain++;else if(m.ground)free.ground++;else free.other++;});
  row.free=free;row.unclaimedColliders=w.colliders.filter((c,i)=>!w.destructibles.some(g=>g.colliders.includes(i))).length;
  perWorld.push(row);
}
console.log('== par monde (seed '+SEED+') ==');
for(const r of perWorld)console.log(r.label.padEnd(9),'meshes',String(r.meshes).padStart(5),'colliders',String(r.colliders).padStart(4),'groupes',String(r.groups).padStart(4),JSON.stringify(r.kinds),'hors-groupe',JSON.stringify(r.free),'colliders non réclamés',r.unclaimedColliders);
console.log('\n== genre|catégorie|résistance : total, nb de mondes, dimensions min..max du collider (x,y,z) ==');
const rng=(a,k)=>{const v=a.map(d=>d[k]);return v.length?Math.min(...v).toFixed(2)+'..'+Math.max(...v).toFixed(2):'-';};
for(const [k,t] of Object.entries(tot).sort((a,b)=>a[0].localeCompare(b[0])))console.log(k.padEnd(46),String(t.n).padStart(6),'mondes',String(t.worlds.size).padStart(2),'meshes/groupe',(t.meshCount/t.n).toFixed(1).padStart(6),' x',rng(t.dims,0),' y',rng(t.dims,1),' z',rng(t.dims,2));
