// Lot 01 suite / T5 — summary of the final proofs, computed from the files of this
// folder only (and checks/fmath.test.mjs for the names of the added tests).
//   node docs/chantier-moteur/preuves/lot-01s/final/resume.mjs [--out F]
// Tests: the TAP totals of npm test and, name by name, the 470 tests of the lot base
// (71eca61, on the Spark) against the final runs of the Mac and the Spark. Historic
// tests: the 8 golden tests before and after on each machine. Cost: FWorld.create,
// base 71eca61 against the final tree (tools/gen-ab.mjs), as in T2 and T3: per world,
// sqrt((B/A, base then final) / (B/A, final then base)), an estimate of final/base.
// Engines: what changes for players (ecarts-moteurs.mjs), per machine and engine.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),outFile=args.includes('--out')?args[args.indexOf('--out')+1]:join(here,'resume.json');
const read=name=>{const data=readFileSync(join(here,name));return (name.endsWith('.gz')?gunzipSync(data):data).toString('utf8');};
const json=name=>JSON.parse(read(name));

function tap(text){
  const tests=[],totals={};
  for(const line of text.split('\n')){
    const m=/^(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/.exec(line);
    if(m)tests.push({name:m[2],ok:m[1]==='ok',directive:m[3]??null});
    const t=/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) ([\d.]+)$/.exec(line);
    if(t)totals[t[1]]=Number(t[2]);
  }
  const build=/\{\s*"status": "(\w+)",\s*"html_bytes": (\d+),\s*"external_assets": (\d+),\s*"sha256": "([0-9a-f]{64})"\s*\}\s*$/.exec(text);
  return {totals,tests,buildTest:build?{status:build[1],htmlBytes:Number(build[2]),externalAssets:Number(build[3]),sha256:build[4]}:null};
}
const logs={base:tap(read('npm-test-spark-avant-71eca61.log.gz')),mac:tap(read('npm-test-mac.log.gz')),spark:tap(read('npm-test-spark.log.gz'))};
const fmathSource=readFileSync(join(root,'checks/fmath.test.mjs'),'utf8');
const baseNames=new Set(logs.base.tests.map(t=>t.name));
if(baseNames.size!==logs.base.tests.length)throw new Error('duplicate test names in the base log');
function versusBase(run){
  const byName=new Map(run.tests.map(t=>[t.name,t]));
  const missing=[...baseNames].filter(n=>!byName.has(n)),notOk=[...baseNames].filter(n=>byName.has(n)&&!byName.get(n).ok);
  const added=run.tests.filter(t=>!baseNames.has(t.name));
  return {totals:run.totals,buildTest:run.buildTest,baseTestsPresent:baseNames.size-missing.length,baseTestsPassing:baseNames.size-missing.length-notOk.length,missing,notOk,
    historicPassing:logs.base.tests.filter(t=>!t.ok).filter(t=>byName.get(t.name)?.ok).length,
    added:added.length,addedPassing:added.filter(t=>t.ok).length,addedAllInFmathTest:added.every(t=>fmathSource.includes(`test('${t.name}'`)),addedNames:added.map(t=>t.name),
    directives:run.tests.filter(t=>t.directive).length};
}
const tests={base71eca61Spark:{totals:logs.base.totals,buildTest:logs.base.buildTest,failing:logs.base.tests.filter(t=>!t.ok).map(t=>t.name)},
  mac:versusBase(logs.mac),spark:versusBase(logs.spark),
  note:'baseTestsPassing: tests of the lot base (71eca61, npm test on the Spark) passing under the same name in the final run; historicPassing: those failing at the base (the 8 historic tests) passing now; added: tests absent from the base, all in checks/fmath.test.mjs. checks/build.test.mjs runs after the TAP suite (&&): buildTest is its JSON line, absent when the suite fails.'};

const historic={};
for(const m of ['mac','spark']){
  const before=tap(read(m+'/historiques-avant-71eca61.tap')),after=tap(read(m+'/historiques.tap'));
  historic[m]={before:{pass:before.totals.pass,tests:before.totals.tests},after:{pass:after.totals.pass,tests:after.totals.tests},sameNames:before.tests.map(t=>t.name).join('\n')===after.tests.map(t=>t.name).join('\n')};
}

