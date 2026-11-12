import {buildScenario,makeInput,drive,STEP_SECONDS} from './scenarios.mjs';
import {FNV_OFFSET,stateDigest,chainDigest,hex,snapshotDigest} from './digest.mjs';
import {resetCounters,readCounters,COUNTERS} from './instrument.mjs';
import {cpuStep,summarize} from './common.mjs';

export function createRun(loaded,scenario,options={}) {
  const session=buildScenario(loaded,scenario,{seed:options.seed});
  return {...session,input:makeInput(options.weapon),rows:[],chain:FNV_OFFSET,instrument:loaded.instrument};
}

export function advance(run,index,{timed=true,observe=true}={}) {
  drive(index,run.input,run.sim.state);
  if(run.instrument)resetCounters(run.sim.state);
  let timing;
  if(timed)timing=cpuStep(run.sim,STEP_SECONDS,run.input);else run.sim.step(STEP_SECONDS,run.input);
  return observe?observeRun(run,index,timing):timing;
}

export function observeRun(run,index,timing) {
  const digest=stateDigest(run.sim.state);run.chain=chainDigest(run.chain,digest);
  const row={step:index,...timing,stateHash:hex(digest),events:run.sim.state.events.length,...(run.instrument?{counters:readCounters(run.sim.state)}:{})};
  run.rows.push(row);
  // The real shell consumes and clears these events after each simulation step.
  run.sim.state.events.length=0;
  return row;
}

export function finishRun(run) {
  const snapshot=snapshotDigest(run.sim),state=run.sim.state;
  const result={steps:run.rows.length,chainHash:hex(run.chain),snapshot,dead:state.dead,won:state.won,simulationSeconds:state.elapsed,rows:run.rows};
  if(run.rows.some(row=>row.cpuUs!==undefined))result.cpu=summarize(run.rows.map(row=>row.cpuUs));
  if(run.instrument)result.counters=Object.fromEntries(COUNTERS.map(key=>[key,run.rows.reduce((sum,row)=>sum+row.counters[key],0)]));
  run.dispose();return result;
}

export function replay(loaded,scenario,options,{timed=true}={}) {
  const run=createRun(loaded,scenario,options);
  try {
    for(let index=0;index<options.steps;index++){
      advance(run,index,{timed});if(run.sim.state.dead||run.sim.state.won)break;
    }
    return finishRun(run);
  }catch(error){run.dispose();throw error;}
}

export function sameState(a,b){return a.steps===b.steps&&a.chainHash===b.chainHash&&a.snapshot.sha256===b.snapshot.sha256&&a.rows.every((row,index)=>row.stateHash===b.rows[index]?.stateHash);}
export function stateProof(run){return {steps:run.steps,chainHash:run.chainHash,snapshot:run.snapshot,stateHashes:run.rows.map(row=>row.stateHash)};}
