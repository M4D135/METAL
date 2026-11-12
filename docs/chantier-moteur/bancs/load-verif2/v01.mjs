// LOAD-01 independent check, main realm. usage: node v01.mjs mode spec n
import {loadFast,makeWorld,drive,mkInput,med} from './lib.mjs';
const [mode='walk',spec='l:0',nArg='8']=process.argv.slice(2);
const LINE="              require(!supportBoxes.some(box=>debrisOverlaps(q,h,box)));\n";
const W0=loadFast();
const W1=loadFast({patches:{simulation:[[LINE,""]]}});
const WD=loadFast({patches:{simulation:[[LINE,"              if(supportBoxes.some(box=>debrisOverlaps(q,h,box))){G.__s.overlapFail=(G.__s.overlapFail||0)+1;}\n"],["}catch(_){return false;}","}catch(_){G.__s.err=String(_&&_.message);return false;}"]]}});
const campaign=spec.startsWith('c:');
const opts=W=>{const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true};if(mode==='rocket'){o.inventory=campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false};if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}}return o;};
const w0=makeWorld(W0,spec),w1=makeWorld(W1,spec),wd=makeWorld(WD,spec);
const st={spec,mode,points:0,origOk:0,fixOk:0,fixExact:0,diagOkWithOverlap:0,otherFail:0,overlapRubble:[],rubble:[],resting:[],restoreMs:[]};
function judge(sim){
  const snap=sim.snapshot(),json=JSON.stringify(snap);st.points++;
  st.rubble.push(snap.state.rubble?.length||0);st.resting.push((snap.state.rubble||[]).filter(q=>q.resting).length);
  let t=performance.now();const ok0=W0.FSimulation.create(w0,opts(W0)).restore(JSON.parse(json),{recover:true});st.restoreMs.push(performance.now()-t);if(ok0)st.origOk++;
  const r=W1.FSimulation.create(w1,opts(W1));if(r.restore(JSON.parse(json),{recover:true})){st.fixOk++;if(JSON.stringify(r.snapshot())===json)st.fixExact++;}
  WD.__s.overlapFail=0;WD.__s.err=null;const okd=WD.FSimulation.create(wd,opts(WD)).restore(JSON.parse(json),{recover:true});
  st.overlapRubble.push(WD.__s.overlapFail);if(okd&&WD.__s.overlapFail&&!ok0)st.diagOkWithOverlap++;if(!okd)st.otherFail++;
}
if(mode==='walk'){
  const sim=W0.FSimulation.create(w0,opts(W0)),s=sim.state,input=mkInput();
  for(let i=0;i<300*+nArg;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;if(i%300===299)judge(sim);}
}else{
  const probe=W0.FSimulation.create(w0,opts(W0)),walls=[];
  for(const g of w0.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){
    const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
    for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=probe.ground(x,z);
      if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||probe.blocked(x,z,.28))continue;const hit=probe.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz)});break;}
  }
  // take walls from the END of the list (the first auditor took the first ones)
  for(const wall of walls.slice(-(+nArg))){
    const sim=W0.FSimulation.create(w0,opts(W0)),s=sim.state;Object.assign(s.player,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:0});
    for(let i=0;i<420;i++){sim.step(1/60,i===0?{weapon:2,fire:true}:{});s.events.length=0;}
    if(!s.dead&&s.debris.some(q=>q.structural))judge(sim);
  }
  st.walls=walls.length;
}
console.log(JSON.stringify({...st,restoreMs:+med(st.restoreMs||[0]).toFixed(1)}));
