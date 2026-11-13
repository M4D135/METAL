// Lamelle de 4 cm laissée par une coupe de balle (0.8.0) : bloque-t-elle à pied ? en sautant ? avec le clip SAUT-01 ?
import {loadFast,WORLDS} from '../saut/lib.mjs';import {physPatches} from '../saut/phys.mjs';
function proposalPatches(){const P=physPatches({});const a=P.simulation.find(([f])=>typeof f==='string'&&f.startsWith('function actorBlocked'));
  a[1]+=`
      if(e===p&&Q&&__clipOn){if(!__clipIds)__clipIds=new Set((world.outdoorBoundaries||[]).map(b=>world.meshes[b.mesh]?.destructibleId).filter(v=>v!==undefined));
        for(const q of localSolids(x,z))if(q.destructibleId!==undefined&&__clipIds.has(q.destructibleId)&&q.minY<y+1.8&&discBox(x,z,r,q))return true;}`;
  const v=P.simulation.find(([f])=>typeof f==='string'&&f.startsWith('let velocityX=0'));v[1]+='let __clipIds=null,__clipOn=false;';
  const r=P.simulation.find(([f])=>typeof f==='string'&&f.startsWith('return {state:s'));r[1]=r[1].replace('return {__I,','__I.clipOn=v=>{__clipOn=v;};return {__I,');return P;}
const W0=loadFast(),WP=loadFast({patches:proposalPatches()});
for(const label of ['v2-00','v2-02']){const e=WORLDS.find(w=>w[0]===label);
  for(const [name,W,clip,jump] of [['0.8.0 à pied',W0,false,false],['prototype, à pied',WP,false,false],['prototype, en sautant, sans clip',WP,false,true],['prototype, en sautant, clip SAUT-01',WP,true,true]]){
    const world=W.FWorld.create(96,e[1],e[2]);const authored=(x,z)=>world.walkable.some(f=>!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
    const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;if(sim.__I?.clipOn)sim.__I.clipOn(clip);
    const w=world.outdoorBoundaries.map(b=>world.colliders.find(c=>c.mesh===b.mesh)).filter(c=>Math.abs(c.minY-p.y)<.1).map(c=>({c,cx:(c.minX+c.maxX)/2,cz:(c.minZ+c.maxZ)/2,alongX:(c.maxX-c.minX)>(c.maxZ-c.minZ)})).map(w=>({...w,d:Math.hypot(w.cx-p.x,w.cz-p.z)})).sort((a,b)=>a.d-b.d)[0];
    const side=-1,ix=w.alongX?w.cx:w.cx+side*2.5,iz=w.alongX?w.cz+side*2.5:w.cz;p.x=ix;p.z=iz;p.yaw=Math.atan2(w.cx-ix,-(w.cz-iz));const H=w.c.maxY-w.c.minY;
    // même tir dans les 4 variantes : visée basse fixe (y = 0,15 m), 3 s, immobile
    for(let i=0;i<180;i++){p.pitch=Math.atan2(w.c.minY+.15-(p.y+1.62),2.24);sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:0});s.events.length=0;p.hp=sim.stats.maxHp;}
    const id=world.meshes[w.c.mesh].destructibleId;const left=sim.destruction.colliders.filter(q=>q.destructibleId===id&&q.maxX-q.minX<2&&q.maxZ-q.minZ<2).map(q=>[(q.maxX-q.minX).toFixed(2),q.minY.toFixed(2)+'-'+q.maxY.toFixed(2),(q.maxZ-q.minZ).toFixed(2)].join('x'));
    p.pitch=0;let out=false;for(let k=0;k<300&&!s.dead;k++){sim.step(1/60,{moveX:0,moveY:1,sprint:true,jump:jump&&k%2===0});s.events.length=0;p.hp=sim.stats.maxHp;if(!p.airborne&&!authored(p.x,p.z)&&Math.abs(p.y+.25)<.05){out=true;break;}}
    console.log(label,'h',H.toFixed(2),'|',name,'| restes dans la brèche',left.join(' ')||'aucun','| traverse',out,'mort',s.dead);
  }
}
