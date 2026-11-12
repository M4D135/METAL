// What does a budget deferral actually cost in behaviour? counts per run:
// deferred route() calls, plans that saw >=1 deferral, of which ended in 'hold',
// natural-entry candidates skipped because of a deferral (line 711), stuck re-route wiped (1530).
// usage: node defer.mjs <repo> <circle|tour> <steps> <scenarios>
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='tour',stepsArg='3600',filter='v2-w01']=process.argv.slice(2);const STEPS=+stepsArg;
const V=globalThis.__V={};const KEYS=['def','plans','plansDeferred','holdByDefer','holdAll','entrySkipDefer','entryProbe','stuckWipeDefer','stuckReroute','returnDefer','reinfDefer'];
function patch(src){
  src=rep(src,'if(routeBudget<=0){routeDeferred++;return null;}','if(routeBudget<=0){routeDeferred++;__V.def++;return null;}');
  src=rep(src,'if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;plan(e);}','if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;const __d0=__V.def;plan(e);__V.plans++;if(e.tactic===\'hold\')__V.holdAll++;if(__V.def>__d0){__V.plansDeferred++;if(e.tactic===\'hold\')__V.holdByDefer++;}}');
  src=rep(src,'if(bossProgression&&q.naturalEntries){approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);if(approachPath===null)continue;}','if(bossProgression&&q.naturalEntries){const __d0=__V.def;approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);__V.entryProbe++;if(approachPath===null){if(__V.def>__d0)__V.entrySkipDefer++;continue;}}');
  src=rep(src,'const path=route(e,e.goalX,e.goalZ);e.planWait=0;e.path=path||[];','const __d0=__V.def;const path=route(e,e.goalX,e.goalZ);__V.stuckReroute++;if(!path&&__V.def>__d0)__V.stuckWipeDefer++;e.planWait=0;e.path=path||[];');
  src=rep(src,"const home=world.enemies[e.id];if(e.planWait<=0){if(!setGoal(e,home.x,home.z,'advance',2.4))","const home=world.enemies[e.id];if(e.planWait<=0){const __d0=__V.def;const __ok=setGoal(e,home.x,home.z,'advance',2.4);if(!__ok&&__V.def>__d0)__V.returnDefer++;if(!__ok)");
  src=rep(src,"if(e.planWait<=0){if(!setGoal(e,q.trigger.x,q.trigger.z,'advance',2.4))e.planWait=.4;}","if(e.planWait<=0){const __d0=__V.def;const __ok=setGoal(e,q.trigger.x,q.trigger.z,'advance',2.4);if(!__ok&&__V.def>__d0)__V.reinfDefer++;if(!__ok)e.planWait=.4;}");
  return src;
}
const W=loadSet(root,{patch});const {FWorld,FSimulation,FBrain}=W;
for(const [label,idx,opts] of pickScen(filter)){
  for(const k of KEYS)V[k]=0;
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};let stepsDef=0;
  for(let i=0;i<STEPS;i++){drive(i,input);const d0=V.def;sim.step(1/60,input);if(V.def>d0)stepsDef++;s.events.length=0;if(s.dead)break;}
  console.log(JSON.stringify({label,driver,steps:STEPS,stepsWithDeferral:stepsDef,...Object.fromEntries(KEYS.map(k=>[k,V[k]]))}));
}
