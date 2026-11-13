// Lot 02 / T6, T7, T10, T11, T16 : résumé d'un rapport tools/ab2 (schéma metal-ab2-v1).
// Le rapport complet pèse des dizaines de Mo : seul ce résumé est versé. Pour chaque
// scénario, ratio B/A du CPU total de chaque passage mesuré (chauffe exclue), puis leur
// médiane ; et le ratio de tous les pas appariés (medianPairedRatio).
// usage : node resume-ab2.mjs <rapport ab2.json> [sortie.json]
import {readFileSync,writeFileSync} from 'node:fs';

const j=JSON.parse(readFileSync(process.argv[2],'utf8')),r=x=>+x.toFixed(4);
const med=a=>{const s=a.slice().sort((p,q)=>p-q),n=s.length;return n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2;};
const scenarios=j.scenarios.map(s=>{
  const passes=s.passes.filter(p=>!p.excludedWarmup),ratios=passes.map(p=>p.b.cpu.totalUs/p.a.cpu.totalUs);
  return {id:s.id,identical:s.identical,stableA:s.stableA,stableB:s.stableB,
    chain:[s.proofA.chainHash,s.proofB.chainHash],
    snapshot:[s.proofA.snapshot.sha256,s.proofB.snapshot.sha256],
    passes:passes.length,
    totalUs:[passes.reduce((n,p)=>n+p.a.cpu.totalUs,0),passes.reduce((n,p)=>n+p.b.cpu.totalUs,0)],
    passRatios:ratios.map(r),medianPassRatio:r(med(ratios)),
    totalRatio:r(s.timing.totalRatio),medianPairedRatio:r(s.timing.medianPairedRatio)};
});
const summary={schema:'lot02-t6-t16-resume-v1',checksum:j.checksum,identical:j.identical,environment:j.environment,
  method:{steps:j.method.requestedSteps,warmups:j.method.warmupPasses,reps:j.method.measuredPasses,weapon:j.method.weapon,seed:j.method.seed},
  sourceSha256:{a:j.variants.a.sourceSha256.simulation,b:j.variants.b.sourceSha256.simulation},
  medianOfMedianPassRatios:r(med(scenarios.map(s=>s.medianPassRatio))),scenarios};
const text=JSON.stringify(summary,null,1);
if(process.argv[3])writeFileSync(process.argv[3],text+'\n');else console.log(text);
