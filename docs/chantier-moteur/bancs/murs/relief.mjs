// Que fait UNE balle de pistolet (hit 2) sur une colline ou une falaise d'arrière-plan ?
import {loadFast} from './lib.mjs';
const W=loadFast();
for(const [label,index] of [['v2-w01 (collines)',0],['v2-w02 (falaises)',1]]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2}),d=W.FDestruction.create(w);
  const cats=['hill','cliff','cliff_stratum','retaining_rock','boulder'];
  for(const cat of cats){
    const idx=w.meshes.findIndex(m=>m.category===cat);if(idx<0)continue;const m=w.meshes[idx],g=w.destructibles.find(g=>g.meshes.includes(idx));
    const all=w.meshes.filter(q=>q.category===cat).length;
    // tir horizontal vers le centre du maillage
    const origin=[m.p[0]-12,m.p[1]+.3,m.p[2]],dir=[1,0,0],ray=d.raycast(origin,dir,30);
    if(!ray||ray.id!==g.id){console.log(label,cat,'rayon: touche',ray?.id,'au lieu de',g.id);continue;}
    const before=d.meshes.length,res=d.hit(Array.from(ray.point),2,dir),big=res.debris.filter(q=>q.structural).map(q=>q.size.map(v=>+v.toFixed(1)).join('×')+' '+q.shape);
    console.log(label,'|',cat,'('+all+' dans le monde) taille',m.s.map(v=>+v.toFixed(1)).join('×'),'forme',m.shape,'| groupe',g.kind,'résistance',g.strength,'maillages',g.meshes.length,'| 1 balle → changed',res.changed,'effondré',res.collapsed.length,'maillages',before,'→',d.meshes.length,'| gravats structurels :',big.slice(0,4).join(' ; '));
  }
}
