// Lot 01 suite / T1 — environment capture, cross-machine comparison and manifest.
//
//   node docs/chantier-moteur/preuves/lot-01s/t1/summarize.mjs env --cc clang|gcc --chrome PATH --out FILE
//       records Node, V8, the OS, the CPU, the C compiler, Chrome and the SHA-256
//       of the measured sources on this machine (run on each machine).
//   node docs/chantier-moteur/preuves/lot-01s/t1/summarize.mjs
//       reads mac/ and spark/ next to this script, writes summary.json (every
//       figure of PROOF.md, and the Mac/Spark comparisons computed from the
//       outputs) and manifest.json (size and SHA-256 of every file, commands,
//       environments). Nothing is measured again.
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import os from 'node:os';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..'),P='docs/chantier-moteur/preuves/lot-01s/t1';
const sha=data=>createHash('sha256').update(data).digest('hex');
const SOURCES=['src/fmath.js','src/world.js','src/renderer.js','src/destruction.js','src/economy.js','src/brain.js','src/simulation.js',
  'tools/platform-math.mjs','tools/realm-loader.mjs','tools/profile-steps.mjs','tools/proof/common.mjs','tools/proof/digest.mjs','tools/proof/instrument.mjs','tools/proof/scenarios.mjs','tools/proof/reference-63668ac.json',
  'tools/campaign-profiles.mjs','tools/campaign-balance.mjs','tools/boss-profiles.mjs',
  'checks/fmath.test.mjs','checks/fmath-vectors.txt','checks/campaign-world.test.mjs','package.json',
  `${P}/fdlibm-v8.c`,`${P}/gen-vectors.mjs`,`${P}/branch-coverage.mjs`,`${P}/mutation-check.mjs`,`${P}/profiles-check.mjs`,`${P}/mac-divergent-inputs.json`];

function environment(cc,chrome){
  const sh=(cmd,args)=>{try{return execFileSync(cmd,args,{stdio:['ignore','pipe','ignore'],env:{...process.env,LC_ALL:'C'}}).toString().trim();}catch{return null;}};
  let cpu=sh('sysctl',['-n','machdep.cpu.brand_string']);
  if(!cpu){const text=sh('lscpu',[]),names=text?[...new Set([...text.matchAll(/^Model name:\s*(.+)$/gm)].map(m=>m[1].trim()))]:[];cpu=names.join(' + ')||os.cpus()[0]?.model||null;}
  const jsc='/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';
  return {schema:'metal-lot01s-t1-environment-v1',node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,osRelease:os.release(),cpu,logicalCpus:os.cpus().length,
    compiler:(sh(cc,['--version'])||'').split('\n')[0]||null,chrome:chrome?sh(chrome,['--version']):null,jsc:existsSync(jsc)?jsc:null,
    sources:Object.fromEntries(SOURCES.map(f=>{const data=readFileSync(join(root,f));return [f,{bytes:data.length,sha256:sha(data)}];}))};
}

const args=process.argv.slice(2);
if(args[0]==='env'){
  const flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  const text=JSON.stringify(environment(flag('--cc')||'clang',flag('--chrome')),null,1)+'\n';
  if(flag('--out'))writeFileSync(flag('--out'),text);else process.stdout.write(text);
  process.exit(0);
}

const read=(machine,file)=>JSON.parse(readFileSync(join(here,machine,file),'utf8'));
const machines=['mac','spark'],M=Object.fromEntries(machines.map(m=>[m,{
  env:read(m,'environment.json'),golden:read(m,'golden.json'),census:read(m,'census.json'),checkpoints:read(m,'checkpoints.json'),
  replay:{native:read(m,'replay-native.json'),fmath:read(m,'replay-fmath.json'),v2Native:read(m,'replay-v2-native.json'),v2FMath:read(m,'replay-v2-fmath.json')},
  engines:read(m,'engines.json'),vectors:read(m,m==='mac'?'vectors-clang.json':'vectors-gcc.json'),exhaustive:{fmath:read(m,'exhaustive-fmath.json'),host:read(m,'exhaustive-host.json')},
  sweep:read(m,'sweep.json'),coverage:read(m,'branch-coverage.json'),mutation:read(m,'mutation-check.json'),profiles:read(m,'profiles.json')}]));
const frac=(a,b)=>`${a}/${b}`;
const count=(list,pred)=>list.filter(pred).length;
function npm(file){
  const text=gunzipSync(readFileSync(join(here,file))).toString(),num=key=>Number((new RegExp('^# '+key+' (\\d+)$','m').exec(text)||[])[1]);
  return {log:file,tests:num('tests'),pass:num('pass'),fail:num('fail'),notOk:[...text.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1])};
}

