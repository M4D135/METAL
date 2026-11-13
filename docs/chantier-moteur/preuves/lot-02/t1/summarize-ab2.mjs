// Lot 02 / T1 : résumé d'un rapport tools/ab2.mjs (sans les mesures par pas ni les chemins absolus).
// Les empreintes (chaîne FNV de tous les pas, SHA-256 du snapshot final) et la somme de contrôle
// du rapport complet suffisent à rejouer et comparer : elles ne dépendent que des sources.
// usage : node summarize-ab2.mjs <rapport.json> <résumé.json> [étiquette-a] [étiquette-b]
import {readFileSync,writeFileSync} from 'node:fs';
const [input,output,labelA='avant',labelB='après']=process.argv.slice(2);
if(!input||!output)throw new Error('usage: node summarize-ab2.mjs <rapport.json> <résumé.json> [étiquette-a] [étiquette-b]');
const report=JSON.parse(readFileSync(input,'utf8')),ms=us=>+(us/1000).toFixed(3);
const variant=(v,label)=>({label,sourceSha256:v.sourceSha256});
const top=(rows,key)=>rows.map(row=>row.counters[key]).sort((x,y)=>y-x).slice(0,5);
const summary={schema:'metal-lot02-t1-ab2-summary-v1',source:{schema:report.schema,checksum:report.checksum,identical:report.identical},
  environment:{node:report.environment.node,platform:report.environment.platform,arch:report.environment.arch,cpu:report.environment.cpu,logicalCpus:report.environment.logicalCpus,loadBefore:report.environment.loadAverage,loadAfter:report.environmentAfter?.loadAverage},
  method:report.method,variants:{a:variant(report.variants.a,labelA),b:variant(report.variants.b,labelB)},
  scenarios:report.scenarios.map(s=>({id:s.id,identical:s.identical,stableA:s.stableA,stableB:s.stableB,firstDifference:s.firstDifference,
    steps:[s.proofA.steps,s.proofB.steps],chainHash:[s.proofA.chainHash,s.proofB.chainHash],snapshotSha256:[s.proofA.snapshot.sha256,s.proofB.snapshot.sha256],
    timing:{totalMs:[ms(s.timing.a.totalUs),ms(s.timing.b.totalUs)],totalRatio:+s.timing.totalRatio.toFixed(4),medianPairedRatio:+s.timing.medianPairedRatio.toFixed(4),pairedSamples:s.timing.pairedSamples,
      meanMs:[ms(s.timing.a.meanUs),ms(s.timing.b.meanUs)],p99Ms:[ms(s.timing.a.p99Us),ms(s.timing.b.p99Us)],maxMs:[ms(s.timing.a.maxUs),ms(s.timing.b.maxUs)]},
    counters:s.counterReplay?{a:s.counterReplay.a.counters,b:s.counterReplay.b.counters,identical:s.counterReplay.identical}:null,
    // Pointes par pas du rejeu instrumenté : les cinq pires pas en segmentFree, et le pire pas en blocked.
    peaks:s.counterReplay?{segmentFreeTop5:[top(s.counterReplay.a.rows,'segmentFree'),top(s.counterReplay.b.rows,'segmentFree')],blockedMax:[top(s.counterReplay.a.rows,'blocked')[0],top(s.counterReplay.b.rows,'blocked')[0]]}:null}))};
writeFileSync(output,JSON.stringify(summary,null,1)+'\n');
for(const s of summary.scenarios)console.log(`${s.id.padEnd(14)} identique=${s.identical} première différence=${s.firstDifference} | CPU ${s.timing.totalMs[0].toFixed(0)} -> ${s.timing.totalMs[1].toFixed(0)} ms (ratio ${s.timing.totalRatio}) médiane appariée ${s.timing.medianPairedRatio} | blocked ${s.counters?.a.blocked} -> ${s.counters?.b.blocked} | segmentFree ${s.counters?.a.segmentFree} -> ${s.counters?.b.segmentFree} | ground ${s.counters?.a.ground} -> ${s.counters?.b.ground}`);
