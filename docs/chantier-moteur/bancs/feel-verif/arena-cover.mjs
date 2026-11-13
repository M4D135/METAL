// Real campaign v2 boss arenas: boss kind, arena radius, colliders tall enough to block the ring sight line.
import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
for(const index of [0,1,2,3,6,9,12,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});
  const boss=w.enemies.find(e=>e.boss||e.type===3&&e.arena);if(!boss){console.log(index,'no boss');continue;}
  const a=boss.arena;let cover=0,tall=0;
  for(const c of w.colliders||[]){const cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;if(Math.hypot(cx-a.x,cz-a.z)<a.r){cover++;if((c.maxY??0)-(c.minY??0)>1.2)tall++;}}
  const plat=(w.walkable||[]).filter(q=>Math.hypot(q.x-a.x,q.z-a.z)<a.r&&(q.y||0)>(a.y||0)+1.05).length;
  console.log(`monde ${index}: boss ${boss.bossKind} r=${a.r} colliders dans l'arene ${cover} (dont >1,2 m: ${tall}), sols >1,05 m au-dessus: ${plat}`);
}