// World JSON digests (SHA-256 of JSON.stringify): six legacy worlds and 108 campaign worlds.
function worldDigests(g){
  const out=[];
  g.host.rows.slice(0,6).forEach((r,i)=>out.push({key:'legacy:'+r.test.match(/seed (\d+), sector (\d+)/).slice(1).join(':'),host:r.digest,fmath:g.fmath.rows[i].digest}));
  for(const kind of ['v1','v2'])for(const d of g.campaign[kind].digests)out.push({key:`${kind}:${d.seed}:${d.index+1}`,host:d.host,fmath:d.fmath});
  return out;
}
function pair(a,b,field){const keys=a.map(x=>x.key),same=keys.filter((k,i)=>a[i][field]===b[i][field]);if(a.length!==b.length||a.some((x,i)=>x.key!==b[i].key))throw new Error('world lists differ');return {equal:frac(same.length,keys.length),differing:keys.filter((k,i)=>a[i][field]!==b[i][field])};}
const cpRows=m=>M[m].checkpoints.rows.map(r=>({key:`${r.kind}:${r.seed}:${r.kind==='legacy'?'s'+r.index:'w'+(r.index+1)}`,host:r.checkpointFingerprintHost,fmath:r.checkpointFingerprintFMath}));
const chromeRows=m=>M[m].engines.chrome.checkpoints.perWorld.map(r=>({key:`${r.kind}:${r.seed}:${r.kind==='legacy'?'s'+r.index:'w'+(r.index+1)}`,...r}));
const chain=r=>Object.fromEntries(r.rows.map(x=>[x.id,x.chainHash]));
const trigFns=['sin','cos','atan','atan2'];

