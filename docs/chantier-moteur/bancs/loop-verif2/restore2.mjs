// LOOP-01 : quelle classe de boîte fait échouer simulation.js:2081 ? (solide de destruction, porte, piège, ascenseur)
import {loadFast,rep,mkWorld,INPUTS} from './fast.mjs';
const [secs='30',list='classic-0,campaign-0,campaign-9,campaign-10',pat='b']=process.argv.slice(2);
const W=loadFast({patch:(n,src)=>n!=='simulation'?src:rep(src,"require(!supportBoxes.some(box=>debrisOverlaps(q,h,box)));",
 "{const __i=supportBoxes.findIndex(box=>debrisOverlaps(q,h,box));if(__i>=0){const box=supportBoxes[__i],n0=savedSolids.length,n1=n0+savedDoors.length,n2=n1+savedTrapBoxes.length;G.__hit={kind:__i<n0?'solide':__i<n1?'porte':__i<n2?'piege':'ascenseur',id:box.id||box.source||box.kind||'',depth:Math.min(q.x+h[0]-box.minX,box.maxX-(q.x-h[0]),q.y+h[1]-box.minY,box.maxY-(q.y-h[1]),q.z+h[2]-box.minZ,box.maxZ-(q.z-h[2])),age:q.age,src:q.source||q.id};}require(__i<0);}")});
const {FSimulation,FBrain}=W,input=INPUTS[pat];
const mk=(w)=>FSimulation.create(w,{armorSystem:true,brain:FBrain.create({mode:'cpu'})});
for(const label of list.split(',')){
  const world=mkWorld(W,label),sim=mk(world),s=sim.state;let t=0,tries=0;const hits=[];
  while(t<+secs&&!s.dead&&!s.won){
    for(let i=0;(i<180||s.player.airborne)&&i<900;i++){sim.step(1/60,input(t));t+=1/60;s.player.hp=Math.max(s.player.hp,60);if(s.dead||s.won)break;}
    if(s.dead||s.won)break;tries++;const snap=JSON.parse(JSON.stringify(sim.snapshot()));W.__hit=null;
    // retire un à un les débris fautifs pour compter combien bloquent ce point de reprise
    let n=0;const kinds={};let maxD=0;
    for(;;){W.__hit=null;const ok=mk(world).restore(JSON.parse(JSON.stringify(snap)),{recover:true});if(ok||!W.__hit)break;n++;kinds[W.__hit.kind]=(kinds[W.__hit.kind]||0)+1;maxD=Math.max(maxD,W.__hit.depth);
      const k=snap.state.rubble.findIndex(q=>q.resting&&(q.source||q.id)===W.__hit.src&&Math.abs(q.age-W.__hit.age)<1e-9);if(k<0){n=-n;break;}snap.state.rubble.splice(k,1);}
    hits.push({t:+t.toFixed(0),fautifs:n,kinds:JSON.stringify(kinds),profMax:+maxD.toFixed(4),rubble:snap.state.rubble.length});
  }
  console.log(label,pat,JSON.stringify(hits));
}
