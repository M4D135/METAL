// Independent, non-rendering CPU benchmark for the drone's movement hot path.
// Intentionally does not alter production simulation, controls, or FERRO modules.
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cpus, platform, release} from 'node:os';
import {resolve} from 'node:path';
import {loadRealm, DEFAULT_ROOT} from '../realm-loader.mjs';

const modules=['fmath','passages','renderer','physics-geometry','profiles','world','destruction','economy','motion','simulation'];
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const median=items=>{const s=[...items].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
function argumentsOf(argv){
  const opts={root:DEFAULT_ROOT,candidate:null,steps:840,warmups:1,reps:5,out:null};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];if(key==='--help'){opts.help=true;continue;}
    if(key==='--self-test'){opts.selfTest=true;continue;}
    if(!['--root','--candidate','--steps','--warmups','--reps','--out'].includes(key)||!argv[i+1])throw Error('Unknown or incomplete argument: '+key);
    opts[key.slice(2)]=argv[++i];
  }
  for(const key of ['steps','warmups','reps']){
    opts[key]=Number(opts[key]);if(!Number.isSafeInteger(opts[key])||opts[key]<(key==='warmups'?0:key==='steps'?6:1)||opts[key]>100000)throw Error('Invalid '+key);
  }
  // 20 Hz needs one tick per six baseline ticks; four equal input phases also require divisibility by four.
  // Otherwise a nominal A/B comparison changes simulated duration or input duty cycle across refresh rates.
  if(opts.steps%24!==0)throw Error('Invalid steps: multiple of 24 required for equal 20/60/120 Hz durations and four input phases');
  opts.root=resolve(opts.root);if(opts.candidate)opts.candidate=resolve(opts.candidate);
  return opts;
}
function world(scenario){
  const data={seed:96,index:0,stage:0,generation:6,campaign:true,campaignVersion:2,profileVersion:1,
    progression:{version:1,weaponSlots:5,maxActive:4,startWeapons:[true,true,true,true,true],startAmmo:[60,12,6,8,1]},
    spawn:{x:0,y:2,z:0,yaw:0},bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},
    walkable:[{x:0,y:0,z:0,w:200,d:200}],colliders:[],enemies:[],pickups:[],
    cores:[85,88,91].map((x,id)=>({id,x,y:0,z:85})),exit:{x:94,y:0,z:85}};
  if(scenario==='obstacles')data.colliders=[
    {minX:-5,maxX:5,minY:0,maxY:8,minZ:-2.02,maxZ:-2},
    {minX:-5,maxX:5,minY:6,maxY:6.02,minZ:-5,maxZ:5}];
  return data;
}
function inputAt(scenario,i,steps){
  if(scenario==='hover')return {};
  const phase=Math.floor(i*4/steps);
  if(scenario==='obstacles')return phase===0?{moveY:1,sprint:true}:phase===1?{jumpHeld:true}:phase===2?{descendHeld:true}:{moveX:1};
  return phase===0?{moveY:1,moveX:.45,sprint:true}:phase===1?{jumpHeld:true,moveY:1}:phase===2?{moveX:-.75,descendHeld:true}:{moveX:1,moveY:-.25};
}
function run(realm,scenario,fps,steps){
  const {FSimulation,MetalProfiles}=realm.window;
  const sim=FSimulation.create(world(scenario),{profiles:MetalProfiles.fresh(undefined,'light')});
  // Keep the simulated duration fixed across 20/60/120 Hz. Generate input
  // objects before the timer so their allocation is not attributed to fly().
  const ticks=steps*fps/120,dt=1/fps;
  assert(Number.isInteger(ticks),'Benchmark duration must match 20/60/120 Hz exactly');
  const inputs=Array.from({length:ticks},(_,i)=>inputAt(scenario,i,ticks));
  const startCPU=process.cpuUsage(),start=process.hrtime.bigint();
  for(let i=0;i<ticks;i++)sim.step(dt,inputs[i]);
  const wallMs=Number(process.hrtime.bigint()-start)/1e6,cpu=process.cpuUsage(startCPU);
  if(sim.state.dead||sim.state.won)throw Error('Benchmark scenario terminated early: '+scenario+'@'+fps+' Hz');
  const snapshot=sim.snapshot(),digest=sha(snapshot);
  return {cpuMs:(cpu.user+cpu.system)/1000,wallMs,digest,steps:ticks,simulatedSeconds:ticks*dt,
    state:{x:sim.state.player.x,y:sim.state.player.y,z:sim.state.player.z,
      airVX:sim.state.player.airVX,airVY:sim.state.player.airVY,airVZ:sim.state.player.airVZ}};
}
function cpuDeltaPercent(a,b){const baseline=median(a.map(x=>x.cpuMs));return baseline>0?100*(median(b.map(x=>x.cpuMs))/baseline-1):null;}
function summarize(samples){return {medianCPUms:median(samples.map(x=>x.cpuMs)),medianWallMs:median(samples.map(x=>x.wallMs)),
  minCPUms:Math.min(...samples.map(x=>x.cpuMs)),maxCPUms:Math.max(...samples.map(x=>x.cpuMs))};}
