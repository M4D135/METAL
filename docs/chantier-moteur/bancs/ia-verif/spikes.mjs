// Independent spike attribution: per-step wall time vs time spent inside route(),
// A* searches, pops, failures (heap exhausted vs 2400 cap), budget deferrals,
// global refreshNav. Optional exact check of every failed search: uncapped BFS on
// the graph A* sees at that moment (cached bits where known, fresh segmentFree
// otherwise, caches untouched). usage:
//   node spikes.mjs <repo> <circle|tour> <steps> <scenarios> [check] [realm=main|vm]
import {loadSet,rep,pickScen,makeDriver,quant} from './lib.mjs';
const [root,driver='circle',stepsArg='1800',filter='legacy-s0',mode='',realm='main']=process.argv.slice(2);const STEPS=+stepsArg,CHECK=mode==='check';
const V=globalThis.__V={routeMs:0,routeCalls:0,def:0,astar:0,pops:0,fail:0,cap:0,refresh:0,check:CHECK,failInfo:[],slowMax:0};
import {protoPatch} from '../ia/proto.mjs';
function patch(src){
  if(process.env.PROTO)src=protoPatch(src,process.env.PROTO);
  src=rep(src,'    function route(e,x,z){',`    const __vis=new Uint32Array(nav.length),__q=new Int32Array(nav.length);let __stamp=0;
    function __check(e,start,end,r,explored,gx,gz){
      const st=++__stamp;let h=0,t=0,found=false,tests=0;__q[t++]=start;__vis[start]=st;
      while(h<t){const i=__q[h++];if(i===end){found=true;break;}const ix=i%nx;
        for(let k=0;k<4;k++){const j=k===0?(ix?i-1:-1):k===1?(ix<nx-1?i+1:-1):k===2?i-nx:i+nx;if(j<0||j>=nav.length||!nav[j]||__vis[j]===st)continue;
          const mask=1<<k;let open;if(edgeKnown[i]&mask)open=!!(edgeOpen[i]&mask);else{tests++;open=segmentFree(...coord(i),...coord(j),.4);}
          if(!open||r>.4&&!segmentFree(...coord(i),...coord(j),r))continue;__vis[j]=st;__q[t++]=j;}}
      const __sub=i=>{const [qx,qz]=coord(i);return !floors.some(f=>!(f.substrate||f.fallback)&&Math.abs(qx-f.x)<=f.w/2+1e-7&&Math.abs(qz-f.z)<=f.d/2+1e-7);};
      return {found,size:t,explored,tests,endSub:__sub(end),startSub:__sub(start),id:e.id,type:e.type,r,start,end,ey:+(e.baseY??0).toFixed(2),sy:+ground(...coord(start)).toFixed(2),endy:+ground(...coord(end)).toFixed(2),dist:+Math.hypot(gx-e.x,gz-e.z).toFixed(1),t:+s.time.toFixed(2),tactic:e.tactic,seen:e.seen,stack:new Error().stack.split('\\n').slice(4,7).map(l=>l.trim().replace(/^at /,'').replace(/\\(.*simulation\\.js:/,'@').replace(/:\\d+\\)$/,'')).join('<')};
    }
    function route(e,x,z){const __t=performance.now();const __r=__route0(e,x,z);const __d=performance.now()-__t;__V.routeMs+=__d;__V.routeCalls++;if(__d>__V.slowMax)__V.slowMax=__d;return __r;}
    function __route0(e,x,z){`);
  if(!process.env.PROTO)src=rep(src,'if(routeBudget<=0){routeDeferred++;return null;}','if(routeBudget<=0){routeDeferred++;__V.def++;return null;}');
  src=rep(src,'let explored=0,found=false;','__V.astar++;let explored=0,found=false;');
  src=rep(src,'if(!found)return null;','__V.pops+=explored;if(!found){__V.fail++;if(explored>2400)__V.cap++;if(__V.check)__V.failInfo.push(__check(e,start,end,r,explored,x,z));return null;}');
  src=rep(src,'function refreshNav(reset=true){','function refreshNav(reset=true){if(reset)__V.refresh++;');
  return src;
}
const W=loadSet(root,{patch,realm});const {FWorld,FSimulation,FBrain}=W;
const REPS=+(process.env.REPS||1);
for(const [label0,idx,opts] of pickScen(filter).flatMap(x=>Array.from({length:REPS},(_,r)=>[x[0]+(REPS>1?'#'+r:''),x[1],x[2]]))){const label=label0;
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  const rows=[];V.failInfo.length=0;
  for(let i=0;i<STEPS;i++){
    drive(i,input);for(const k of ['routeMs','routeCalls','def','astar','pops','fail','cap','refresh','slowMax'])V[k]=0;const nFail=V.failInfo.length;
    const t0=performance.now();sim.step(1/60,input);const ms=performance.now()-t0;
    const ev={};for(const q of s.events)ev[q.name]=(ev[q.name]||0)+1;s.events.length=0;
    rows.push({i,ms,route:V.routeMs,calls:V.routeCalls,astar:V.astar,pops:V.pops,fail:V.fail,cap:V.cap,def:process.env.PROTO?(s.aiStats.pathDeferred||0):V.def,refresh:V.refresh,awake:s.aiStats.awake,navPending:s.aiStats.navPending,ev,fails:V.failInfo.slice(nFail)});
    if(s.dead)break;
  }
  const ms=rows.map(r=>r.ms),big=rows.filter(r=>r.ms>8);
  const sum=k=>rows.reduce((a,r)=>a+r[k],0);
  const out={label,driver,realm,steps:rows.length,avg:+(sum('ms')/rows.length).toFixed(3),p99:+quant(ms,.99).toFixed(2),p999:+quant(ms,.999).toFixed(2),max:+Math.max(...ms).toFixed(2),over8:big.length,over16:rows.filter(r=>r.ms>16).length,
    routeShareAll:+(sum('route')/sum('ms')*100).toFixed(1),routeShareOver8:big.length?+(big.reduce((a,r)=>a+r.route,0)/big.reduce((a,r)=>a+r.ms,0)*100).toFixed(1):null,
    over8WithFail:big.filter(r=>r.fail>0).length,over8MinRouteShare:big.length?+Math.min(...big.map(r=>r.route/r.ms*100)).toFixed(0):null,
    astar:sum('astar'),fails:sum('fail'),capHits:sum('cap'),heapExhausted:sum('fail')-sum('cap'),deferred:sum('def'),refreshGlobal:sum('refresh'),pops:sum('pops'),
    stepsWith2Fails:rows.filter(r=>r.fail>=2).length};
  console.log(JSON.stringify(out));
  for(const r of [...rows].sort((a,b)=>b.ms-a.ms).slice(0,6))console.log(`  step ${r.i} ${r.ms.toFixed(1)}ms route ${r.route.toFixed(1)}ms (${(r.route/r.ms*100).toFixed(0)}%) astar ${r.astar} fail ${r.fail} cap ${r.cap} pops ${r.pops} def ${r.def} refresh ${r.refresh} navPending ${r.navPending} awake ${r.awake} ev ${JSON.stringify(r.ev)}`);
  if(CHECK){
    const F=rows.flatMap(r=>r.fails.map(f=>({...f,step:r.i})));const cap=F.filter(f=>f.explored>2400),exh=F.filter(f=>f.explored<=2400);
    const sameComp=F.filter(f=>f.found);
    console.log(`  CHECK endOnSubstrate=${F.filter(f=>f.endSub).length} startOnSubstrate=${F.filter(f=>f.startSub).length}`);
    console.log(`  CHECK fails=${F.length} capHit=${cap.length} heapExhausted=${exh.length} reachableAtThatMoment(sameComponent)=${sameComp.length} unreachable=${F.length-sameComp.length}`);
    const pairs=new Map();for(const f of F){const k=f.id+':'+f.start+':'+f.end;pairs.set(k,(pairs.get(k)||0)+1);}
    console.log(`  unique (enemy,start,end)=${pairs.size} maxRepeat=${Math.max(0,...pairs.values())}`);
    const callers={};for(const f of F){const c=f.stack.split('<').slice(0,2).join('<');callers[c]=(callers[c]||0)+1;}
    console.log('  callers '+JSON.stringify(callers));
    for(const f of F.filter(f=>f.explored>2400).slice(0,6))console.log('   capfail '+JSON.stringify({step:f.step,found:f.found,size:f.size,tests:f.tests,id:f.id,type:f.type,ey:f.ey,sy:f.sy,endy:f.endy,dist:f.dist,tactic:f.tactic,seen:f.seen}));
  }
}