const summary={schema:'metal-lot01s-t1-summary-v1',
  machines:Object.fromEntries(machines.map(m=>{const e=M[m].env;return [m,{node:e.node,v8:e.v8,platform:e.platform,arch:e.arch,osRelease:e.osRelease,cpu:e.cpu,logicalCpus:e.logicalCpus,compiler:e.compiler,chrome:e.chrome,jsc:e.jsc}];})),
  sameSourcesOnBothMachines:JSON.stringify(M.mac.env.sources)===JSON.stringify(M.spark.env.sources),
  goldenTests:Object.fromEntries(machines.map(m=>{const g=M[m].golden;return [m,{host:frac(g.host.passed,g.host.of),fmath:frac(g.fmath.passed,g.fmath.of),
    patternsByPortedSubset:Object.fromEntries(g.subsets.map(s=>[s.ported.join('+'),s.pattern])),campaignWorldsChangedByFMath:{v1:frac(g.campaign.v1.changedByFMath,g.campaign.v1.worlds),v2:frac(g.campaign.v2.changedByFMath,g.campaign.v2.worlds)}}];})),
  census:Object.fromEntries(machines.map(m=>{const c=M[m].census;return [m,{worlds:c.worlds,largeArgumentCalls:c.largeArgumentCalls,hypotCalls:c.total.hypot.calls,
    divergent:Object.fromEntries(trigFns.map(f=>[f,{divergent:c.total[f].divergent,calls:c.total[f].calls,maxAbsArg:c.total[f].maxAbsArg}])),worldsWithDivergence:c.worldsWithDivergence}];})),
  checkpoints:Object.fromEntries(machines.map(m=>{const k=M[m].checkpoints;return [m,{summary:k.summary,differingTopLevelFields:k.differingTopLevelFields,maxAbsDifference:k.maxAbsDifference,numericDifferencesPerChangedWorld:k.numericDifferencesPerChangedWorld,structuralDifferences:k.structuralDifferences,
    maxAbsByField:Object.fromEntries(Object.entries(k.differencesByField).map(([f,v])=>[f,v.maxAbs]))}];})),
  replay:Object.fromEntries(machines.map(m=>{const r=M[m].replay,row=x=>({chainHash:x.chainHash,oracleChainHash:x.oracleChainHash,identical:x.identical,firstDivergentStepNumber:x.firstDivergentStepNumber});
    return [m,{native:{checksum:r.native.checksum,driverFirstDivergentIndex:r.native.driver.firstIndex,scenarios:Object.fromEntries(r.native.rows.map(x=>[x.id,row(x)]))},fmath:{checksum:r.fmath.checksum,scenarios:Object.fromEntries(r.fmath.rows.map(x=>[x.id,row(x)]))},
      v2ShortNative:Object.fromEntries(r.v2Native.rows.map(x=>[x.id,row(x)])),v2ShortFMath:Object.fromEntries(r.v2FMath.rows.map(x=>[x.id,row(x)]))}];})),
  witness:Object.fromEntries(machines.map(m=>{const x=M[m];return [m,{compiler:x.vectors.compiler,
    vectors:{identicalToExisting:x.vectors.table.identicalToExisting,lines:x.vectors.table.lines,all:x.vectors.all,rem:x.vectors.rem,extraModes:x.vectors.extraModes},
    exhaustive:Object.fromEntries(['fmath','host'].map(p=>[p,{distinctInputs:x.exhaustive[p].distinctInputs,byFunction:x.exhaustive[p].res,total:x.exhaustive[p].total}])),
    sweep:{seed:x.sweep.seed,countPerFunction:x.sweep.countPerFunction,total:x.sweep.total}}];})),
  engines:Object.fromEntries(machines.map(m=>{const e=M[m].engines,c=e.chrome;return [m,{chrome:{userAgent:c.userAgent,fmathVectors:frac(c.fmathVectors.equal,c.fmathVectors.cases),
    correctlyRounded:Object.fromEntries(Object.entries(c.trig).map(([k,v])=>[k,{chrome:frac(v.chromeCorrectlyRounded||0,v.withReference||0),nodeHost:frac(v.nodeHostCorrectlyRounded||0,v.withReference||0),fmath:frac(v.fmathCorrectlyRounded||0,v.withReference||0),chromeEqFMath:frac(v.chromeEqFMath,v.cases),chromeEqNodeHost:frac(v.chromeEqNodeHost,v.cases),undecided:v.undecided||0}])),
    checkpoints:Object.fromEntries(Object.entries(c.checkpoints).filter(([k])=>k!=='perWorld'&&k!=='note'))},
    jsc:e.jsc.skipped?{skipped:e.jsc.skipped}:{fmathVectors:frac(e.jsc.fmathVectors.equal,e.jsc.fmathVectors.cases),worlds:e.jsc.worlds,jscNativeEqNodeHost:e.jsc.jscNativeEqNodeHost,jscFMathEqNodeFMath:e.jsc.jscFMathEqNodeFMath,jscNativeV8HypotEqNodeHost:e.jsc.jscNativeV8HypotEqNodeHost,jscFMathV8HypotEqNodeFMath:e.jsc.jscFMathV8HypotEqNodeFMath}}];})),
  crossMachine:(()=>{
    const wm=worldDigests(M.mac.golden),ws=worldDigests(M.spark.golden),cm=cpRows('mac'),cs=cpRows('spark'),hm=chromeRows('mac'),hs=chromeRows('spark');
    return {
      note:'Mac = Node 24.18 darwin-arm64 (V8 compiled by clang with contraction); Spark = Node 24.18 linux-arm64 (V8 compiled by gcc with contraction). Computed from the outputs only.',
      worldJsonSha256:{fmath:pair(wm,ws,'fmath'),host:pair(wm,ws,'host')},
      checkpointFingerprint:{fmath:pair(cm,cs,'fmath'),host:pair(cm,cs,'host')},
      chrome:{nativeFingerprint:pair(hm,hs,'chromeNative'),nativeWorldFnv:pair(hm,hs,'chromeNativeWorldFnv'),fmathFingerprint:pair(hm,hs,'chromeFMath'),fmathWorldFnv:pair(hm,hs,'chromeFMathWorldFnv')},
      replayChainHashes:{fmathEqual:JSON.stringify(chain(M.mac.replay.fmath))===JSON.stringify(chain(M.spark.replay.fmath)),nativeEqual:JSON.stringify(chain(M.mac.replay.native))===JSON.stringify(chain(M.spark.replay.native)),
        v2ShortFMathEqual:JSON.stringify(chain(M.mac.replay.v2FMath))===JSON.stringify(chain(M.spark.replay.v2FMath)),v2ShortNativeEqual:JSON.stringify(chain(M.mac.replay.v2Native))===JSON.stringify(chain(M.spark.replay.v2Native))},
      censusDivergent:Object.fromEntries(trigFns.map(f=>[f,{mac:M.mac.census.total[f].divergent,spark:M.spark.census.total[f].divergent}])),
      // Result digests of gen-vectors.mjs (sorted inputs): equal inputs, then which columns agree.
      witnessResults:Object.fromEntries([['exhaustiveFMathPath',m=>M[m].exhaustive.fmath.digests],['exhaustiveHostPath',m=>M[m].exhaustive.host.digests],['sweep',m=>M[m].sweep.digests]].map(([name,get])=>{
        const a=get('mac'),b=get('spark');
        return [name,Object.fromEntries(trigFns.map(f=>[f,Object.fromEntries(Object.keys(a[f]).map(k=>[k+'Equal',a[f][k]===b[f][k]]))]))];
      })),
    };
  })(),
  fmathQuality:(()=>{const m=M.mac.mutation.rows.slice(1);return {tests:10,branchCoverageMissing:{mac:M.mac.coverage.missing,spark:M.spark.coverage.missing},branchCounters:M.mac.coverage.counters,
    mutations:{real:frac(count(m,r=>r.detected),count(m,r=>r.detected||!r.equivalenceProbe||r.equivalenceProbe.differences>0)),equivalent:m.filter(r=>!r.detected).map(r=>({mutation:r.mutation,probeInputs:r.equivalenceProbe?.inputs,differences:r.equivalenceProbe?.differences})),
      controlDetected:M.mac.mutation.rows[0].detected,sameOnSpark:JSON.stringify(M.mac.mutation.rows.map(r=>[r.mutation,r.detected]))===JSON.stringify(M.spark.mutation.rows.map(r=>[r.mutation,r.detected]))}};})(),
  profiles:Object.fromEntries(machines.map(m=>[m,M[m].profiles.rows.map(r=>({tool:r.tool,bytesIdentical:r.bytesIdentical,differingPaths:r.differingPaths}))])),
  npmTest:{mac:npm('mac/npm-test.log.gz'),spark:npm('spark/npm-test.log.gz'),sparkBase:npm('spark/npm-test-base-9f35223.log.gz')},
};
writeFileSync(join(here,'summary.json'),JSON.stringify(summary,null,1)+'\n');

