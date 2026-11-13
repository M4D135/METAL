// LOAD-04: anatomy of failed A* searches (cap vs exhausted, repeats), main realm, original code + counters only.
import {loadFast,makeWorld,drive,mkInput} from './lib.mjs';
const specs=process.argv.slice(2);const STEPS=1800;
const P={simulation:[
 ['function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){G.__s.sf++;'],
 ['const stamp=++routeSerial,heap=[];','const __t0=performance.now(),__sf0=G.__s.sf;const stamp=++routeSerial,heap=[];'],
 ['      if(!found)return null;\n      const raw=[];','      G.__s.routes.push({t:s.time,rev:s.destructionRevision,start,end,big:r>.4,id:e.id,type:e.type,explored,found,exhausted:!found&&!heap.length,ms:performance.now()-__t0,sf:G.__s.sf-__sf0});if(!found)return null;\n      const raw=[];'],
 ['if(d.open&&!was){navDirty=true;','if(d.open&&!was){G.__s.doorOpens=(G.__s.doorOpens||0)+1;navDirty=true;'],
]};
const W=loadFast({patches:P});
for(const spec of specs){
  const world=makeWorld(W,spec);const prof=[];let R=null;
  for(let rep=0;rep<2;rep++){
    W.__s.sf=0;W.__s.routes=[];W.__s.doorOpens=0;
    const sim=W.FSimulation.create(world,{brain:W.FBrain.create({mode:'cpu'}),armorSystem:true}),s=sim.state,input=mkInput();
    for(let i=0;i<STEPS;i++){drive(i,input,s);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
    const r=W.__s.routes;if(!R)R=r.map(x=>({...x}));else r.forEach((x,i)=>{R[i].ms=Math.min(R[i].ms,x.ms);});
  }
  const fail=R.filter(x=>!x.found),cap=fail.filter(x=>!x.exhausted),exh=fail.filter(x=>x.exhausted);
  // repeats: same (start,end,big) failing again within the same destruction revision
  const seen=new Map();let repMs=0,repN=0,repSf=0;for(const x of R){const k=x.rev+'|'+x.start+'|'+x.end+'|'+x.big;if(!x.found){if(seen.has(k)){repN++;repMs+=x.ms;repSf+=x.sf;}else seen.set(k,1);}}
  // same end + same enemy (start may move by a cell)
  const seen2=new Map();let rep2N=0,rep2Ms=0;for(const x of R){const k=x.rev+'|'+x.id+'|'+x.end;if(!x.found){if(seen2.has(k)){rep2N++;rep2Ms+=x.ms;}else seen2.set(k,1);}}
  const sum=a=>+a.reduce((v,x)=>v+x.ms,0).toFixed(1);
  console.log(JSON.stringify({spec,astar:R.length,found:R.length-fail.length,failed:fail.length,failedAtCap:cap.length,failedExhausted:exh.length,exhaustedExplored:exh.map(x=>x.explored).slice(0,12),msAll:sum(R),msFailed:sum(fail),msCap:sum(cap),msExh:sum(exh),msMax:+Math.max(0,...R.map(x=>x.ms)).toFixed(1),sfAll:R.reduce((v,x)=>v+x.sf,0),sfTotal:W.__s.sf,repeatsExactKey:repN,repeatsExactMs:+repMs.toFixed(1),repeatsExactSf:repSf,repeatsSameEnemyEnd:rep2N,repeatsSameEnemyEndMs:+rep2Ms.toFixed(1),big:R.filter(x=>x.big).length,doorOpens:W.__s.doorOpens,enemiesFailing:new Set(fail.map(x=>x.id)).size}));
}
