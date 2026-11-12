// How many global refreshNav calls change no collider at all? Signature of the
// collider list before/after each destruction revision; door-driven refreshes counted apart.
// usage: node refresh.mjs <repo> <circle|tour> <steps> <scenarios>
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='circle',stepsArg='1800',filter='legacy-s0']=process.argv.slice(2);const STEPS=+stepsArg;
const V=globalThis.__V={rev:0,revSame:0,door:0,refresh:0,pumpSteps:0,refreshMs:0,ms:[]};
const sig=list=>{let h=list.length;for(const q of list)h=(h*31+Math.round(q.minX*1e3)+Math.round(q.maxX*7e3)+Math.round(q.minZ*13e3)+Math.round(q.maxZ*17e3)+Math.round(q.minY*19e3)+Math.round(q.maxY*23e3))%2147483647;return h;};
globalThis.__sig=sig;
function patch(src){
  src=rep(src,'solids=destruction.colliders;seenDestructionRevision=destruction.revision;','{const __a=__sig(solids),__b=__sig(destruction.colliders);__V.rev++;if(__a===__b)__V.revSame++;}solids=destruction.colliders;seenDestructionRevision=destruction.revision;');
  src=rep(src,"d.open=d.progress>=1;if(d.open&&!was){navDirty=true;","d.open=d.progress>=1;if(d.open&&!was){navDirty=true;__V.door++;");
  src=rep(src,'d.destroyed=true;d.progress=1;d.open=true;navDirty=true;','d.destroyed=true;d.progress=1;d.open=true;navDirty=true;__V.door++;');
  src=rep(src,'if(navDirty){refreshNav();navDirty=terrainDirty=false;}','if(navDirty){const __t=performance.now();refreshNav();__V.refreshMs+=performance.now()-__t;__V.refresh++;navDirty=terrainDirty=false;}');
  return src;
}
const W=loadSet(root,{patch});const {FWorld,FSimulation,FBrain}=W;
for(const [label,idx,opts] of pickScen(filter)){
  for(const k of ['rev','revSame','door','refresh','pumpSteps','refreshMs'])V[k]=0;
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};let pendMax=0,pendSteps=0;
  for(let i=0;i<STEPS;i++){drive(i,input);sim.step(1/60,input);s.events.length=0;if(s.aiStats.navPending>0)pendSteps++;pendMax=Math.max(pendMax,s.aiStats.navPending);if(s.dead)break;}
  console.log(JSON.stringify({label,driver,steps:STEPS,destructionRevisionsSeen:V.rev,revisionsWithIdenticalColliders:V.revSame,doorEvents:V.door,refreshNavCalls:V.refresh,refreshMsTotal:+V.refreshMs.toFixed(1),stepsWithNavPending:pendSteps,navPendingMax:pendMax,navCells:sim.nav.cells.length}));
}
