// Lot 02 / T1 : A (avant), P (prototype bancs/sim/nav-local.mjs, référence du plan) et T (arbre T1)
// avancent en lockstep dans le même processus, domaine principal (chargeur du banc), ordre tournant
// à chaque pas parmi les six permutations ; première répétition écartée (chauffe).
// usage : METAL_ROOT=<racine-avant> STEPS=300 REPS=9 SCEN=legacy-s2,... LOAD=A,P,T node three-way.mjs [sortie.json]
import {writeFileSync} from 'node:fs';
import {loadFast} from '../../../bancs/sim/fast.mjs';
import {build,drive,makeInput,q} from '../../../bancs/sim/lib.mjs';
import {navLocalPatch} from '../../../bancs/sim/nav-local.mjs';
import {treeSimulation} from './tree-patch.mjs';
// LOAD fixe l'ordre de chargement (contrôle d'un biais de position) ; un suffixe 2 charge une seconde
// copie identique (contrôle A/A : P2/P ou T2/T mesure le bruit entre deux scripts de même source).
const make={A:()=>loadFast(),P:()=>loadFast({patches:typeof navLocalPatch==='function'?navLocalPatch():navLocalPatch}),T:()=>loadFast({patches:treeSimulation()})};
const V={};for(const k of (process.env.LOAD||'A,P,T').split(','))V[k]=make[k[0]]();
if(!V.A)throw new Error('LOAD doit contenir A');
const SC={'legacy-s0':[0,undefined],'legacy-s2':[2,undefined],'campaign-w10':[9,{campaign:true}],'campaign-w16':[15,{campaign:true}]};
const STEPS=+process.env.STEPS||300,REPS=+process.env.REPS||9,keys=Object.keys(V),perms=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]],rows=[];
if(keys.length!==3)throw new Error('trois variantes attendues');
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer),mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
const digest=(s,h)=>{h=mix(h,s.player.x);h=mix(h,s.player.z);h=mix(h,s.player.hp);h=mix(h,s.kills);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);}return h>>>0;};
for(const scen of (process.env.SCEN||'legacy-s0,legacy-s2,campaign-w10,campaign-w16').split(',')){
  const t=Object.fromEntries(keys.map(k=>[k,[]]));let identical=true;
  for(let r=0;r<REPS;r++){
    const runs={};for(const k of keys){const [i,o]=SC[scen];runs[k]={...build(V[k],i,o),input:makeInput(),h:2166136261};}
    for(let i=0;i<STEPS;i++){
      for(const k of keys)drive(i,runs[k].input,runs[k].sim.state);
      for(const j of perms[(i+r)%6]){const k=keys[j],x=runs[k],t0=performance.now();x.sim.step(1/60,x.input);const dt=performance.now()-t0;if(r>0)t[k].push(dt);}
      for(const k of keys){runs[k].h=digest(runs[k].sim.state,runs[k].h);runs[k].sim.state.events.length=0;}
      if(keys.some(k=>runs[k].h!==runs.A.h))identical=false;
      if(keys.some(k=>runs[k].sim.state.dead))break;
    }
  }
  const sum=a=>a.reduce((x,y)=>x+y,0),ratio=(b,a)=>q(t[b].map((v,i)=>v/t[a][i]).filter((v,i)=>t[a][i]>.05),.5);
  const [x,y,z]=keys,pairs=[[y,x],[z,x],[z,y]],fix=v=>+v.toFixed(3);
  const row={scenario:scen,steps:STEPS,measuredReps:REPS-1,load:keys,identical,totalMs:Object.fromEntries(keys.map(k=>[k,+sum(t[k]).toFixed(1)])),
    totalRatio:Object.fromEntries(pairs.map(([b,a])=>[b+'/'+a,fix(sum(t[b])/sum(t[a]))])),medianStepRatio:Object.fromEntries(pairs.map(([b,a])=>[b+'/'+a,fix(ratio(b,a))])),
    maxMs:Object.fromEntries(keys.map(k=>[k,+Math.max(...t[k]).toFixed(2)]))};
  rows.push(row);
  console.log(`${scen.padEnd(13)} ${STEPS} pas × ${REPS-1} | identique ${identical} | total ${keys.map(k=>k+' '+row.totalMs[k]).join(' ')} ms | ratios totaux ${pairs.map(([b,a])=>b+'/'+a+' '+row.totalRatio[b+'/'+a]).join(' ')} | médianes par pas ${pairs.map(([b,a])=>b+'/'+a+' '+row.medianStepRatio[b+'/'+a]).join(' ')} | max ${keys.map(k=>k+' '+row.maxMs[k]).join(' ')}`);
}
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({schema:'metal-lot02-t1-three-way-v1',clock:'performance.now par sim.step',rows},null,1)+'\n');
