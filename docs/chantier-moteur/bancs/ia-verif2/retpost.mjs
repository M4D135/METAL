// returnToPost retry loop: who, where is home, how many identical failed searches.
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,filter='v2-w01',stepsArg='3600']=process.argv.slice(2);
const V=globalThis.__V={rows:new Map(),pops:0,cur:0};
function patch(src){
  src=rep(src,'let explored=0,found=false;','let explored=0,found=false;__V.last=null;');
  src=rep(src,'if(!found)return null;','if(!found){__V.last=explored;return null;}');
  src=rep(src,"const home=world.enemies[e.id];if(e.planWait<=0){if(!setGoal(e,home.x,home.z,'advance',2.4))","const home=world.enemies[e.id];if(e.planWait<=0){__V.last=null;const __ok=setGoal(e,home.x,home.z,'advance',2.4);if(!__ok){const r=__V.rows.get(e.id)||{n:0,astarFails:0,pops:0,first:+s.time.toFixed(1)};r.n++;if(__V.last!==null){r.astarFails++;r.pops+=__V.last;}r.last=+s.time.toFixed(1);r.e=[+e.x.toFixed(1),+e.baseY.toFixed(1),+e.z.toFixed(1)];r.home=[+home.x.toFixed(1),+(home.y??ground(home.x,home.z)).toFixed(1),+home.z.toFixed(1)];r.homeBlocked=blocked(home.x,home.z,radius(e));r.d=+Math.hypot(e.x-home.x,e.z-home.z).toFixed(1);r.deployed=!!e.deployed;__V.rows.set(e.id,r);}if(!__ok)");
  return src;
}
const W=loadSet(root,{patch});
for(const [label,idx,opts] of pickScen(filter)){
  V.rows.clear();const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const s=sim.state;
  const drive=makeDriver('tourx',sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  for(let i=0;i<+stepsArg;i++){drive(i,input);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  console.log(`=== ${label} ENC=${process.env.ENC} OPEN=${process.env.OPEN||''} returning now=${s.enemies.filter(e=>e.hp>0&&e.returning).length}`);
  for(const [id,r] of V.rows)console.log('  enemy '+id+' '+JSON.stringify(r));
}
