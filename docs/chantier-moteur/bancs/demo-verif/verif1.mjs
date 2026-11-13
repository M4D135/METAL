// Contre-vérification DEMO : (a) égalité d'état complète (snapshot JSON) A contre B (full-v2), pas seulement l'empreinte FNV ;
// (b) snapshot() est-il neutre ? rejeu avec des snapshot() supplémentaires tous les N pas ; (c) rejeu avec dt variable.
import {loadMain,q} from '../demo/load.mjs';import {runSession,W,plausibleLoadout,HZ} from '../demo/session.mjs';
import {fullPatch} from '../sim/full-v2.mjs';
const [sec='60',idx='6']=process.argv.slice(2);const startIndex=+idx,base={minutes:+sec/60,startIndex,startLoadout:startIndex>0?plausibleLoadout(startIndex):null,digestEvery:60,memoryEveryS:1e9};
const WB=loadMain({patches:fullPatch()});
const rec=runSession({...base,record:true});
const last=rec.steps-1;
const strip=o=>JSON.stringify(o,(k,v)=>k==='aiStats'?undefined:v);
const cap=(Wx,extra)=>{let snap=null,stateJson=null;const o=runSession({...base,replay:rec.record,W:Wx,onStep:(step,s,sim)=>{if(extra&&step%extra===extra-1&&!s.dead&&!s.won)sim.snapshot();if(step===last){stateJson=strip(s);snap=strip(sim.snapshot());}}});return {o,snap,stateJson};};
const firstDiv=(a,b)=>{for(let i=0;i<Math.min(a.digests.length,b.digests.length);i++)if(a.digests[i]!==b.digests[i])return (i+1)*60;return null;};
const st=o=>{const a=o.stepMs,sum=a.reduce((x,y)=>x+y,0);return {total:+sum.toFixed(0),mean:+(sum/a.length).toFixed(3),p99:+q(a,.99).toFixed(2),max:+Math.max(...a).toFixed(1),over8:a.filter(v=>v>8).length};};
const A1=cap(W),B1=cap(WB),B2=cap(WB),A2=cap(W);
const X=cap(W,50),X2=cap(W,7);
const diffKeys=(a,b)=>{const ja=JSON.parse(a),jb=JSON.parse(b);return Object.keys({...ja,...jb}).filter(k=>JSON.stringify(ja[k])!==JSON.stringify(jb[k]));};
console.log(JSON.stringify({simSeconds:rec.steps/HZ,world:startIndex+1,recorded:{relays:rec.relays,mechanisms:rec.mechanisms,revisions:rec.destructionRevisions,deaths:rec.deaths,fired:rec.weaponsFired,checkpoints:rec.checkpointMs.length,assistHp:+rec.assistHp.toFixed(1)},
 A_digest_equals_record:A1.o.finalDigest===rec.finalDigest,B_digest_equals_record:B1.o.finalDigest===rec.finalDigest,
 fullState_A_equals_B:A1.stateJson===B1.stateJson,fullSnapshot_A_equals_B:A1.snap===B1.snap,stateBytes:A1.stateJson.length,snapBytes:A1.snap.length,
 stateDiffKeys:A1.stateJson===B1.stateJson?[]:diffKeys(A1.stateJson,B1.stateJson),snapDiffKeys:A1.snap===B1.snap?[]:diffKeys(A1.snap,B1.snap),
 A:[st(A1.o),st(A2.o)],B:[st(B1.o),st(B2.o)],ratio:+((B1.o.stepTotalMs+B2.o.stepTotalMs)/(A1.o.stepTotalMs+A2.o.stepTotalMs)).toFixed(3),
 extraSnapshotEvery50:{digestEqual:X.o.finalDigest===rec.finalDigest,firstDivergenceStep:firstDiv(rec,X.o),fullStateEqual:X.stateJson===A1.stateJson},
 extraSnapshotEvery7:{digestEqual:X2.o.finalDigest===rec.finalDigest,firstDivergenceStep:firstDiv(rec,X2.o),fullStateEqual:X2.stateJson===A1.stateJson}},null,1));
