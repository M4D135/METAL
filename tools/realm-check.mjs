// Portable SIM-11/IA-06 comparison: identical source, genuine main/vm realms.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRealm,assertHostGlobalsUnchanged} from './realm-loader.mjs';
import {buildScenario,selectScenarios} from './proof/scenarios.mjs';
import {hasher} from './proof/digest.mjs';
import {parseArgs,environment,outputReport,quantile,verifySources,fingerprint} from './proof/common.mjs';
import {pairedReplay} from './ab2.mjs';

function measureGround(sim,xs,zs){
  const values=new Float64Array(xs.length),begin=process.cpuUsage();
  for(let i=0;i<xs.length;i++)values[i]=sim.ground(xs[i],zs[i]);
  const used=process.cpuUsage(begin),hash=hasher();for(const value of values)hash.number(value);
  return {calls:xs.length,userUs:used.user,systemUs:used.system,cpuNsPerCall:(used.user+used.system)*1000/xs.length,checksum:hash.hex()};
}

export function compareRealms(options){
  const before=Object.getOwnPropertyDescriptors(globalThis),root=options.roots[0],A=loadRealm({root}),B=loadRealm({root,realm:'vm'}),report={schema:'metal-realm-comparison-v1',environment:environment(),root,sourceSha256:A.sourceSha256,
    method:{clock:'process.cpuUsage, user + system; all warmup passes excluded',pairs:'AB/BA alternates by step and repetition; ground block order alternates by repetition',probes:options.probes||65536,requestedSteps:options.steps,reps:options.reps,warmups:options.warmups,seed:options.seed,
      limits:'CPU-specific diagnostic ratios, not acceptance thresholds or browser/frame-time measurements; per-step and per-probe checksums are compared.'},scenarios:[],identical:true};
  const scenarios=selectScenarios(options.scenario).filter(s=>options.scenario!=='all'||['legacy-s0','campaign-w10'].includes(s.id));
  for(const scenario of scenarios){
    const a=buildScenario(A,scenario,{seed:options.seed}),b=buildScenario(B,scenario,{seed:options.seed}),bounds=a.world.bounds,N=report.method.probes,xs=new Float64Array(N),zs=new Float64Array(N);let seed=12345;
    const random=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
    for(let i=0;i<N;i++){xs[i]=bounds.minX+random()*(bounds.maxX-bounds.minX);zs[i]=bounds.minZ+random()*(bounds.maxZ-bounds.minZ);}
    const passes=[];
    try{
      for(let pass=0;pass<options.warmups+options.reps;pass++){
        let main,vm;if(pass%2){vm=measureGround(b.sim,xs,zs);main=measureGround(a.sim,xs,zs);}else{main=measureGround(a.sim,xs,zs);vm=measureGround(b.sim,xs,zs);}
        const steps=pairedReplay(A,B,scenario,options,pass);
        passes.push({pass,excludedWarmup:pass<options.warmups,groundOrder:pass%2?'BA':'AB',main,vm,steps});
      }
    }finally{a.dispose();b.dispose();}
    const measured=passes.filter(p=>!p.excludedWarmup),identical=passes.every(p=>p.main.checksum===p.vm.checksum&&p.steps.identical);report.identical&&=identical;
    report.scenarios.push({id:scenario.id,identical,groundMedianVmOverMain:quantile(measured.map(p=>p.vm.cpuNsPerCall/p.main.cpuNsPerCall),.5),stepMedianVmOverMain:quantile(measured.map(p=>p.steps.b.cpu.totalUs/p.steps.a.cpu.totalUs),.5),passes});
  }
  verifySources(A);verifySources(B);assertHostGlobalsUnchanged(before);report.environmentAfter=environment();
  report.checksum=fingerprint(report.scenarios.map(s=>({id:s.id,ground:s.passes[0].main.checksum,steps:s.passes[0].steps.a.chainHash,snapshot:s.passes[0].steps.a.snapshot})));return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options=parseArgs(process.argv.slice(2));if(!process.argv.includes('--steps'))options.steps=1200;
  if(options.help)console.log('Usage: node tools/realm-check.mjs [root] [--steps 1200] [--reps 2] [--warmups 1] [--probes 65536] [--scenario legacy-s0,campaign-w10] [--out report.json]');
  else{const report=compareRealms(options);outputReport(report,options.out);if(!report.identical)process.exitCode=1;}
}
