// Natural-entry probes (line 711): per-tick failures, cold/warm cost of capped A*, and
// whether the stutter lasts while the player stays in the encounter. Pilot "stay": teleport
// on encounter #K trigger at step 60 and stand there (hp floor), firing a little.
// usage: node streak.mjs <repo> <scenario> <encIndex> <steps> [proto flags]
import {loadSet,rep,pickScen,quant} from './lib.mjs';import {protoPatch} from '../ia/proto.mjs';
const [root,filter='v2-w01',encArg='3',stepsArg='3600',flags='']=process.argv.slice(2);
const V=globalThis.__V={calls:[],cur:null,refresh:0};
function patch(src){
  if(flags)src=protoPatch(src,flags);
  src=rep(src,'    function route(e,x,z){',`    function route(e,x,z){const __c={ms:0,pops:0,tests:0,fail:false,from711:__V.in711,astar:false};__V.cur=__c;const __t=performance.now();const __r=__route0(e,x,z);__c.ms=performance.now()-__t;__c.nul=__r===null;__V.cur=null;__V.calls.push(__c);return __r;}
    function __route0(e,x,z){`);
  src=rep(src,'if(bossProgression&&q.naturalEntries){approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);','if(bossProgression&&q.naturalEntries){__V.in711=true;approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);__V.in711=false;');
  if(!flags){
    src=rep(src,'let explored=0,found=false;','__V.cur.astar=true;let explored=0,found=false;');
    src=rep(src,'if(!found)return null;','__V.cur.pops=explored;if(!found){__V.cur.fail=true;return null;}');
    src=rep(src,'if(!(edgeKnown[i]&mask)){edgeKnown[i]|=mask;','if(!(edgeKnown[i]&mask)){__V.cur.tests++;edgeKnown[i]|=mask;');
  }
  src=rep(src,'function refreshNav(reset=true){','function refreshNav(reset=true){if(reset)__V.refresh++;');
  return src;
}
const W=loadSet(root,{patch});const {FWorld,FSimulation,FBrain}=W;
for(const [label,idx,opts] of pickScen(filter)){
  V.calls.length=0;V.in711=false;V.refresh=0;
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const enc=(s.encounters||[]).filter(q=>!w.rooms?.[q.zoneId]?.bossArena),q=enc[+encArg%enc.length];
  const input={moveX:0,moveY:0,sprint:false,fire:false,lookX:0,lookY:0};
  const perStep=[];let pendingSteps=0;
  for(let i=0;i<+stepsArg;i++){
    s.player.hp=Math.max(s.player.hp,60);if(i===60){const P=process.env.POS?process.env.POS.split(',').map(Number):[q.trigger.x,q.trigger.z];s.player.x=P[0];s.player.z=P[1];s.player.y=sim.ground(P[0],P[1]);console.log('player at',P,'y',s.player.y,'trigger box',JSON.stringify(q.trigger),'blocked',sim.blocked(P[0],P[1],.3));}
    input.fire=(i%40)<4;s.player.yaw+=0.01;const n0=V.calls.length;sim.step(1/60,input);s.events.length=0;
    const cs=V.calls.slice(n0);perStep.push({i,f711:cs.filter(c=>c.from711&&c.fail).length,pops:cs.reduce((a,c)=>a+c.pops,0),probes:cs.filter(c=>c.from711).length,nul711:cs.filter(c=>c.from711&&c.nul).length});
    if(q.pendingWave>=0)pendingSteps++;if(s.dead)break;
  }
  const F=V.calls.filter(c=>c.fail&&c.pops>2400),cold=F.filter(c=>c.tests>1000),warm=F.filter(c=>c.tests<50);
  const st=a=>a.length?{n:a.length,min:+Math.min(...a).toFixed(2),p25:+quant(a,.25).toFixed(2),p50:+quant(a,.5).toFixed(2)}:{n:0};
  const tick=perStep.filter(r=>r.f711>0);let streak=0,best=0,prev=-99;for(const r of tick){streak=r.i-prev<=14?streak+1:1;best=Math.max(best,streak);prev=r.i;}
  console.log(JSON.stringify({label,flags:flags||'base',enc:q.id,trigger:[q.trigger.x,q.trigger.z],status:q.status,pendingWave:q.pendingWave,pendingSteps,steps:perStep.length,probes711:perStep.reduce((a,r)=>a+r.probes,0),null711:perStep.reduce((a,r)=>a+r.nul711,0),stepsWith711CapFail:tick.length,first:tick[0]?.i,last:tick.at(-1)?.i,longestStreakTicks:best,maxPopsPerStep:Math.max(...perStep.map(r=>r.pops)),refreshGlobal:V.refresh,
    capFailMsCold:st(cold.map(c=>c.ms)),capFailMsWarm:st(warm.map(c=>c.ms)),capFailTestsCold:cold.length?Math.round(cold.reduce((a,c)=>a+c.tests,0)/cold.length):0,okAstarMs:st(V.calls.filter(c=>c.astar&&!c.fail).map(c=>c.ms)),released:q.waves.map(w=>w.enemyIds.filter(id=>s.enemies[id].encounterReleased).length+'/'+w.enemyIds.length)}));
}
