// FEEL-02: effect of player pitch on the real guard (front, fixed, 10 jitters, 20 s, hp pinned)
import {load,rep,flat} from './L.mjs';
const W=load(['destruction','economy','simulation'],(n,src)=>n!=='simulation'?src:rep(src,"if(shieldFacing(source)&&s.shield.energy>0){","if(source&&globalThis.__H)globalThis.__H.push({raised:s.shield.raised,ok:shieldFacing(source)&&s.shield.energy>0});if(shieldFacing(source)&&s.shield.energy>0){"));
const layout=[[-3,-10,0],[0,-12,2],[3,-9,0]];
for(const pitch of [.6,.3,0,-.3,-.45,-.55,-.6,-.9]){let hits=0,ok=0,rz=0;
  for(let j=0;j<10;j++){globalThis.__H=[];const jitter=j*.6;const sim=W.FSimulation.create(flat({enemies:layout.map(([x,z,type],i)=>({x:x+jitter*Math.sin(i*7.1),z:z+jitter*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
    const s=sim.state,p=s.player;p.pitch=pitch;for(let i=0;i<600;i++){sim.step(1/60,{fireLeft:true});s.events.length=0;p.hp=100;s.shield.energy=100;}
    const R=globalThis.__H.filter(h=>h.raised);hits+=R.length;ok+=R.filter(h=>h.ok).length;}
  console.log('pitch',pitch,'rad (',(pitch*57.3).toFixed(0),'deg ): coups garde levee',hits,'bloques',ok,'=',(ok/hits*100).toFixed(0)+'%');}
