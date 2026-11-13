// Que sépare chaque mur blindé ? Deux zones praticables au même niveau (raccourci), une chute mortelle, ou rien (hors sol).
import {loadFast,loadoutV2} from './lib.mjs';import {classify} from './proto.mjs';
const W=loadFast();
for(const [label,index] of [['v2-w01 (étape 0)',0],['v2-w02 (étape 1)',1],['v2-w03 (étape 2)',2]]){
  const world=W.FWorld.create(96,index,{campaign:true,campaignVersion:2}),sim=W.FSimulation.create(world,{...loadoutV2(W,index),armorSystem:true});
  const tally={};
  for(const g of world.destructibles){if(!g.colliders.length)continue;const q=classify(world,g);const isWall=g.kind==='wall'||q.cat==='boundary';if(!isWall)continue;
    const c=world.colliders[g.colliders[0]],sx=q.sx,sz=q.sz,thinX=sx<sz,cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;
    const side=s=>{const P={x:cx+(thinX?s*(sx/2+1.2):0),z:cz+(thinX?0:s*(sz/2+1.2))},y=sim.ground(P.x,P.z);return {y,free:Number.isFinite(y)&&!sim.blocked(P.x,P.z,.28,y)};};
    const a=side(-1),b=side(1);let r;
    if(!a.free||!b.free)r='un côté obstrué ou hors sol';
    else{const lo=Math.min(a.y,b.y),hi=Math.max(a.y,b.y),base=c.minY;
      if(Math.abs(a.y-b.y)<=.42)r=Math.abs(base-hi)>.6?'mur hors d’atteinte (base '+(base-hi>0?'au-dessus':'au-dessous')+' du sol)':'RACCOURCI de plain-pied';
      else if(hi-lo>1.5)r='CHUTE MORTELLE de '+(hi-lo).toFixed(1)+' m côté bas';else r='marche de '+(hi-lo).toFixed(2)+' m';}
    const key=(g.kind+'|'+(q.cat||'mat'+q.mat)).padEnd(26)+r;tally[key]=(tally[key]||0)+1;}
  console.log('\n'+label);for(const [k,v] of Object.entries(tally).sort())console.log('  '+k.padEnd(72)+v);
}