const round=(x,n=3)=>Number(x.toFixed(n));
function cost(m){
  const aa=json(m+'/gen-ab-aa.json'),series=[['gen-ab-base-final.json','gen-ab-final-base.json'],['gen-ab-base-final-2.json','gen-ab-final-base-2.json']].map(([bf,fb])=>[json(m+'/'+bf),json(m+'/'+fb)]);
  const specs=aa.rows.map(r=>r.spec),all=[aa,...series.flat()];
  const rows=specs.map(spec=>{
    const get=(report,key)=>report.rows.find(r=>r.spec===spec)[key];
    const estimates=series.map(([bf,fb])=>round(Math.sqrt(get(bf,'ratioBA')/get(fb,'ratioBA'))));
    return {spec,cpuMsBase:get(series[0][0],'cpuMs').a,cpuMsFinal:get(series[0][0],'cpuMs').b,finalOverBase:estimates,
      rawBaseThenFinal:series.map(([bf])=>get(bf,'ratioBA')),rawFinalThenBaseInverted:series.map(([,fb])=>round(1/get(fb,'ratioBA')))};
  });
  const flat=rows.flatMap(r=>r.finalOverBase),raw=rows.flatMap(r=>[...r.rawBaseThenFinal,...r.rawFinalThenBaseInverted]);
  return {environment:{...aa.environment,loadAverage:undefined},loadAverages:all.map(r=>r.environment.loadAverage.map(x=>round(x,2))),reps:aa.method.reps,warm:aa.method.warm,realm:aa.method.realm,clock:aa.method.clock,
    aaControl:{ratioBA:[Math.min(...aa.rows.map(r=>r.ratioBA)),Math.max(...aa.rows.map(r=>r.ratioBA))],ratioAAAllFiles:[Math.min(...all.flatMap(r=>r.rows.map(x=>x.ratioAA))),Math.max(...all.flatMap(r=>r.rows.map(x=>x.ratioAA)))]},
    rows,finalOverBase:[Math.min(...flat),Math.max(...flat)],leastFavourableRaw:Math.max(...raw),
    sources:{base:all[1].sourceSha256.a,final:all[1].sourceSha256.b}};
}
const costs={mac:cost('mac'),spark:cost('spark'),note:'finalOverBase: per world and per series, sqrt((B/A, base then final)/(B/A, final then base)); below 1 the final tree is faster. leastFavourableRaw: the largest of the raw ratios final/base of the two orientations. aaControl: the noise of the same runs (B/A of base against base, and the second load A\'/A of every file).'};

const engines={};
for(const m of ['mac','spark']){
  const e=json(m+'/ecarts-moteurs.json');engines[m]={environment:e.environment,cases:e.cases};
  for(const name of ['node','chrome','jsc']){
    const x=e[name];if(x.skipped){engines[m][name]={skipped:x.skipped};continue;}
    const pick=s=>({worldJsonChanged:s.worldJsonChanged+'/'+s.worlds,numericDifferencesPerChangedWorld:s.numericDifferencesPerChangedWorld,maxAbsByGroup:s.maxAbsByGroup,maxAbsOtherFields:Object.fromEntries(Object.entries(s.otherFields).map(([k,v])=>[k,v.maxAbs])),
      maxAbsDifference:s.maxAbsDifference,structuralDifferences:s.structuralDifferences,checkpointRefused:s.checkpointRefused,...(s.afterEqualsNode?{afterEqualsNode:s.afterEqualsNode}:{})});
    engines[m][name]={...(x.userAgent?{userAgent:x.userAgent}:{}),pageErrors:x.pageErrors??null,error:x.error??null,all:pick(x.all),worlds42:pick(x.t1t2Worlds42)};
  }
}
{ // the same comparison, machine against machine
  const rows=(m,name)=>new Map(json(m+'/ecarts-moteurs.json')[name].rows.map(r=>[r.world,r]));
  const cross=name=>{const a=rows('mac',name),b=rows('spark',name),same=key=>[...a.keys()].filter(k=>a.get(k)[key]===b.get(k)?.[key]).length+'/'+a.size;
    return {fingerprintBefore:same('fingerprintBefore'),fingerprintAfter:same('fingerprintAfter'),worldFnvAfter:same('fnvAfter'),refusedOnlyOnMac:[...a.keys()].filter(k=>a.get(k).fingerprintBefore!==a.get(k).fingerprintAfter&&b.get(k).fingerprintBefore===b.get(k).fingerprintAfter),refusedOnlyOnSpark:[...a.keys()].filter(k=>a.get(k).fingerprintBefore===a.get(k).fingerprintAfter&&b.get(k).fingerprintBefore!==b.get(k).fingerprintAfter)};};
  engines.macVersusSpark={node:cross('node'),chrome:cross('chrome')};
}

const out={schema:'metal-lot01s-final-summary-v1',tests,historic,costs,engines};
writeFileSync(outFile,JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({tests:{base:tests.base71eca61Spark.totals,mac:{...tests.mac.totals,basePassing:tests.mac.baseTestsPassing,added:tests.mac.added,build:tests.mac.buildTest?.status},spark:{...tests.spark.totals,basePassing:tests.spark.baseTestsPassing,added:tests.spark.added,build:tests.spark.buildTest?.status}},historic,
  cost:{mac:costs.mac.finalOverBase,macLeast:costs.mac.leastFavourableRaw,macAA:costs.mac.aaControl,spark:costs.spark.finalOverBase,sparkLeast:costs.spark.leastFavourableRaw,sparkAA:costs.spark.aaControl},macVersusSpark:engines.macVersusSpark},null,1));