function benchmark(opts){
  const roots=[opts.root,...(opts.candidate?[opts.candidate]:[])],realms=roots.map(root=>loadRealm({root,modules}));
  const report={schema:'metal-flight-cpu-bench-v1',date:new Date().toISOString(),environment:{node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model||null},
    scope:'Simulation CPU only. No WebGL, GPU, browser FPS or allocated-byte measurement.',
    method:{stepsAt120Hz:opts.steps,seconds:opts.steps/120,warmups:opts.warmups,reps:opts.reps,fps:[20,60,120],scenarios:['hover','traversal','obstacles'],
      order:'Alternates A/B and B/A by pass; equal simulated time at each Hz; fresh world and simulation per pass; setup, input allocation and snapshot hashing excluded from timing.'},
    sources:realms.map((r,i)=>({label:i?'B':'A',root:roots[i],sha256:r.sourceSha256})),results:[],sameStateAcrossVariants:true};
  for(const scenario of report.method.scenarios)for(const fps of report.method.fps){
    const runs=realms.map(()=>[]);
    for(let pass=0;pass<opts.warmups+opts.reps;pass++){
      const order=realms.length===2&&pass%2?[1,0]:realms.map((_,i)=>i);
      for(const index of order){const result=run(realms[index],scenario,fps,opts.steps);if(pass>=opts.warmups)runs[index].push(result);}
    }
    const stable=runs.every(series=>series.every(r=>r.digest===series[0].digest));
    const sameState=runs.length===1||runs[0][0].digest===runs[1][0].digest;
    report.sameStateAcrossVariants&&=sameState;
    report.results.push({scenario,fps,stable,sameState,variants:runs.map((samples,index)=>({label:index?'B':'A',digest:samples[0].digest,
      ...summarize(samples),samples})),...(runs.length===2&&sameState?{candidateVsBaselineCPUPercent:cpuDeltaPercent(runs[0],runs[1])}:{})});
  }
  report.allStable=report.results.every(r=>r.stable);
  return report;
}
function selfTest(){
  assert.equal(median([3,1,2]),2);assert.equal(median([4,2,1,3]),2.5);
  assert.equal(sha({a:1}),sha({a:1}));assert.notEqual(sha({a:1}),sha({a:2}));
  assert.equal(world('obstacles').colliders.length,2);assert.equal(world('hover').colliders.length,0);
  assert.deepEqual(inputAt('hover',0,8),{});assert.equal(inputAt('obstacles',0,8).moveY,1);
  assert.equal(inputAt('obstacles',3,8).jumpHeld,true);
  assert.equal(inputAt('obstacles',5,8).descendHeld,true);
  assert.throws(()=>argumentsOf(['--steps','0']),/Invalid steps/);
  assert.throws(()=>argumentsOf(['--candidate']),/incomplete argument/);
  assert.throws(()=>argumentsOf(['--steps','841']),/multiple of 24/);
  assert.throws(()=>argumentsOf(['--steps','6']),/multiple of 24/);
  assert.equal(argumentsOf(['--steps','840']).steps,840);
  assert.equal(cpuDeltaPercent([{cpuMs:1},{cpuMs:1},{cpuMs:100}],[{cpuMs:2},{cpuMs:2},{cpuMs:2}]),100);
  assert.equal(cpuDeltaPercent([{cpuMs:0}],[{cpuMs:1}]),null);
  console.log('flight-cpu-bench self-test: PASS (17 assertions; no game code executed)');
}
const opts=argumentsOf(process.argv.slice(2));
if(opts.selfTest)selfTest();
else if(opts.help)console.log('Usage: node tools/mission-20261117/flight-cpu-bench.mjs [--root repo] [--candidate other-repo] [--steps 840] [--warmups 1] [--reps 5] [--out report.json] [--self-test]');
else{const result=benchmark(opts),serialized=JSON.stringify(result,null,2)+'\n';if(opts.out)writeFileSync(opts.out,serialized);else console.log(serialized);
  if(!result.allStable||opts.candidate&&!result.sameStateAcrossVariants)process.exitCode=1;
}
