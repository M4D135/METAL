// Audit SIM scenario/pilot v1, made portable. Inputs intentionally preserve
// the audited driver, including its direct 0.01-rad yaw change before each step.
export const SCENARIOS = Object.freeze([
  {id:'legacy-s0',index:0,options:null},
  {id:'legacy-s2',index:2,options:null},
  {id:'campaign-w10',index:9,options:{campaign:true}},
  {id:'campaign-w16',index:15,options:{campaign:true}},
].map(value=>Object.freeze(value)));
// Explicit V2 selections for the shipped campaign. Keep SCENARIOS and "all"
// fixed to the four historical audit scenarios so old proofs stay comparable.
export const CAMPAIGN2_SCENARIOS=Object.freeze(Array.from({length:18},(_,index)=>Object.freeze({
  id:'campaign2-w'+(index+1),index,options:Object.freeze({campaign:true,campaignVersion:2}),
})));
export const SCENARIO_CATALOG=Object.freeze([...SCENARIOS,...CAMPAIGN2_SCENARIOS]);
export const SCENARIO_VERSION='audit-sim-driver-v1';
export const STEP_SECONDS=1/60;

export function selectScenarios(names) {
  if(!names||names==='all')return SCENARIOS;
  const wanted=names.split(',');
  for(const id of wanted)if(!SCENARIO_CATALOG.some(s=>s.id===id))throw new Error('Unknown scenario: '+id);
  return SCENARIO_CATALOG.filter(s=>wanted.includes(s.id));
}

export function makeInput(weapon) {
  return {moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0,...(weapon===undefined?{}:{weapon})};
}

export function drive(index,input,state) {
  input.moveX=Math.sin(index/90);input.fire=index%20<6;input.dash=index%240===0;state.player.yaw+=.01;
}

export function buildScenario(loaded,scenario,{seed=96,simOptions={}}={}) {
  const {FWorld,FSimulation,FBrain}=loaded.window;
  const world=FWorld.create(seed,scenario.index,scenario.options?{...scenario.options}:undefined);
  const brain=FBrain?FBrain.create({mode:'cpu'}):null;
  let sim;
  try {sim=FSimulation.create(world,{brain,...simOptions});}
  catch(error){brain?.dispose();throw error;}
  return {world,sim,dispose(){sim.dispose?.();brain?.dispose();}};
}
