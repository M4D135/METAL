// Restore twins: the same snapshot restored in place (A) and into a fresh simulation (B),
// then identical inputs. Difference => state neither saved nor reset (e.g. brainCursor).
// Player never fires (no rubble: avoids the unrelated rubble refusal), and is teleported
// next to successive enemies to alert many of them. usage: node twins.mjs <repo> <scenarios> [pre=900] [post=1200]
import {loadSet,rep,pickScen} from './lib.mjs';
const [root,filter='legacy-s2',preArg='900',postArg='1200']=process.argv.slice(2);
const W=loadSet(root,{patch:src=>rep(src,'nav:{cells:nav,','__brainCursor(){return brainCursor;},nav:{cells:nav,')});
for(const brainMode of ['cpu','none'])for(const [label,idx,opts] of pickScen(filter)){
  const w=W.FWorld.create(96,idx,opts);const mk=()=>W.FSimulation.create(w,brainMode==='cpu'?{brain:W.FBrain.create({mode:'cpu'})}:{});
  const A=mk();const s=A.state;const input={moveX:0,moveY:0,sprint:false,fire:false,lookX:0,lookY:0};
  const drive=(sim,i)=>{const st=sim.state;st.player.hp=Math.max(st.player.hp,60);if(i%120===0){const e=st.enemies[(i/120*7)%st.enemies.length];if(i>=+preArg-300)return;const x=e.x+4,z=e.z;if(!sim.blocked(x,z,.3)){st.player.x=x;st.player.z=z;st.player.y=sim.ground(x,z);}}input.moveX=Math.sin(i/50)*.3;};
  for(let i=0;i<+preArg;i++){drive(A,i);if(i===+preArg-240){const p=s.player;for(const e of s.enemies)if(e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<60&&e.type!==3){e.hasMemory=true;e.active=true;e.memory=8;e.lastSeenX=p.x;e.lastSeenZ=p.z;e.lastSeenY=p.y+1.45;e.awareness='investigate';e.alert=.7;e.thinkWait=0;e.planWait=0;}}A.step(1/60,input);s.events.length=0;}
  const eligible=s.enemies.filter(e=>e.hp>0&&e.hasMemory&&!e.sleeping).length,cursor=A.__brainCursor?.();
  const snap=JSON.parse(JSON.stringify(A.snapshot()));const B=mk();const ok=[A.restore(snap),B.restore(snap)];
  let first=-1;
  for(let i=+preArg;i<+preArg+ +postArg;i++){drive(A,i);const ia={...input};drive(B,i);A.step(1/60,ia);B.step(1/60,{...input});A.state.events.length=0;B.state.events.length=0;
    if(first<0){const a=A.state.enemies,b=B.state.enemies;if(a.some((e,k)=>e.x!==b[k].x||e.z!==b[k].z||e.hp!==b[k].hp||e.tactic!==b[k].tactic)||A.state.player.hp!==B.state.player.hp)first=i-+preArg;}}
  const same=JSON.stringify(A.snapshot())===JSON.stringify(B.snapshot());
  console.log(JSON.stringify({label,brain:brainMode,restored:ok,eligibleAtSnapshot:eligible,brainCursorLive:cursor,identicalAfter:same,firstDivergenceStep:first}));
}
