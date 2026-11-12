// Paired, alternating A/B source variants. Both advance in the same process;
// timing excludes the pilot, state hashes, counters and final snapshot work.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRealm,assertHostGlobalsUnchanged} from './realm-loader.mjs';
import {selectScenarios,SCENARIO_VERSION,STEP_SECONDS} from './proof/scenarios.mjs';
import {DIGEST_VERSION} from './proof/digest.mjs';
import {parseArgs,loadPatch,environment,outputReport,fingerprint,verifySources,summarize,quantile} from './proof/common.mjs';
import {createRun,advance,observeRun,finishRun,sameState,stateProof} from './proof/run.mjs';

export function pairedReplay(A,B,scenario,options,pass,{timed=true}={}){
  const a=createRun(A,scenario,options),b=createRun(B,scenario,options),order=[];let firstDifference=null;
  try{
    for(let index=0;index<options.steps;index++){
      const ba=(index+pass)%2===1;order.push(ba?'BA':'AB');
      let leftTime,rightTime;
      if(ba){rightTime=advance(b,index,{timed,observe:false});leftTime=advance(a,index,{timed,observe:false});}
      else{leftTime=advance(a,index,{timed,observe:false});rightTime=advance(b,index,{timed,observe:false});}
      // Hashing happens after BOTH timed steps, never between A and B.
      observeRun(a,index,leftTime);observeRun(b,index,rightTime);
      if(firstDifference===null&&a.rows[index].stateHash!==b.rows[index].stateHash)firstDifference=index;
      if(a.sim.state.dead||a.sim.state.won||b.sim.state.dead||b.sim.state.won)break;
    }
    const left=finishRun(a),right=finishRun(b);
    return {pass,firstOrder:order[0],order,a:left,b:right,identical:sameState(left,right),firstDifference};
  }catch(error){a.dispose();b.dispose();throw error;}
}

export async function compareSteps(options){
  const globals=Object.getOwnPropertyDescriptors(globalThis),patchA=await loadPatch(options.patchA),patchB=await loadPatch(options.patchB);
  const A=loadRealm({root:options.roots[0],realm:options.realm,patches:patchA}),B=loadRealm({root:options.roots[1],realm:options.realm,patches:patchB});
  const report={schema:'metal-ab2-v1',environment:environment(),scenarioVersion:SCENARIO_VERSION,digestVersion:DIGEST_VERSION,
    variants:{a:{root:A.root,sourceSha256:A.sourceSha256,loadedSha256:A.loadedSha256},b:{root:B.root,sourceSha256:B.sourceSha256,loadedSha256:B.loadedSha256}},
    method:{realm:options.realm,clock:'process.cpuUsage per sim.step; user + system microseconds',dt:STEP_SECONDS,seed:options.seed,weapon:options.weapon??null,requestedSteps:options.steps,warmupPasses:options.warmups,measuredPasses:options.reps,
      pairing:'AB then BA at each step; first order also reverses with the pass number. Each side has independent module closures, window, world, brain and simulation.',
      warmup:'Full first scenario passes are retained as raw evidence and excluded from every timing aggregate.',
      ratio:'B/A median of paired per-step CPU values where both sides meet minCpuUs; total ratio is reported separately.',minCpuUs:options.minCpuUs,
      counters:'Separate untimed instrumented A/B replay, verified against the matching uninstrumented variant.',
      limits:'Node process CPU includes GC/JIT; does not prove browser frame time, GPU speed or device FPS. FNV32 is a regression signal, not a collision-free proof; final snapshots also use SHA-256.'},scenarios:[],identical:true};
  const countedA=options.counters?loadRealm({root:A.root,realm:options.realm,patches:patchA,instrument:true}):null;
  const countedB=options.counters?loadRealm({root:B.root,realm:options.realm,patches:patchB,instrument:true}):null;
  for(const scenario of selectScenarios(options.scenario)){
    const passes=[];
    for(let pass=0;pass<options.warmups+options.reps;pass++)passes.push({excludedWarmup:pass<options.warmups,...pairedReplay(A,B,scenario,options,pass)});
    const counts=countedA?pairedReplay(countedA,countedB,scenario,options,0,{timed:false}):null;
    const reference=passes[0],stableA=passes.every(p=>sameState(reference.a,p.a))&&(!counts||sameState(reference.a,counts.a)),stableB=passes.every(p=>sameState(reference.b,p.b))&&(!counts||sameState(reference.b,counts.b));
    const measured=passes.filter(p=>!p.excludedWarmup),left=measured.flatMap(p=>p.a.rows.map(row=>row.cpuUs)),right=measured.flatMap(p=>p.b.rows.map(row=>row.cpuUs));
    const ratios=left.flatMap((value,index)=>value>=options.minCpuUs&&right[index]>=options.minCpuUs?[right[index]/value]:[]),statsA=summarize(left),statsB=summarize(right);
    const identical=stableA&&stableB&&passes.every(p=>p.identical)&&(!counts||counts.identical);report.identical&&=identical;
    report.scenarios.push({id:scenario.id,index:scenario.index,options:scenario.options,identical,stableA,stableB,firstDifference:passes.find(p=>!p.identical)?.firstDifference??null,
      timing:{a:statsA,b:statsB,medianPairedRatio:quantile(ratios,.5),pairedSamples:ratios.length,excludedQuantizedPairs:left.length-ratios.length,totalRatio:statsA.totalUs?statsB.totalUs/statsA.totalUs:null},
      proofA:stateProof(reference.a),proofB:stateProof(reference.b),passes,counterReplay:counts});
  }
  for(const loaded of [A,B,countedA,countedB].filter(Boolean))verifySources(loaded);assertHostGlobalsUnchanged(globals);
  report.checksum=fingerprint(report.scenarios.map(s=>({id:s.id,proofA:s.proofA,proofB:s.proofB})));report.environmentAfter=environment();return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options=parseArgs(process.argv.slice(2),{paired:true});
  if(options.help)console.log('Usage: node tools/ab2.mjs [root-a] [root-b] [--scenario all|legacy-s0,campaign-w10] [--steps 1800] [--reps 2] [--warmups 1] [--patch-a module.mjs#export] [--patch-b module.mjs#export] [--min-cpu-us 5] [--no-counters] [--out report.json]\nOmit root-b for an A/A control. State divergence sets exit status 1.');
  else{const report=await compareSteps(options);outputReport(report,options.out);if(!report.identical)process.exitCode=1;}
}
