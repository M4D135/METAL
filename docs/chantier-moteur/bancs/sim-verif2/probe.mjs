// SIM-12 / SIM-08 / SIM-13 / SIM-01 probes on the ORIGINAL code (instrumented in memory): per-step CPU, route work counters,
// destruction revisions vs boxes really changed, array growth. Uses round-1 pilot (drive) so step indices are comparable.
import {loadMain,make,pilot} from './load.mjs';
const R=globalThis.__R={seg:0,routes:0,explored:0,routeCpu:0,revs:0,revNoChange:0,revChanged:[],syncCpu:0,dmgCpu:0,dmgCalls:0,navQueued:0};
const key=q=>q.minX+','+q.maxX+','+q.minY+','+q.maxY+','+q.minZ+','+q.maxZ;
R.rev=(a,c)=>{R.revs++;const m=new Map();for(const q of a){const k=key(q);m.set(k,(m.get(k)||0)+1);}let ch=0;for(const q of c){const k=key(q),n=m.get(k)||0;if(n)m.set(k,n-1);else ch++;}for(const n of m.values())ch+=n;if(!ch)R.revNoChange++;R.revChanged.push(ch);};
const cpuNow=()=>{const c=process.cpuUsage();return (c.user+c.system)/1000;};R.cpu=cpuNow;
const patches={simulation:[
 ['function route(e,x,z){','function route(e,x,z){const __c=__R.cpu();try{return route0(e,x,z);}finally{__R.routeCpu+=__R.cpu()-__c;__R.routes++;}}function route0(e,x,z){'],
 ['function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){__R.seg++;'],
 ['if(!found)return null;\n      const raw=[]','__R.explored+=explored;if(!found)return null;\n      const raw=[]'],
 ['solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;unsupportedBodies();','{const __c=__R.cpu();__R.rev(solids,destruction.colliders);const __d=__R.cpu();solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;unsupportedBodies();__R.syncCpu+=__R.cpu()-__d;}'],
 ['function damageScenery(point,power,r=0,direction,ignoreId){','function damageScenery(point,power,r=0,direction,ignoreId){const __c=__R.cpu();try{return damageScenery0(point,power,r,direction,ignoreId);}finally{__R.dmgCpu+=__R.cpu()-__c;__R.dmgCalls++;}}function damageScenery0(point,power,r=0,direction,ignoreId){'],
]};
const W=loadMain(patches);const drive=(i,input,s)=>{input.moveX=Math.sin(i/90);input.moveY=1;input.sprint=true;input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;};
const STEPS=+process.env.STEPS||1800,MINE=process.env.PILOT==='mine';
for(const t of (process.env.SCEN||'0,2,c9,c15').split(',')){
  const campaign=t[0]==='c',index=+(campaign?t.slice(1):t);
  for(let rep=0;rep<2;rep++){ // rep 0 warms the JIT, rep 1 is reported
    const {sim}=make(W,index,campaign),s=sim.state,inp={};Object.assign(R,{seg:0,routes:0,explored:0,routeCpu:0,revs:0,revNoChange:0,revChanged:[],syncCpu:0,dmgCpu:0,dmgCalls:0});
    const rows=[];let total=0,routeTotal=0,maxLen={loot:0,debris:0,particles:0,projectiles:0,explosions:0,bullets:0};let pendSteps=0;
    for(let i=0;i<STEPS;i++){
      if(MINE){pilot(i,inp,s,[2,0,3,1]);if(s.player.hp<40)s.player.hp=100;}else drive(i,inp,s);
      const seg0=R.seg,ex0=R.explored,rc0=R.routeCpu,rt0=R.routes,c0=cpuNow();sim.step(1/60,inp);const c=cpuNow()-c0;total+=c;routeTotal+=R.routeCpu-rc0;
      rows.push([i,c,R.routeCpu-rc0,R.seg-seg0,R.explored-ex0,R.routes-rt0,s.events.map(e=>e.name).filter(n=>n==='waveStart'||n==='materialBreak').join('+')]);
      if(s.aiStats.navPending>0)pendSteps++;
      for(const k in maxLen)maxLen[k]=Math.max(maxLen[k],(s[k]||[]).length);s.events.length=0;if(s.dead||s.won)break;
    }
    if(rep===0)continue;
    rows.sort((a,b)=>b[1]-a[1]);
    console.log(`== ${t}: steps=${rows.length} cpu total ${total.toFixed(0)} ms, route ${routeTotal.toFixed(0)} ms (${(100*routeTotal/total).toFixed(0)}%) routes=${R.routes} | revisions=${R.revs} unchangedBoxes=${R.revNoChange} changedPerRev=[${R.revChanged.join(',')}] syncCpu=${R.syncCpu.toFixed(1)} ms dmgScenery calls=${R.dmgCalls} cpu=${R.dmgCpu.toFixed(1)} ms | navPendingSteps=${pendSteps} | maxLen ${JSON.stringify(maxLen)}`);
    console.log('   top steps by CPU [step cpuMs routeCpuMs segFree explored routes ev]: '+rows.slice(0,8).map(r=>`${r[0]}:${r[1].toFixed(1)}/${r[2].toFixed(1)}/${r[3]}/${r[4]}/${r[5]}${r[6]?'/'+r[6]:''}`).join('  '));
    const bySeg=rows.slice().sort((a,b)=>b[3]-a[3]).slice(0,5);console.log('   top steps by segmentFree count: '+bySeg.map(r=>`${r[0]}:seg=${r[3]} expl=${r[4]} cpu=${r[1].toFixed(1)}`).join('  '));
  }
}
