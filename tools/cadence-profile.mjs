// STAB-V1: paired main-realm measurements of the subdivision actually used by game.js.
// Different subdivision intentionally changes trajectories; this is not a bit-equality claim.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {cpus} from 'node:os';
import {loadRealm} from './realm-loader.mjs';

const [referenceArg,candidateArg,worldName='c0',secondsArg='15',pairsArg='3']=process.argv.slice(2);
if(!referenceArg||!candidateArg)throw new Error('Usage: node tools/cadence-profile.mjs <reference-root> <candidate-root> [world=c0] [seconds=15] [pairs=3]');
const seconds=Number(secondsArg),pairs=Number(pairsArg);
if(!/^[cl]\d+$/.test(worldName)||!Number.isFinite(seconds)||seconds<=0||!Number.isInteger(pairs)||pairs<2)throw new Error('Invalid scenario, duration or pair count');
const roots=[resolve(referenceArg),resolve(candidateArg)];
const sha=text=>createHash('sha256').update(text).digest('hex');
const cpuUsage=process.threadCpuUsage?()=>process.threadCpuUsage():()=>process.cpuUsage();
const cpu=()=>{const value=cpuUsage();return value.user+value.system;};
const median=values=>{const list=[...values].sort((a,b)=>a-b),middle=list.length>>1;return list.length%2?list[middle]:(list[middle-1]+list[middle])/2;};
let sharedLoaded;
const configurations=roots.map(root=>{
  const game=readFileSync(root+'/src/game.js','utf8'),match=game.match(/const steps=([^\n]+?),part=dt\/steps;/);
  if(!match)throw new Error('Cannot find production frame subdivision in '+root);
  const candidate=loadRealm({root});
  // Identical simulation sources share compiled functions, not state. This avoids
  // attributing different JIT histories to a change that only touches game.js.
  const loaded=sharedLoaded&&JSON.stringify(sharedLoaded.sourceSha256)===JSON.stringify(candidate.sourceSha256)?{...candidate,window:sharedLoaded.window}:candidate;
  sharedLoaded??=loaded;const {FWorld}=loaded.window;
  const world=FWorld.create(96,Number(worldName.slice(1)),worldName[0]==='c'?{campaign:true,campaignVersion:2}:undefined);
  return {root,loaded,world,expression:match[1],stepsFor:Function('dt','return ('+match[1]+');'),gameSha256:sha(game)};
});

function stamps(pattern){
  let time=0;
  if(pattern==='q60'||pattern==='ms60')return ()=>{time+=1000/60;return pattern==='q60'?Math.round(time*10)/10:Math.round(time);};
  return ()=>time+=1000/Number(pattern);
}
function makeRunner(configuration,pattern){
  const {FSimulation,FBrain}=configuration.loaded.window;
  const sim=FSimulation.create(configuration.world,{armorSystem:true,brain:FBrain.create({mode:'cpu'})});sim.setDifficulty?.(0);
  const state=sim.state,next=stamps(pattern),input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:true,assist:false};
  let last=0,time=0,steps=0,cpuUs=0,lastDash=0,maxPartMs=0;const histogram={};
  return {frame(){
    const now=next(),dt=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
    const count=configuration.stepsFor(dt),part=dt/count;histogram[count]=(histogram[count]||0)+1;maxPartMs=Math.max(maxPartMs,part*1000);
    input.lookX=.6*dt;
    for(let i=0;i<count;i++){
      input.moveX=Math.sin(time*.667);input.fire=time%.333<.1;
      if(Math.floor(time/4)!==Math.floor(lastDash/4)){input.dash=true;lastDash=time;}
      const start=cpu();sim.step(part,input);cpuUs+=cpu()-start;
      input.lookX=0;input.dash=false;time+=part;steps++;state.events.length=0;
      if(state.player.hp<60)state.player.hp=100;
    }
  },report(){return {steps,histogram,maxPartMs,simulatedSeconds:time,cpuMs:cpuUs/1000,cpuMsPerSimulatedSecond:cpuUs/1000/time,snapshotSha256:sha(JSON.stringify(sim.snapshot()))};}};
}

const results=[];
for(const pattern of ['q60','ms60','59.94','30','120','144']){
  const hz=pattern==='q60'||pattern==='ms60'?60:Number(pattern),frames=Math.ceil(seconds*hz),runs=[];
  for(let repeat=0;repeat<=pairs;repeat++){
    const runners=[];const firstCreated=repeat&1;
    runners[firstCreated]=makeRunner(configurations[firstCreated],pattern);runners[1-firstCreated]=makeRunner(configurations[1-firstCreated],pattern);
    for(let frame=0;frame<frames;frame++){
      const first=(frame+repeat)&1;runners[first].frame();runners[1-first].frame();
    }
    const reports=runners.map(runner=>runner.report());
    if(repeat>0)runs.push({orderStart:repeat&1?'BA':'AB',reference:reports[0],candidate:reports[1]});
  }
  for(const side of ['reference','candidate'])if(new Set(runs.map(run=>run[side].snapshotSha256)).size!==1)throw new Error('Non-reproducible '+side+' state in '+pattern);
  const referenceCpu=median(runs.map(run=>run.reference.cpuMsPerSimulatedSecond)),candidateCpu=median(runs.map(run=>run.candidate.cpuMsPerSimulatedSecond));
  results.push({pattern,frames,referenceSteps:runs[0].reference.steps,candidateSteps:runs[0].candidate.steps,referenceHistogram:runs[0].reference.histogram,candidateHistogram:runs[0].candidate.histogram,referenceCpuMsPerSimulatedSecond:referenceCpu,candidateCpuMsPerSimulatedSecond:candidateCpu,medianPairedCpuRatio:median(runs.map(run=>run.candidate.cpuMs/run.reference.cpuMs)),deterministicWithinEachVariant:true,runs});
}
console.log(JSON.stringify({schema:'metal-cadence-profile-v1',node:process.version,cpu:cpus()[0]?.model,cpuClock:process.threadCpuUsage?'threadCpuUsage':'cpuUsage',sharedSimulationFunctions:configurations[0].loaded.window===configurations[1].loaded.window,world:worldName,seconds,pairs,warmupPassesDiscarded:1,reference:{root:roots[0],formula:configurations[0].expression,gameSha256:configurations[0].gameSha256,sourceSha256:configurations[0].loaded.sourceSha256},candidate:{root:roots[1],formula:configurations[1].expression,gameSha256:configurations[1].gameSha256,sourceSha256:configurations[1].loaded.sourceSha256},results},null,2));
