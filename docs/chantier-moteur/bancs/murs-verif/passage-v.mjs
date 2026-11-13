// Nombre de tirs RÉELS (chaîne fire() de simulation.js) pour ouvrir un passage franchissable à travers un mur de salle.
// usage : node passage.mjs <O|R>   (O = METAL 673d6b2, R = copie de travail avec la règle)
import {loadFast,loadRoot,loadoutV2} from '../murs/lib.mjs';
const mode=process.argv[2]||'O',W=mode==='R'?loadRoot((process.env.METAL_BANCS||process.cwd()+'/docs/chantier-moteur/bancs')+'/murs/work'):loadFast();
const INDEX=+process.env.INDEX||9,CATS=(process.env.CATS||'mur de salle,linteau/cloison mat0,muret,pilier porteur').split(',');
function candidates(world,sim){
  const out=[];
  for(const g of world.destructibles){
    if(!g.colliders.length)continue;const c=world.colliders[g.colliders[0]],m=world.meshes[c.mesh],sx=c.maxX-c.minX,sz=c.maxZ-c.minZ,h=c.maxY-c.minY;
    const cat=g.kind==='wall'&&m.mat===3&&!m.category?'mur de salle':g.kind==='wall'&&!m.category?'linteau/cloison mat0':m.category==='boundary'&&g.kind==='prop'?'muret':g.kind==='support'&&!m.category&&m.mat===1?'pilier porteur':null;
    if(!cat||!CATS.includes(cat))continue;
    const thinX=sx<sz,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2,len=Math.max(sx,sz);if(cat!=='pilier porteur'&&len<3)continue;
    for(const side of [-1,1]){
      const P={x:cx+(thinX?side*(sx/2+3):0),z:cz+(thinX?0:side*(sz/2+3))},Q={x:cx-(thinX?side*(sx/2+3):0),z:cz-(thinX?0:side*(sz/2+3))};
      const yP=sim.ground(P.x,P.z);if(!Number.isFinite(yP)||Math.abs(yP-c.minY)>.3)continue;
      // côté Q : même niveau de référence que le pied du mur (le sol peut y être 3,5 m plus bas : brèche = vide)
      if(sim.blocked(P.x,P.z,.28,yP)||sim.blocked(Q.x,Q.z,.28,yP))continue;
      // le segment P→Q ne doit être coupé que par ce groupe
      let hits=0,other=false;for(let t=0;t<=1;t+=.02){const x=P.x+(Q.x-P.x)*t,z=P.z+(Q.z-P.z)*t;if(sim.blocked(x,z,.28,yP)){hits++;if(Math.abs((thinX?x-cx:z-cz))>(thinX?sx:sz)/2+.3)other=true;}}
      if(!hits||other)continue;out.push({g,c,cat,P,Q,y:yP,thinX,cx,cz});break;
    }
  }
  return out;
}
const WEAPONS=[['pistolet',4],['mitraillette',0],['pompe',1],['grenade',3],['roquette',2]];
const rows=[];
for(const cat of CATS)for(const [wname,weapon] of WEAPONS){
  const res=[];
  for(let k=0;k<3;k++){
    const world=W.FWorld.create(96,INDEX,{campaign:true,campaignVersion:2}),sim=W.FSimulation.create(world,{...loadoutV2(W,INDEX),armorSystem:true}),s=sim.state,p=s.player;
    const list=candidates(world,sim).filter(q=>q.cat===cat);if(!list.length)break;const q=list[Math.floor(list.length*(k+.5)/3)%list.length];
    for(const e of s.enemies){e.sleeping=true;e.hp=Math.max(e.hp,1);}
    sim.selectWeapon(weapon);p.x=q.P.x;p.z=q.P.z;p.y=q.y;const yaw=Math.atan2(q.cx-p.x,-(q.cz-p.z));
    const passable=()=>{for(let t=0;t<=1;t+=.02){const x=q.P.x+(q.Q.x-q.P.x)*t,z=q.P.z+(q.Q.z-q.P.z)*t;if(sim.blocked(x,z,.28,q.y))return false;}return true;};
    const rev0=sim.destruction.revision,shots0=s.shots;let opened=null,firstRev=null,steps=0;const LIMIT=weapon===3||weapon===2?3:weapon===1?(+process.env.LIMIT1||40):(+process.env.LIMIT||260);
    const input={moveX:0,moveY:0,sprint:false,fire:false,lookX:0,lookY:0};
    while(steps<60*90&&(s.shots-shots0<LIMIT||s.projectiles.length)){
      if(process.env.SLEEP)for(const e of s.enemies)e.sleeping=true;for(const e of s.events)if(['explosion','rocket','grenade'].includes(e.name)&&e.owner!=='player')globalThis.__EV=(globalThis.__EV||0)+1;const n=s.shots-shots0,aimY=q.y+(weapon>=2&&weapon<=3?1.0:(n%2?.55:1.45)),dist=3;p.x=q.P.x;p.z=q.P.z;p.y=q.y;
      p.yaw=yaw+((n%3)-1)*.05*(weapon===4||weapon===0?1:0);p.pitch=Math.atan2(aimY-(q.y+1.62),dist);p.heat=0;p.overheated=false;p.hp=100;
      if(weapon!==4)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];
      input.fire=!opened&&s.shots-shots0<LIMIT&&!((weapon===3||weapon===2)&&s.projectiles.length);sim.step(1/60,input);steps++;s.events.length=0;for(const e of s.enemies)e.sleeping=true;
      if(firstRev===null&&sim.destruction.revision>rev0)firstRev={shots:s.shots-shots0,t:+(steps/60).toFixed(1)};
      if(!opened&&passable()){opened={shots:s.shots-shots0,t:+(steps/60).toFixed(1)};if(weapon!==3&&weapon!==2)break;}
      if(opened&&steps>300)break;
      if((weapon===3||weapon===2)&&opened&&!s.projectiles.length)break;
    }
    res.push({first:firstRev,opened,shots:s.shots-shots0,revs:sim.destruction.revision-rev0,rubble:s.debris.filter(d=>d.structural).length,size:[q.c.maxX-q.c.minX,q.c.maxY-q.c.minY,q.c.maxZ-q.c.minZ].map(v=>+v.toFixed(2)).join('×')});
  }
  const f=res.map(r=>r.first?r.first.shots:'jamais'),o=res.map(r=>r.opened?r.opened.shots+' tirs/'+r.opened.t+' s':'jamais ('+r.shots+' tirs)');
  console.log((mode+' | '+cat).padEnd(28)+wname.padEnd(13)+' 1re coupe après '+f.join(', ')+' tirs | passage ouvert : '+o.join(' ; ')+' | révisions '+res.map(r=>r.revs).join(',')+' | gravats '+res.map(r=>r.rubble).join(',')+' | '+(res[0]?.size||''));
}
