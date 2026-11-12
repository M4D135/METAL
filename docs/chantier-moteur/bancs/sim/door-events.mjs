// How many door openings and destruction revisions the scripted scenarios exercise (coverage of the nav-local proof).
import {loadFast} from './fast.mjs';import {SCENARIOS,drive,makeInput,build} from './lib.mjs';
const ctx=loadFast();
for(const w of [undefined,2])for(const [label,idx,opts] of SCENARIOS){const {sim}=build(ctx,idx,opts),s=sim.state,input=makeInput();if(w)input.weapon=w;let doors=0,breaks=0;
  for(let i=0;i<1800;i++){drive(i,input,s);sim.step(1/60,input);for(const e of s.events){if(e.name==='doorOpen')doors++;if(e.name==='materialBreak')breaks++;}s.events.length=0;if(s.dead)break;}
  console.log((label+(w?' +rockets':'')).padEnd(22)+' doorOpen '+doors+' materialBreak '+breaks+' destruction.revision '+sim.destruction.revision+' state.destructionRevision '+s.destructionRevision);}
