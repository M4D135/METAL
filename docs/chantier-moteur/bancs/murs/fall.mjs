// Une brèche dans un mur de salle surélevée ou dans un garde-corps (muret) : le joueur qui la franchit meurt-il ?
import {loadFast,loadoutV2} from './lib.mjs';
const W=loadFast(),INDEX=11;
function tryCat(pick,label,n=4){
  const out=[];
  for(let k=0;k<n;k++){
    const world=W.FWorld.create(96,INDEX,{campaign:true,campaignVersion:2}),sim=W.FSimulation.create(world,{...loadoutV2(W,INDEX),armorSystem:true}),s=sim.state,p=s.player;
    const list=[];
    for(const g of world.destructibles){if(!g.colliders.length)continue;const c=world.colliders[g.colliders[0]],m=world.meshes[c.mesh];if(!pick(g,m,c))continue;
      const sx=c.maxX-c.minX,sz=c.maxZ-c.minZ,thinX=sx<sz,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;
      for(const side of [-1,1]){const P={x:cx+(thinX?side*(sx/2+2.2):0),z:cz+(thinX?0:side*(sz/2+2.2))},Q={x:cx-(thinX?side*(sx/2+2.2):0),z:cz-(thinX?0:side*(sz/2+2.2))},yP=sim.ground(P.x,P.z),yQ=sim.ground(Q.x,Q.z);
        if(Number.isFinite(yP)&&Number.isFinite(yQ)&&Math.abs(yP-c.minY)<.3&&yP-yQ>1.5&&!sim.blocked(P.x,P.z,.28,yP))list.push({g,c,P,Q,yP,yQ,cx,cz});}}
    if(!list.length)break;const q=list[Math.floor(list.length*(k+.5)/n)%list.length];
    for(const e of s.enemies)e.sleeping=true;
    // ouvre la brèche comme le ferait une roquette du joueur au pied du mur
    sim.destruction.blast([q.cx,q.yP+1,q.cz],4.2,55);
    p.x=q.P.x;p.z=q.P.z;p.y=q.yP;p.yaw=Math.atan2(q.Q.x-q.P.x,-(q.Q.z-q.P.z));p.pitch=0;
    const input={moveX:0,moveY:1,sprint:false,fire:false,lookX:0,lookY:0};let reason=null,t=0;
    for(let i=0;i<360&&!s.dead;i++){for(const e of s.enemies)e.sleeping=true;sim.step(1/60,input);t=i/60;for(const ev of s.events)if(ev.name==='dead')reason=ev.reason;s.events.length=0;}
    out.push({chute:+(q.yP-q.yQ).toFixed(2),mort:s.dead,raison:reason,aprèsS:+t.toFixed(2),yFinal:+p.y.toFixed(2)});
  }
  console.log(label,JSON.stringify(out));
}
tryCat((g,m,c)=>g.kind==='wall'&&m.mat===3&&!m.category,'mur de salle surélevée :');
tryCat((g,m,c)=>m.category==='boundary'&&g.kind==='prop','muret garde-corps      :');
