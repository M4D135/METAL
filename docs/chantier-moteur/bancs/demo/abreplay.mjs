// Banc DEMO — le rejeu comme banc de non-régression : une même session enregistrée (pilote, monde 7) est rejouée
// sur la simulation d'origine (A) et sur une simulation corrigée en mémoire (B, correctifs « exacts » du premier
// tour : bench/sim/full-v2.mjs). On compare l'empreinte d'état (égalité) et le temps CPU des pas (apparié, alterné).
// usage : node abreplay.mjs [secondes=120] [monde=6]
import {loadMain,q} from './load.mjs';import {runSession,W,plausibleLoadout,HZ} from './session.mjs';
import {fullPatch} from '../sim/full-v2.mjs';
const [sec='120',idx='6']=process.argv.slice(2);const startIndex=+idx,base={minutes:+sec/60,startIndex,startLoadout:plausibleLoadout(startIndex),digestEvery:60,memoryEveryS:1e9};
const WB=loadMain({patches:fullPatch()});
const rec=runSession({...base,record:true});
const runs={A:[],B:[]};
for(let r=0;r<2;r++)for(const k of (r?['B','A']:['A','B'])){const o=runSession({...base,replay:rec.record,W:k==='A'?W:WB});runs[k].push(o);}
const st=o=>{const a=o.stepMs,sum=a.reduce((x,y)=>x+y,0);return {total:+sum.toFixed(0),mean:+(sum/a.length).toFixed(3),p99:+q(a,.99).toFixed(2),max:+Math.max(...a).toFixed(1),over8:a.filter(v=>v>8).length};};
const firstDiv=(a,b)=>{for(let i=0;i<a.digests.length;i++)if(a.digests[i]!==b.digests[i])return (i+1)*60;return null;};
console.log(JSON.stringify({simSeconds:rec.steps/HZ,world:startIndex+1,recorded:{relays:rec.relays,mechanisms:rec.mechanisms,revisions:rec.destructionRevisions,deaths:rec.deaths,fired:rec.weaponsFired},
  A_equals_record:runs.A.every(o=>o.finalDigest===rec.finalDigest),B_equals_record:runs.B.every(o=>o.finalDigest===rec.finalDigest),B_firstDivergenceStep:firstDiv(rec,runs.B[0]),
  A:runs.A.map(st),B:runs.B.map(st),ratioTotal:+(runs.B.reduce((x,o)=>x+o.stepTotalMs,0)/runs.A.reduce((x,o)=>x+o.stepTotalMs,0)).toFixed(3)},null,1));
