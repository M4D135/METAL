// Attribution of simulation spikes to navigation work.
// usage: node routeprof.mjs <repo> [steps=1800] [driver=circle|tour] [scenarioFilter]
import {load,drive} from './load.mjs'; import {loadMain} from './loadmain.mjs'; import {instrument,makeCounters} from './instr.mjs'; import {protoPatch} from './proto.mjs';
const root=process.argv[2],STEPS=+process.argv[3]||1800,driver=process.argv[4]||'circle',filter=process.argv[5]||'';
const C=makeCounters(1.5);globalThis.__C=C;
const EXTRA=[['refreshLocal','    function refreshLocal(){'],['labelNav','    function labelNav(){'],['bakeEdges','    function bakeEdges(limit){']];
const P=src=>instrument(process.env.PROTO?protoPatch(src,process.env.PROTO):src,{extraWrap:EXTRA});
const ctx=process.env.REALM==='main'?loadMain(root,{patch:P}):load(root,{patch:P,extra:{__C:C}});console.log('realm',process.env.REALM==='main'?'main':'vm');
const {FWorld,FSimulation,FBrain}=ctx.window;
const SC=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['v2-w01',0,{campaign:true,campaignVersion:2}],['v2-w06',5,{campaign:true,campaignVersion:2}],['v2-w10',9,{campaign:true,campaignVersion:2}],['v2-w16',15,{campaign:true,campaignVersion:2}],['v2-w18',17,{campaign:true,campaignVersion:2}]].filter(s=>s[0].includes(filter));
const summary={};
for(const [label,idx,opts] of SC){
  const w=FWorld.create(96,idx,opts);const brain=FBrain.create({mode:'cpu'});const sim=FSimulation.create(w,{brain});const s=sim.state;
  const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  const enc=(s.encounters||[]).filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let tourAt=0;
  const steps=[];let refreshTotal=0;
  for(let i=0;i<STEPS;i++){
    drive(i,input,s);if(process.env.GOD)s.player.hp=Math.max(s.player.hp,60);
    if(driver==='tour'&&enc.length&&i%420===0){const q=enc[tourAt++%enc.length];s.player.x=q.trigger.x;s.player.z=q.trigger.z;s.player.y=sim.ground(q.trigger.x,q.trigger.z);}
    C.reset();const t0=performance.now();sim.step(1/60,input);const ms=performance.now()-t0;C.close();
    const names={};for(const ev of s.events)names[ev.name]=(names[ev.name]||0)+1;s.events.length=0;
    refreshTotal+=C.refresh;
    steps.push({i,ms,time:{...C.time},calls:{...C.calls},seg:{...C.seg},ground:C.ground,blocked:C.blocked,ray:C.ray,route:C.route,routeNull:C.routeNull,routeDirect:C.routeDirect,routePath:C.routePath,astar:C.astar,astarFail:C.astarFail,explored:C.explored,deferred:C.deferred,refresh:C.refresh,slow:C.slow.splice(0),events:names,
      awake:s.aiStats.awake,combat:s.aiStats.combat,navPending:s.aiStats.navPending});
    if(s.dead||s.won)break;
  }
  const sorted=steps.map(q=>q.ms).sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  const tot=(k)=>steps.reduce((n,q)=>n+(q[k]||0),0);
  const catTot={};for(const st of steps)for(const [k,v] of Object.entries(st.time))catTot[k]=(catTot[k]||0)+v;
  const segTot={};for(const st of steps)for(const [k,v] of Object.entries(st.seg))segTot[k]=(segTot[k]||0)+v;
  summary[label]={steps:steps.length,dead:s.dead,avg:+(tot('ms')/steps.length).toFixed(3),p99:+q(.99).toFixed(2),max:+sorted.at(-1).toFixed(1),over16:steps.filter(q=>q.ms>16).length,over8:steps.filter(q=>q.ms>8).length,
    refreshNav:refreshTotal,route:tot('route'),astar:tot('astar'),astarFail:tot('astarFail'),deferred:tot('deferred'),explored:tot('explored'),ground:tot('ground'),blocked:tot('blocked'),ray:tot('ray'),
    catMs:Object.fromEntries(Object.entries(catTot).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>[k,+v.toFixed(1)])),seg:segTot};
  console.log('=== '+label+' '+JSON.stringify(summary[label]));
  for(const st of [...steps].sort((a,b)=>b.ms-a.ms).slice(0,5)){
    const top=Object.entries(st.time).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>k+':'+v.toFixed(1)).join(' ');
    console.log(`  step ${st.i} ${st.ms.toFixed(1)}ms awake=${st.awake} combat=${st.combat} navPending=${st.navPending} refresh=${st.refresh} route=${st.route}(null ${st.routeNull} direct ${st.routeDirect} path ${st.routePath}) astar=${st.astar} fail=${st.astarFail} explored=${st.explored} deferred=${st.deferred} ground=${st.ground} blocked=${st.blocked} ray=${st.ray}`);
    console.log('    excl ms: '+top);
    console.log('    seg: '+JSON.stringify(st.seg)+' calls: '+JSON.stringify(Object.fromEntries(Object.entries(st.calls).filter(([k])=>['plan','cover','peek','setGoal','perceive','neuralPlan','safeEntry','refreshNav','explode','damageScenery'].includes(k)))));
    console.log('    events: '+JSON.stringify(st.events));
    for(const r of st.slow.sort((a,b)=>b.ms-a.ms).slice(0,4))console.log('    slow route '+JSON.stringify(r));
  }
}
