// CPU step profile; no simulation/runtime source or functional test is changed.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRealm,assertHostGlobalsUnchanged} from './realm-loader.mjs';
import {selectScenarios,SCENARIO_VERSION,STEP_SECONDS} from './proof/scenarios.mjs';
import {DIGEST_VERSION} from './proof/digest.mjs';
import {parseArgs,loadPatch,environment,outputReport,fingerprint,verifySources,summarize} from './proof/common.mjs';
import {replay,sameState,stateProof} from './proof/run.mjs';

export async function profileSteps(options) {
  const globals=Object.getOwnPropertyDescriptors(globalThis),patches=await loadPatch(options.patchA),root=options.roots[0];
  const loaded=loadRealm({root,realm:options.realm,patches}),counted=options.counters?loadRealm({root,realm:options.realm,patches,instrument:true}):null;
  const report={schema:'metal-profile-steps-v1',environment:environment(),root,scenarioVersion:SCENARIO_VERSION,digestVersion:DIGEST_VERSION,sourceSha256:loaded.sourceSha256,loadedSha256:loaded.loadedSha256,
    method:{realm:options.realm,clock:'process.cpuUsage per sim.step; user + system microseconds',dt:STEP_SECONDS,seed:options.seed,weapon:options.weapon??null,requestedSteps:options.steps,warmupPasses:options.warmups,measuredPasses:options.reps,
      warmup:'Every warmup replays the entire requested scenario in a fresh simulation and is excluded from all timing aggregates.',
      counters:'Separate untimed instrumented replay; counters exist only in s.aiStats of the in-memory source variant. Its state hashes and final snapshot must equal the uninstrumented replay.',
      limits:'Node process CPU, including process GC/JIT; not browser, GPU, frame-time or real-device measurements. Per-call timing overhead is not subtracted.'},scenarios:[],identical:true};
  for(const scenario of selectScenarios(options.scenario)){
    const passes=[];
    for(let pass=0;pass<options.warmups+options.reps;pass++)passes.push({pass,excludedWarmup:pass<options.warmups,...replay(loaded,scenario,options)});
    const counts=counted?replay(counted,scenario,options,{timed:false}):null,reference=passes[0];
    const stable=passes.every(run=>sameState(reference,run))&&(!counts||sameState(reference,counts));
    report.identical&&=stable;
    report.scenarios.push({id:scenario.id,index:scenario.index,options:scenario.options,stable,proof:stateProof(reference),
      cpu:summarize(passes.filter(p=>!p.excludedWarmup).flatMap(p=>p.rows.map(row=>row.cpuUs))),passes,counterReplay:counts});
  }
  verifySources(loaded);if(counted)verifySources(counted);assertHostGlobalsUnchanged(globals);
  report.checksum=fingerprint(report.scenarios.map(s=>({id:s.id,proof:s.proof})));report.environmentAfter=environment();
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options=parseArgs(process.argv.slice(2));
  if(options.help)console.log('Usage: node tools/profile-steps.mjs [root] [--scenario all|legacy-s0,campaign-w10] [--steps 1800] [--reps 2] [--warmups 1] [--seed 96] [--weapon ID] [--realm main|vm] [--patch-a module.mjs#export] [--no-counters] [--out report.json]');
  else{const report=await profileSteps(options);outputReport(report,options.out);if(!report.identical)process.exitCode=1;}
}
