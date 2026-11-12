import {loadFast,loadoutV2} from './lib.mjs';
const W=loadFast(),world=W.FWorld.create(96,9,{campaign:true,campaignVersion:2}),sim=W.FSimulation.create(world,{...loadoutV2(W,9),armorSystem:true});
const why={};
for(const g of world.destructibles){if(!g.colliders.length)continue;const c=world.colliders[g.colliders[0]],m=world.meshes[c.mesh];if(!(g.kind==='wall'&&m.mat===3&&!m.category))continue;
  const sx=c.maxX-c.minX,sz=c.maxZ-c.minZ,thinX=sx<sz,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;
  for(const side of [-1,1]){const P={x:cx+(thinX?side*(sx/2+3):0),z:cz+(thinX?0:side*(sz/2+3))},Q={x:cx-(thinX?side*(sx/2+3):0),z:cz-(thinX?0:side*(sz/2+3))};
    const yP=sim.ground(P.x,P.z),yQ=sim.ground(Q.x,Q.z);let r;
    if(!Number.isFinite(yP)||!Number.isFinite(yQ))r='sol absent';else if(Math.abs(yP-c.minY)>.3)r='base≠sol '+(yP-c.minY).toFixed(2);else if(Math.abs(yQ-yP)>.3)r='dénivelé '+(yQ-yP).toFixed(2);else if(sim.blocked(P.x,P.z,.28,yP))r='P bloqué';else if(sim.blocked(Q.x,Q.z,.28,yQ))r='Q bloqué';else r='ok';
    why[r]=(why[r]||0)+1;}
}
console.log(why);
