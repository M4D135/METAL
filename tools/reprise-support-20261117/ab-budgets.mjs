#!/usr/bin/env node
// Lot 03 (17/11/2026): honest A/B bench of the simulation cost.
//
// Same world, same seed, same scripted inputs, same duration, same process
// environment. Warm-up, then alternating repetitions, medians and dispersion.
// The raw trace of every repetition is kept next to the report.
//
// This measures CPU time of the simulation in Node. It is NOT a hardware FPS
// measurement and must never be presented as one. GPU timings stay "n/d".
//
// Usage: node tools/reprise-support-20261117/ab-budgets.mjs [--reps 5] [--seconds 30]
//        [--out docs/reprise-support-20261117] [--variant NAME=path/to/src]
import {loadRealm} from '../../tools/realm-loader.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {argv} from 'node:process';
import {cpus} from 'node:os';

const arg=(name,fallback)=>{const i=argv.indexOf('--'+name);return i>=0&&argv[i+1]!==undefined?argv[i+1]:fallback;};
const REPS=Math.max(3,Number(arg('reps',5))||5);
const SECONDS=Math.max(5,Number(arg('seconds',30))||30);
const OUT=arg('out','docs/reprise-support-20261117');
const variants=arg('variant',null);

const MODULES=['fmath','passages','renderer','support','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation','demo-metal'];
const OPTIONS={campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1,supportDroneVersion:1};

function realmFor(root){return loadRealm({root,modules:MODULES}).window;}

// Deterministic scripted inputs: the same stream for every variant and rep.
function inputsFor(seconds){
  const frames=[],hz=60;
  for(let i=0;i<Math.round(seconds*hz);i++){
    const t=i/hz;
    frames.push({moveY:Math.sin(t*.7)>.1?.55:0,moveX:Math.sin(t*.31)*.4,lookX:.0015*Math.cos(t*.5),
      fire:i%37<3,fireLeft:i%91<2,jump:i%240===0,jumpHeld:i%240<18,sprint:i%600<180,interact:i%420<40});
  }
  return frames;
}

function runOnce(win,frames){
  const {FSimulation:S,FWorld:W,MetalDemo:D}=win;
  const gc=global.gc;
  if(gc)gc();
  const heapBefore=process.memoryUsage().heapUsed;
  const world=W.create(96,0,OPTIONS);
  const sim=S.create(world,D.loadout(0,'heavy',true),{rigidBodies:true,brain:null});
  const p=sim.state.player;
  const horde=sim.state.encounters.find(q=>q.horde);
  // Walk to the horde trigger so the machines actually come, and put the room
  // garrison on the field: an idle world would measure nothing but the void.
  if(horde){p.x=horde.trigger.x;p.z=horde.trigger.z;p.y=horde.trigger.y||0;}
  for(const e of sim.state.enemies)if(e.type!==3){e.deployed=true;e.encounterReleased=true;e.sleeping=false;}
  const trace=[];
  let peakAwake=0,peakBodies=0,peakJoints=0,peakParticles=0,worst=0;
  const started=performance.now();
  for(let i=0;i<frames.length;i++){
    const t0=performance.now();
    sim.step(1/60,frames[i]);
    sim.state.events.length=0;
    const dt=performance.now()-t0;
    const stats=sim.rigid?.physics?.stats||{};
    const awake=sim.state.aiStats.awake||0;
    peakAwake=Math.max(peakAwake,awake);
    peakBodies=Math.max(peakBodies,stats.bodies||0);
    peakJoints=Math.max(peakJoints,stats.joints||0);
    peakParticles=Math.max(peakParticles,sim.state.debris.length+sim.state.particles.length);
    worst=Math.max(worst,dt);
    if(i%6===0)trace.push(Number(dt.toFixed(4)));
  }
  const wall=performance.now()-started;
  const heapAfter=process.memoryUsage().heapUsed;
  const perStep=wall/frames.length;
  sim.dispose?.();
  const sorted=[...trace].sort((a,b)=>a-b);
  const q=f=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(f*sorted.length))]:0;
  return {wallMs:Number(wall.toFixed(2)),steps:frames.length,msPerStep:Number(perStep.toFixed(4)),
    medianStepMs:Number((sorted[Math.floor(sorted.length/2)]||0).toFixed(4)),p95StepMs:Number(q(.95).toFixed(4)),p99StepMs:Number(q(.99).toFixed(4)),
    worstStepMs:Number(worst.toFixed(4)),peakAwake,peakBodies,peakJoints,peakParticles,
    heapDeltaKiB:Math.round((heapAfter-heapBefore)/1024),
    realtimeRatio:Number((frames.length/60/(wall/1000)).toFixed(2)),
    trace};
}

