// Remplacements en mémoire appliqués à src/simulation.js pour les sondes (jamais écrits dans le dépôt).
import {timerPatches} from './timers.mjs';
const probe = [
  ['let explored=0,found=false;\n      while(heap.length&&explored++<2400){',
   'let explored=0,found=false;const __t0=performance.now();let __known=0;for(let k=0;k<edgeKnown.length;k++)if(edgeKnown[k])__known++;const __lim=G.__bound?Math.min(2400,64+8*heuristic(start)):2400;\n      while(heap.length&&explored++<__lim){'],
  ['      if(!found)return null;\n      const raw=[]',
   '      (G.__log||=[]).push({e:e.id,type:e.type,found,explored,ms:+(performance.now()-__t0).toFixed(2),knownBefore:__known,from:[+e.x.toFixed(1),+e.z.toFixed(1)],to:[+x.toFixed(2),+z.toFixed(2)],endNav:nav[end],startNav:nav[start],tactic:e.tactic,t:+s.time.toFixed(2),tdy:+(groundAt(x,z)-e.baseY).toFixed(2),caller:(new Error().stack.split(String.fromCharCode(10))[3]||String()).trim().split(String.fromCharCode(32))[1]});\n      if(!found)return null;\n      const raw=[]'],
  ['      if(navDirty){refreshNav();navDirty=terrainDirty=false;}', '      if(navDirty){(G.__refresh||=[]).push(+s.time.toFixed(2));if(!(G.__solidOnly&&G.__lastSolidSame)){refreshNav();}navDirty=terrainDirty=false;}'],
];
const nowipe = [['      edgeKnown.fill(0);edgeOpen.fill(0);if(reset)for(const e of s.enemies)', '      if(!G.__nowipe){edgeKnown.fill(0);edgeOpen.fill(0);}if(reset)for(const e of s.enemies)']];
const solidsig = [['      solids=destruction.colliders;seenDestructionRevision=destruction.revision;', '      {const __h=a=>{let h=a.length;for(const c of a)h=(h*31+Math.round((c.minX+c.maxX*3+c.minY*7+c.maxY*11+c.minZ*13+c.maxZ*17)*100))%1000000007;return h;};const __same=__h(solids)===__h(destruction.colliders);G.__lastSolidSame=__same;(G.__rev||=[]).push({t:+s.time.toFixed(2),solidChanged:!__same,before:solids.length,after:destruction.colliders.length});}\n      solids=destruction.colliders;seenDestructionRevision=destruction.revision;']];
const debrisCount = [['    function updateDebris(dt){\n', '    function updateDebris(dt){(G.__deb||=[0,0,0]);G.__deb[0]++;G.__deb[1]+=s.debris.length;for(const q of s.debris)if(q.resting)G.__deb[2]++;\n']];
// Variante expérimentale : une pièce au repos n'est pas revérifiée tant que la révision de destruction ne change pas.
const sleep = [['        let h=debrisHalf(q),boxes=debrisBoxes(q,h,Math.hypot(q.vx,q.vz)*dt+.1,dynamic);\n        if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes)))continue;q.resting=false;q.settleTime=0;}',
                '        if(q.resting&&G.__sleep&&q.__rev===s.destructionRevision)continue;\n        let h=debrisHalf(q),boxes=debrisBoxes(q,h,Math.hypot(q.vx,q.vz)*dt+.1,dynamic);\n        if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes))){q.__rev=s.destructionRevision;continue;}q.resting=false;q.settleTime=0;}']];
const arenaFilter = [['          if(d<.35||d>10||blocked(cx,cz,.4)||', '          if(d<.35||d>10||(G.__heightFilter&&Math.abs(groundAt(cx,cz)-e.baseY)>.6)||(G.__arenaFilter&&world.bossArena&&Math.max(Math.abs(cx-world.bossArena.x),Math.abs(cz-world.bossArena.z))>29.4&&Math.max(Math.abs(e.x-world.bossArena.x),Math.abs(e.z-world.bossArena.z))<29.4)||blocked(cx,cz,.4)||']];
export function PATCHES(variant) {
  const timers = timerPatches(['updateDebris', 'pumpNav', 'updateEnemies', 'updateBossAttacks', 'tickBoss', 'updateProjectiles', 'refreshNav', 'step']);
  return {simulation: [...probe, ...nowipe, ...solidsig, ...debrisCount, ...sleep, ...arenaFilter, ...timers]};
}
