// Nombre de groupes « blindés » par monde selon la définition retenue, et relief d'arrière-plan.
import {loadFast,worldList} from './lib.mjs';import {DEFS,classify} from './proto.mjs';
const W=loadFast();const rows=[];const cats={R1:{},R2only:{},R3only:{}};
for(const {label,index,opts} of worldList()){
  const w=W.FWorld.create(96,index,opts),n=d=>w.destructibles.filter(g=>DEFS[d](w,g)).length;
  const relief=w.destructibles.filter(g=>g.meshes.some(i=>['hill','cliff','cliff_stratum'].includes(w.meshes[i].category))).length;
  const solid=w.destructibles.filter(g=>g.colliders.length).length;
  for(const g of w.destructibles){const q=classify(w,g),k=g.kind+'|'+(q.cat||'mat'+q.mat);if(DEFS.R1(w,g))cats.R1[k]=(cats.R1[k]||0)+1;else if(DEFS.R2(w,g))cats.R2only[k]=(cats.R2only[k]||0)+1;else if(DEFS.R3(w,g))cats.R3only[k]=(cats.R3only[k]||0)+1;}
  rows.push({label,groups:w.destructibles.length,solid,R1:n('R1'),R2:n('R2'),R3:n('R3'),relief,doors:w.doors.length});
}
const rng=(k,f=r=>true)=>{const v=rows.filter(f).map(r=>r[k]);return Math.min(...v)+'..'+Math.max(...v);};
for(const [name,f] of [['campagne v2 (18)',r=>r.label.startsWith('v2')],['campagne v1 (18)',r=>r.label.startsWith('v1')],['historiques (3)',r=>r.label.startsWith('hist')]])
  console.log(name.padEnd(18),'groupes',rng('groups',f),'| avec collider',rng('solid',f),'| R1 murs',rng('R1',f),'| R2 structure',rng('R2',f),'| R3 +murets',rng('R3',f),'| relief',rng('relief',f),'| portes',rng('doors',f));
for(const r of rows.filter(r=>/v2-w0[123]|v1-w0[123]|hist/.test(r.label)))console.log('  ',r.label,JSON.stringify(r));
console.log('R1 :',JSON.stringify(cats.R1));console.log('R2 ajoute :',JSON.stringify(cats.R2only));console.log('R3 ajoute :',JSON.stringify(cats.R3only));
