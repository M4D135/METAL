// share of sim.step spent in destruction.damage / rebuild / compile (R1 build, ab.mjs pilot), min over K replays per step is not needed: fractions inside one run.
import {loadAll,simSource,SCENARIOS,build,drive,makeInput,applyList,source} from './build.mjs';import {destTime} from './destfast.mjs';
const H={rb:0,rbn:0,rc:0,rcn:0,dc:0,dcn:0,dm:0,dmn:0};
const win=loadAll({sim:simSource({}),patches:destTime,names:['renderer','world','destruction','economy','brain','simulation'],hooks:{__H:H}});
const N=+process.argv[2]||1800;
for(const W of [undefined,3]){
for(const [label,idx,opts] of SCENARIOS){
  let best=null;
  for(let r=0;r<3;r++){for(const k in H)H[k]=0;const {sim}=build(win,idx,opts),s=sim.state,input=makeInput();if(W!==undefined)input.weapon=W;let step=0,fireSteps=0;
    for(let i=0;i<N;i++){drive(i,input,s);if(s.player.hp<50)s.player.hp=100;const t=performance.now();sim.step(1/60,input);const d=performance.now()-t;s.events.length=0;if(i>=300){step+=d;}else if(i===299){for(const k in H)H[k]=0;}}
    const row={step,...H,rev:sim.destruction.revision};if(!best||row.step<best.step)best=row;}
  const n=N-300;console.log((label+' w'+(W??0)).padEnd(16),'step us',(1e3*best.step/n).toFixed(0),'| damage',(100*best.dm/best.step).toFixed(1)+'% ('+best.dmn+' calls, '+(1e3*best.dm/best.dmn).toFixed(0)+' us each)','| rebuild',(100*best.rb/best.step).toFixed(1)+'% ('+best.rbn+' rev, '+(1e3*best.rb/Math.max(1,best.rbn)).toFixed(0)+' us each)','| compile in rebuild',(100*best.rc/best.step).toFixed(1)+'% n='+best.rcn,'| compile in damage',(100*best.dc/best.step).toFixed(1)+'% n='+best.dcn);
}}
