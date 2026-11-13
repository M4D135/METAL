// How often is a mid-game snapshot refused by restore()? Every K steps: snapshot ->
// fresh simulation -> restore. Reports refusals and the failing validation line.
// usage: node restorable.mjs <repo> <driver> <steps> <scenarios> [every=120]
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='circle',stepsArg='1800',filter='legacy-s0',everyArg='120']=process.argv.slice(2);
globalThis.__why=[];
const W=loadSet(root,{patch:src=>rep(src,'      }catch(_){return false;}\n    }\n    if(!advanced)rebuildNav();','      }catch(_){__why.push((_.stack.split("\\n")[2]||"").replace(/.*simulation\\.js:(\\d+).*/,"$1"));return false;}\n    }\n    if(!advanced)rebuildNav();')});
for(const [label,idx,opts] of pickScen(filter)){
  const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const d=makeDriver(driver,sim,w),inp={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  let tries=0,fails=0;const lines={};globalThis.__why.length=0;
  for(let i=0;i<+stepsArg;i++){d(i,inp);sim.step(1/60,inp);sim.state.events.length=0;
    if(i%+everyArg===everyArg-1){const snap=JSON.parse(JSON.stringify(sim.snapshot()));const t=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});tries++;if(!t.restore(snap)){fails++;const l=globalThis.__why.at(-1);lines[l]=(lines[l]||0)+1;}}
    if(sim.state.dead)break;}
  console.log(JSON.stringify({label,driver,snapshots:tries,refused:fails,failingLine:lines,rubble:sim.state.debris.filter(q=>q.structural).length}));
}
