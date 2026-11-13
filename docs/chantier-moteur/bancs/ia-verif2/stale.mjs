// (1) Stale A* edge cache: every 30 steps, re-evaluate every cached edge bit with a fresh
//     segmentFree(.4) and count mismatches (cache says X, world now says Y), split by
//     proximity to a trap box / door box. A restored simulation re-tests edges fresh.
// (2) Restore twins: the SAME snapshot restored in place (A) and into a fresh simulation (B);
//     both then get identical inputs. Any difference comes from state that snapshot/restore
//     neither saves nor resets.
// usage: node stale.mjs <repo> <driver> <steps> <scenarios> [twinSteps=1200]
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='tour',stepsArg='3600',filter='v2-w10',twinArg='1200']=process.argv.slice(2);const STEPS=+stepsArg;
const expose=src=>rep(src,'nav:{cells:nav,',`__staleScan(){let known=0,stale=0,staleTrap=0,staleDoor=0;const near=(L,x,z)=>L.some(q=>x>q.minX-1.4&&x<q.maxX+1.4&&z>q.minZ-1.4&&z<q.maxZ+1.4);
      for(let i=0;i<nav.length;i++){const m=edgeKnown[i];if(!m)continue;const ix=i%nx;for(let k=0;k<4;k++){if(!(m&(1<<k)))continue;const j=k===0?i-1:k===1?i+1:k===2?i-nx:i+nx;if(j<0||j>=nav.length||(k===0&&!ix)||(k===1&&ix===nx-1))continue;known++;
        const [ax,az]=coord(i),[bx,bz]=coord(j);const now=segmentFree(ax,az,bx,bz,.4),was=!!(edgeOpen[i]&(1<<k));if(now!==was){stale++;const mx=(ax+bx)/2,mz=(az+bz)/2;if(near(trapBoxes,mx,mz))staleTrap++;else if(near(doorBoxes,mx,mz))staleDoor++;}}}
      return {known,stale,staleTrap,staleDoor,traps:trapBoxes.length};},__brainCursor(){return brainCursor;},nav:{cells:nav,`);
const W=loadSet(root,{patch:expose});const {FWorld,FSimulation,FBrain}=W;
for(const [label,idx,opts] of pickScen(filter)){
  const w=FWorld.create(96,idx,opts);const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(w,{brain});const s=sim.state;
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  let maxStale=0,sumStale=0,scans=0,trapS=0,doorS=0,known=0;
  for(let i=0;i<STEPS;i++){drive(i,input);sim.step(1/60,input);s.events.length=0;
    if(i%30===29){const r=sim.__staleScan();scans++;sumStale+=r.stale;maxStale=Math.max(maxStale,r.stale);trapS+=r.staleTrap;doorS+=r.staleDoor;known+=r.known;}if(s.dead)break;}
  console.log(JSON.stringify({label,driver,steps:STEPS,scans,avgKnownBits:Math.round(known/scans),avgStaleBits:+(sumStale/scans).toFixed(1),maxStaleBits:maxStale,staleNearTrap:trapS,staleNearDoor:doorS,staleOther:sumStale-trapS-doorS}));
  // twins
  const snap=JSON.parse(JSON.stringify(sim.snapshot()));const cursorBefore=sim.__brainCursor();
  const twin=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});
  const okA=sim.restore(snap),okB=twin.restore(snap);
  const dA=makeDriver(driver,sim,w),dB=makeDriver(driver,twin,w),iA={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},iB={...iA};let first=-1;
  for(let i=STEPS;i<STEPS+ +twinArg;i++){dA(i,iA);dB(i,iB);sim.step(1/60,iA);twin.step(1/60,iB);sim.state.events.length=0;twin.state.events.length=0;
    if(first<0){const a=sim.state.enemies,b=twin.state.enemies;if(a.some((e,k)=>e.x!==b[k].x||e.z!==b[k].z||e.hp!==b[k].hp||e.tactic!==b[k].tactic)||sim.state.player.x!==twin.state.player.x)first=i-STEPS;}}
  const same=JSON.stringify(sim.snapshot())===JSON.stringify(twin.snapshot());
  console.log(JSON.stringify({label,twin:'restore-in-place vs fresh+restore',restored:[okA,okB],brainCursorLiveAtSnapshot:cursorBefore,brainCursorFresh:0,eligibleNow:sim.state.enemies.filter(e=>e.hp>0&&e.hasMemory&&!e.sleeping).length,identicalAfter:same,firstDivergenceStep:first}));
}
