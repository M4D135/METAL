// LOOP-V (démo qui dure) : combien de temps survit un pilote automatique dans la vraie simulation ?
// (a,b,c) = entrées aveugles ; (bot) = pilote minimal bâti sur l'API publique seule (state.enemies, sim.sight, sim.nav).
import {loadFast,mkWorld,INPUTS} from './fast.mjs';
const W=loadFast();const {FSimulation,FBrain}=W;
function bot(sim){const s=sim.state,p=s.player;let strafe=1,flip=0;
  return t=>{let best=null,bd=1e9;for(const e of s.enemies){if(e.hp<=0||e.deployed===false)continue;const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd&&d<34){bd=d;best=e;}}
    const inp={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,sprint:false,dash:false,fireLeft:false};
    if(best){const want=Math.atan2(best.x-p.x,-(best.z-p.z));let d=want-p.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));inp.lookX=Math.max(-.09,Math.min(.09,d));
      const seen=sim.sight?sim.sight(p.x,(p.y||0)+1.5,p.z,best.x,(best.y||best.baseY||0)+1,best.z):true;inp.fire=Math.abs(d)<.12&&!!seen;
      if(t>flip){strafe=-strafe;flip=t+.9+((best.id*7)%5)*.2;}inp.moveX=strafe;inp.moveY=bd>9?1:bd<5?-1:0;inp.dash=p.hp<45&&(t%1.6)<1/60;inp.fireLeft=bd<7&&p.hp<70;}
    else{inp.lookX=.012;inp.moveX=Math.sin(t*.667);}
    return inp;};}
const rows=[];
for(const label of ['campaign-0','campaign-3','campaign-9','classic-0']){
  for(const pat of ['a','b','c','bot']){
    const sim=FSimulation.create(mkWorld(W,label),{armorSystem:true,brain:FBrain.create({mode:'cpu'})}),s=sim.state;const f=pat==='bot'?bot(sim):INPUTS[pat];let t=0,minHp=s.player.hp;
    const n0=s.enemies.filter(e=>e.hp>0).length;
    while(t<180&&!s.dead&&!s.won){sim.step(1/60,f(t));t+=1/60;if(s.player.hp<minHp)minHp=s.player.hp;}
    rows.push({monde:label,pilote:pat,fin:s.dead?'mort':s.won?'victoire':'vivant à 180 s',t:+t.toFixed(1),pvMin:+minHp.toFixed(0),tues:n0-s.enemies.filter(e=>e.hp>0).length,ennemis:n0,tirs:s.shots});
  }}
console.table(rows);