const list=variants?variants.split(',').map(spec=>{const [name,path]=spec.split('=');return {name,path};}):[{name:'chantier',path:null}];
const frames=inputsFor(SECONDS);
const realms=new Map();
for(const v of list)realms.set(v.name,realmFor(v.path||new URL('../../',import.meta.url).pathname));

// One warm-up repetition per variant, never reported.
for(const v of list)runOnce(realms.get(v.name),frames);

const results=new Map();
for(let rep=0;rep<REPS;rep++){
  // Alternate the order so a warming machine does not favour one variant.
  const order=rep%2?list:[...list].reverse();
  for(const v of order){
    const r=runOnce(realms.get(v.name),frames);
    if(!results.has(v.name))results.set(v.name,[]);
    results.get(v.name).push({...r,rep,trace:undefined,raw:r.trace});
  }
}
const medians=rows=>{const f=k=>{const v=rows.map(r=>r[k]).sort((a,b)=>a-b);return Number((v[Math.floor(v.length/2)]||0).toFixed(4));};
  const spread=k=>{const v=rows.map(r=>r[k]).sort((a,b)=>a-b);return Number(((v[v.length-1]||0)-(v[0]||0)).toFixed(4));};
  return {medianWallMs:f('wallMs'),medianMsPerStep:f('msPerStep'),medianStepMs:f('medianStepMs'),p95StepMs:f('p95StepMs'),p99StepMs:f('p99StepMs'),
    worstStepMs:f('worstStepMs'),dispersionMsPerStep:spread('msPerStep'),peakAwake:f('peakAwake'),peakBodies:f('peakBodies'),peakJoints:f('peakJoints'),
    peakParticles:f('peakParticles'),heapDeltaKiB:f('heapDeltaKiB'),realtimeRatio:f('realtimeRatio')};};

const report={
  purpose:'A/B du coût de simulation (CPU Node). Ce n\'est pas une mesure de FPS matériel.',
  generatedAt:new Date().toISOString(),
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpuCount:cpus().length,
    gpu:'n/d (aucun timer GPU exposé par ce banc)',physx:'PhysX 5.12 WASM embarqué'},
  protocol:{world:'FWorld.create(96,0)',options:OPTIONS,secondsPerRepetition:SECONDS,steps:frames.length,
    repetitions:REPS,warmUpRepetitions:1,alternatingOrder:true,inputStream:'scriptée et identique pour toutes les variantes',
    gc:'global.gc si Node est lancé avec --expose-gc'},
  variants:{},raw:{}
};
for(const v of list){
  const rows=results.get(v.name);
  report.variants[v.name]={...medians(rows),repetitions:rows.map(r=>({rep:r.rep,wallMs:r.wallMs,msPerStep:r.msPerStep,p95StepMs:r.p95StepMs,peakAwake:r.peakAwake,peakBodies:r.peakBodies,heapDeltaKiB:r.heapDeltaKiB}))};
  report.raw[v.name]=rows.map(r=>r.raw);
}
if(list.length===2){
  const [a,b]=list.map(v=>report.variants[v.name]);
  report.comparison={medianMsPerStepDelta:Number((b.medianMsPerStep-a.medianMsPerStep).toFixed(4)),
    percent:Number((100*(b.medianMsPerStep-a.medianMsPerStep)/a.medianMsPerStep).toFixed(2)),
    note:'Delta de temps CPU de simulation, pas un gain FPS matériel.'};
}
mkdirSync(OUT,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
writeFileSync(`${OUT}/ab-budgets-${stamp}.json`,JSON.stringify(report,null,2)+'\n');
writeFileSync(`${OUT}/ab-budgets-latest.json`,JSON.stringify(report,null,2)+'\n');
for(const line of list.map(v=>{const r=report.variants[v.name];return `${v.name.padEnd(12)} médiane ${String(r.medianMsPerStep).padStart(7)} ms/pas · écart ${String(r.dispersionMsPerStep).padStart(6)} ms · p95 ${String(r.p95StepMs).padStart(7)} ms · pire ${String(r.worstStepMs).padStart(7)} ms · pics ${r.peakAwake} éveillés/${r.peakBodies} corps/${r.peakJoints} joints/${r.peakParticles} particules · tas ${r.heapDeltaKiB} KiB`;}))console.log(line);
console.log(`rapport : ${OUT}/ab-budgets-${stamp}.json`);
if(report.comparison)console.log('comparaison :',JSON.stringify(report.comparison));
