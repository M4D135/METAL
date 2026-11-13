// Vérifie la règle dans la copie de travail (R) contre l'origine (O) : mur, porte, événements, états sauvegardés.
import {loadFast,loadRoot,loadoutV2} from './lib.mjs';
const O=loadFast(),R=loadRoot(new URL('./work',import.meta.url).pathname),INDEX=11;
function setup(W){const world=W.FWorld.create(96,INDEX,{campaign:true,campaignVersion:2}),sim=W.FSimulation.create(world,{...loadoutV2(W,INDEX),armorSystem:true});for(const e of sim.state.enemies)e.sleeping=true;return {world,sim};}
function shoot(sim,weapon,target,from,shots,yAim){
  const s=sim.state,p=s.player;sim.selectWeapon(weapon);const ev={};const input={moveX:0,moveY:0,fire:true,lookX:0,lookY:0};const s0=s.shots;let steps=0;
  while(s.shots-s0<shots&&steps<6000){p.x=from.x;p.z=from.z;p.y=from.y;p.yaw=Math.atan2(target.x-p.x,-(target.z-p.z));p.pitch=Math.atan2(yAim-(p.y+1.62),Math.hypot(target.x-p.x,target.z-p.z));p.heat=0;p.overheated=false;p.hp=100;if(weapon!==4)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];
    for(const e of s.enemies)e.sleeping=true;sim.step(1/60,input);steps++;for(const e of s.events)ev[e.name+(e.deflected?'(dévié)':'')]=(ev[e.name+(e.deflected?'(dévié)':'')]||0)+1;s.events.length=0;}
  input.fire=false;for(let i=0;i<200;i++){for(const e of s.enemies)e.sleeping=true;sim.step(1/60,input);for(const e of s.events)ev[e.name+(e.deflected?'(dévié)':'')]=(ev[e.name+(e.deflected?'(dévié)':'')]||0)+1;s.events.length=0;}
  return {ev,steps};
}
for(const [name,W] of [['O',O],['R',R]]){
  // 1) porte fermée (mécanisme inactif)
  {const {world,sim}=setup(W),s=sim.state,d=s.doors[0],thinX=d.w<d.d;let from=null;
    for(const side of [-1,1]){const q={x:d.x+(thinX?side*4:0),z:d.z+(thinX?0:side*4)};q.y=sim.ground(q.x,q.z);if(Number.isFinite(q.y)&&Math.abs(q.y-(d.y||0))<.3&&!sim.blocked(q.x,q.z,.28,q.y)){from=q;break;}}
    const a=shoot(sim,0,{x:d.x,z:d.z},from,40,(d.y||0)+1.3),hpBullets=d.hp,destroyedBullets=d.destroyed;
    const b=shoot(sim,2,{x:d.x,z:d.z},from,1,(d.y||0)+1.3);
    console.log(name,'porte : 40 balles de mitraillette → pv',hpBullets,'détruite',destroyedBullets,'| événements',JSON.stringify(a.ev),'| puis 1 roquette → pv',d.hp,'détruite',d.destroyed);}
  // 2) mur de salle : 80 balles de mitraillette puis instantané
  {const {world,sim}=setup(W),s=sim.state;let pick=null;
    for(const g of world.destructibles){if(!g.colliders.length||g.kind!=='wall')continue;const c=world.colliders[g.colliders[0]],m=world.meshes[c.mesh];if(m.mat!==3||m.category)continue;const sx=c.maxX-c.minX,sz=c.maxZ-c.minZ,thinX=sx<sz,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;
      for(const side of [-1,1]){const q={x:cx+(thinX?side*(sx/2+3):0),z:cz+(thinX?0:side*(sz/2+3))};q.y=sim.ground(q.x,q.z);if(Number.isFinite(q.y)&&Math.abs(q.y-c.minY)<.3&&!sim.blocked(q.x,q.z,.28,q.y)){pick={g,from:q,target:{x:cx,z:cz},y:c.minY};break;}}if(pick)break;}
    const rev0=sim.destruction.revision,a=shoot(sim,0,pick.target,pick.from,80,pick.y+1.3),snap=sim.snapshot(),st=snap.destruction.states.find(q=>q.id===pick.g.id);
    console.log(name,'mur   : 80 balles de mitraillette → révisions',sim.destruction.revision-rev0,'| état sauvegardé du mur',JSON.stringify(st?{damage:st.damage,cuts:st.cuts.length}:null),'| événements',JSON.stringify(a.ev),'| gravats',s.debris.filter(q=>q.structural).length,'éclats',s.debris.filter(q=>!q.structural).length);}
}
