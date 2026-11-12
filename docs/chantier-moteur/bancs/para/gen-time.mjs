import {loadMain,SCENARIOS} from './load.mjs';
const win=loadMain();const {FWorld,FSimulation,FBrain}=win;
for(const name of (process.argv[2]||'legacy-s0,campaign2-w10,legacy-s0,campaign2-w10').split(',')){
  const [idx,opts]=SCENARIOS[name];let t=performance.now();const world=FWorld.create(96,idx,opts);const a=performance.now()-t;
  t=performance.now();const brain=FBrain.create({mode:'cpu'});const b=performance.now()-t;
  t=performance.now();const sim=FSimulation.create(world,{brain});const c=performance.now()-t;
  t=performance.now();for(let i=0;i<60;i++)sim.step(1/60,{moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0});const d=performance.now()-t;
  console.log(name,'FWorld.create',a.toFixed(0),'ms | FBrain.create',b.toFixed(1),'| FSimulation.create',c.toFixed(0),'ms | 60 pas',d.toFixed(1),'ms');
}
