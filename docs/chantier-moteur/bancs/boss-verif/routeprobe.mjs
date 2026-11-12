// Sonde : journalise chaque recherche A* (cible, issue, nœuds, temps) pendant le combat scripté du banc boss.
import {loadPatched} from './vlib.mjs';
import {loadout, corePoint, aimAt} from '../boss/lib.mjs';
const [root, idxArg = '1', secArg = '40', bound = '0'] = process.argv.slice(2);
const P = {simulation: [
  ['let explored=0,found=false;\n      while(heap.length&&explored++<2400){',
   'let explored=0,found=false;const __t0=performance.now();const __lim=G.__bound?Math.min(2400,64+8*heuristic(start)):2400;\n      while(heap.length&&explored++<__lim){'],
  ['      if(!found)return null;\n      const raw=[]',
   '      (G.__log||=[]).push({e:e.id,type:e.type,found,explored,ms:+(performance.now()-__t0).toFixed(2),from:[+e.x.toFixed(1),+e.z.toFixed(1)],to:[+x.toFixed(2),+z.toFixed(2)],endNode:end,endNav:nav[end],t:+s.time.toFixed(2)});\n      if(!found)return null;\n      const raw=[]'],
]};
const W = loadPatched(root, P); if (bound === '1') W.__bound = true;
const index = +idxArg, dt = 1 / 60;
const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...loadout(W, index)});
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
s.equipment.left = null;
Object.assign(p, {x: A.x - 24, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0}); sim.step(0, {}); s.events.length = 0;
let strafe = 1; const times = [];
for (let i = 0; i < +secArg / dt && !s.dead && boss.hp > 0; i++) {
  const open = boss.weakPointOpen, c = open ? corePoint(boss) : {x: boss.x, y: boss.baseY + 2 * boss.bossScale, z: boss.z};
  const guard = s.enemies.filter(e => e.bossWave && e.bossReleased && e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 24).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (guard && !open) aimAt(p, guard.x, guard.y, guard.z); else aimAt(p, c.x, c.y, c.z);
  const rx = p.x - boss.x, rz = p.z - boss.z, rn = Math.max(.01, Math.hypot(rx, rz)), radial = (15 - rn) / 4;
  let mx = -rz / rn * strafe + rx / rn * radial, mz = rx / rn * strafe + rz / rn * radial; if (i % 300 === 0) strafe = -strafe;
  const n = Math.hypot(mx, mz); if (n > 1) { mx /= n; mz /= n; }
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  const t0 = performance.now();
  sim.step(dt, {moveX: mx * cy + mz * sy, moveY: mx * sy - mz * cy, sprint: true, fire: true});
  times.push(performance.now() - t0);
  p.hp = s.maxHp; s.events.length = 0;
}
const log = W.__log || [];
const rel = r => ({...r, toRel: [+(r.to[0] - A.x).toFixed(2), +(r.to[1] - A.z).toFixed(2)], fromRel: [+(r.from[0] - A.x).toFixed(1), +(r.from[1] - A.z).toFixed(1)]});
const sorted = times.slice().sort((a, b) => a - b);
console.log(JSON.stringify({index, bound, routes: log.length, failed: log.filter(r => !r.found).length, worst: log.sort((a, b) => b.ms - a.ms).slice(0, 5).map(rel), maxStep: +sorted.at(-1).toFixed(1), p99: +sorted[Math.floor(sorted.length * .99)].toFixed(2), bossHp: +boss.hp.toFixed(1)}, null, 1));
