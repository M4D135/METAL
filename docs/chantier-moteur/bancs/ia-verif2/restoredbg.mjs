import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='circle',stepsArg='600',filter='legacy-s0']=process.argv.slice(2);
const W=loadSet(root,{patch:src=>rep(src,'      }catch(_){return false;}\n    }\n    if(!advanced)rebuildNav();','      }catch(_){console.log("restore failed:",_.message,_.stack.split("\\n").slice(1,4).join(" | "));return false;}\n    }\n    if(!advanced)rebuildNav();')});
const [label,idx,opts]=pickScen(filter)[0];const w=W.FWorld.create(96,idx,opts);
for(const n of [0,60,+stepsArg]){const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const d=makeDriver(driver,sim,w),inp={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  for(let i=0;i<n;i++){d(i,inp);sim.step(1/60,inp);sim.state.events.length=0;}
  const snap=JSON.parse(JSON.stringify(sim.snapshot()));const t=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});console.log(label,'after',n,'steps restore ->',t.restore(snap));}