// ---------------------------------------------------------------- manifest
const PURPOSE={
  'PROOF.md':'Preuve lisible de la tâche T1',
  'summary.json':'Chiffres de PROOF.md et comparaisons Mac/Spark, calculés par summarize.mjs à partir des sorties',
  'summarize.mjs':'Capture des environnements, comparaison Mac/Spark et manifeste',
  'fdlibm-v8.c':'Témoin C : fdlibm de V8 (src/base/ieee754.cc)',
  'gen-vectors.mjs':'Table de vecteurs, témoin exhaustif (mondes) et balayage aléatoire',
  'branch-coverage.mjs':'Couverture des branches de réduction par la table',
  'mutation-check.mjs':'Mutations de src/fmath.js contre checks/fmath.test.mjs',
  'profiles-check.mjs':'Profils publiés contre les archives x86-64 du lot 00',
  'mac-divergent-inputs.json':'Entrées divergentes récoltées sur le Mac (entrées seulement)',
  'environment.json':'Environnement et SHA-256 des sources mesurées',
  'golden.json':'Les 8 tests historiques sous Math hôte et sous FMath, sous-ensembles, empreintes JSON des 114 mondes',
  'census.json':'Recensement des appels Math.* de la génération (114 mondes)',
  'checkpoints.json':'Empreintes de reprise et écarts numériques, 42 mondes',
  'replay-native.json':'Rejeux de preuve natifs contre reference-63668ac (x86-64)',
  'replay-fmath.json':'Rejeux de preuve avec FMath dans le processus',
  'replay-v2-native.json':'Rejeux V2 courts natifs contre aa-v2-short (x86-64)',
  'replay-v2-fmath.json':'Rejeux V2 courts avec FMath',
  'engines.json':'Chrome sans tête et JavaScriptCore',
  'vectors-clang.json':'Table de vecteurs régénérée avec clang',
  'vectors-gcc.json':'Table de vecteurs régénérée avec gcc',
  'exhaustive-fmath.json':'Témoin exhaustif, mondes générés avec FMath',
  'exhaustive-host.json':'Témoin exhaustif, mondes générés avec le Math hôte',
  'sweep.json':'Balayage aléatoire de 2 millions d\'entrées',
  'branch-coverage.json':'Compteurs de branches',
  'mutation-check.json':'Résultat des mutations',
  'profiles.json':'Comparaison des profils publiés',
  'npm-test.log.gz':'npm test complet sur l\'état final',
  'npm-test-base-9f35223.log.gz':'npm test complet sur la base 9f35223',
};
const files=[];
(function walk(dir){
  for(const name of readdirSync(dir).sort()){
    const path=join(dir,name),rel=relative(here,path);
    if(statSync(path).isDirectory()){walk(path);continue;}
    if(rel==='manifest.json')continue;
    const data=readFileSync(path),entry={file:rel,purpose:PURPOSE[name]||null,bytes:data.length,sha256:sha(data)};
    if(name.endsWith('.gz')){const raw=gunzipSync(data);Object.assign(entry,{uncompressedBytes:raw.length,uncompressedSha256:sha(raw)});}
    files.push(entry);
  }
})(here);
const commands={
  note:'Run from the repository root. W is a scratch directory. On the Spark the repository is copied by rsync (without .git) to ~/metal-tests/lot01s-t1, Node 24 comes from nvm, TMPDIR is under ~/metal-tests, CC=gcc and CHROME=/usr/bin/google-chrome; on the Mac CC=clang and CHROME is Google Chrome.app. O is mac/ or spark/.',
  measurements:[
    'node tools/platform-math.mjs golden . --out $O/golden.json',
    'node tools/platform-math.mjs census . --out $O/census.json',
    'node tools/platform-math.mjs checkpoints . --out $O/checkpoints.json',
    'node tools/platform-math.mjs replay . --out $O/replay-native.json',
    'node tools/platform-math.mjs replay . --fmath --out $O/replay-fmath.json',
    'node tools/platform-math.mjs replay . --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-native.json',
    'node tools/platform-math.mjs replay . --fmath --scenario campaign2-w1,campaign2-w10 --steps 120 --out $O/replay-v2-fmath.json',
    'node tools/platform-math.mjs engines . --dir $W/eng --census $O/census.json --chrome $CHROME --out $O/engines.json',
    `node ${P}/gen-vectors.mjs vectors --cc $CC --work $W/vec --report $O/vectors-$CC.json`,
    `node ${P}/gen-vectors.mjs exhaustive --cc $CC --path fmath --work $W/ex --report $O/exhaustive-fmath.json`,
    `node ${P}/gen-vectors.mjs exhaustive --cc $CC --path host --work $W/ex --report $O/exhaustive-host.json`,
    `node ${P}/gen-vectors.mjs sweep --cc $CC --work $W/sw --report $O/sweep.json`,
    `node ${P}/branch-coverage.mjs > $O/branch-coverage.json`,
    `node ${P}/mutation-check.mjs $W/mut > $O/mutation-check.json`,
    `node ${P}/profiles-check.mjs --work $W/prof --out $O/profiles.json`,
    `node ${P}/summarize.mjs env --cc $CC --chrome $CHROME --out $O/environment.json`,
  ],
  tests:{mac:'npm test > npm-test.log 2>&1 (local, Node 24.18 darwin-arm64)',spark:'~/claude/metal-chantier/outils/npm-test-spark.sh <repository> <log> (rsync to the Spark, npm test with Node 24.18 linux-arm64)'},
  compression:'python3: gzip.compress(data, compresslevel=9, mtime=0) (no file name, OS byte 255)',
  summary:`node ${P}/summarize.mjs`,
};
const manifest={schema:'metal-lot01s-t1-proof-manifest-v1',task:'Lot 01 suite / T1 (MURS-V1)',base:'9f35223190ea9f915701e5627381eae32a77c002',
  encoding:{format:'gzip',level:9,mtime:0,filename:'',osByte:255,policy:'Only the npm test logs are compressed; every JSON output is under 200 KB and kept as written by its tool, except the path normalization below.'},
  pathNormalization:{note:'After measurement, machine-specific absolute path prefixes (the root and dir fields of the JSON outputs, file paths in the stack traces of the npm test logs) were rewritten relative to the home directory; no other byte was changed.',
    replaced:{'<Mac home>/claude/metal-chantier/':'~/claude/metal-chantier/','<Spark home>/metal-tests/':'~/metal-tests/','<Mac scratch directory>/t1r/work-mac':'$W'}},
  environments:Object.fromEntries(machines.map(m=>[m,summary.machines[m]])),
  measuredSources:M.mac.env.sources,sameSourcesOnBothMachines:summary.sameSourcesOnBothMachines,
  commands,files};
writeFileSync(join(here,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
console.log(JSON.stringify({summary:join(P,'summary.json'),manifest:join(P,'manifest.json'),files:files.length}));
