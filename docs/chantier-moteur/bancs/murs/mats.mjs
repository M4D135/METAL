import {loadFast} from './lib.mjs';
const W=loadFast();
for(const [label,index,opts] of [['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w02',1,{campaign:true,campaignVersion:2}],['v2-w03',2,{campaign:true,campaignVersion:2}]]){
  const w=W.FWorld.create(96,index,opts);const mats={},glass={};
  const owner=new Map();for(const g of w.destructibles)for(const i of g.meshes)owner.set(i,g);
  w.meshes.forEach((m,i)=>{mats[m.mat]=(mats[m.mat]||0)+1;if(m.mat===12||m.material==='glass'){const g=owner.get(i);const k=(g?g.kind:'hors-groupe')+'|'+(m.category||'sans');glass[k]=(glass[k]||0)+1;}});
  console.log(label,'matières',JSON.stringify(mats),'verre',JSON.stringify(glass));
  // portes, mécanismes, ascenseurs
  console.log('  portes',w.doors.map(d=>d.id+':'+d.requires+' '+d.w.toFixed(2)+'x'+d.h+'x'+d.d.toFixed(2)).join(' | '),' mécanismes',w.mechanisms.map(m=>m.id+':'+(m.kind||'')+':req='+!!m.required).join(' '),' ascenseurs',w.lifts.map(l=>l.id+':'+l.requires).join(' '));
  console.log('  validate',JSON.stringify(W.FWorld.validate(w)).slice(0,200));
}
