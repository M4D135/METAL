// Un garde blessé que le joueur ignore relance-t-il la même recherche A* vouée à l'échec ?
// Garde de vague 1 le plus proche de l'entrée, PV ramenés à 1 (≤ 55 % → cover()), joueur immobile et invulnérable.
import {loadPatched} from './vlib.mjs';
import {PATCHES} from './patches.mjs';
import {loadout} from '../boss/lib.mjs';
const [root, idxArg = '1', secArg = '20', bound = '0', wounded = '1'] = process.argv.slice(2);
const W = loadPatched(root, PATCHES('probe')); if (bound === '1') W.__bound = true; if (bound === 'arena') W.__arenaFilter = true; if (bound === 'height') W.__heightFilter = true;
const index = +idxArg, dt = 1 / 60;
const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...loadout(W, index)});
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
s.equipment.left = null;
Object.assign(p, {x: A.x - 12, y: A.y, z: A.z + 2, yaw: Math.PI / 2, pitch: 0}); sim.step(0, {}); s.events.length = 0;
const guards = s.enemies.filter(e => e.bossWave && e.bossId === boss.id).sort((a, b) => Math.hypot(a.x - (A.x - 29.4), a.z - (A.z + 7)) - Math.hypot(b.x - (A.x - 29.4), b.z - (A.z + 7)));
for (const g of guards.slice(0, +wounded)) { g.bossReleased = true; g.sleeping = false; g.hp = 1; }
const times = [];
for (let i = 0; i < +secArg / dt; i++) {
  const c0 = process.threadCpuUsage(); sim.step(dt, {}); const cu = process.threadCpuUsage(c0); times.push((cu.user + cu.system) / 1000);
  p.hp = s.maxHp; p.x = A.x - 12; p.z = A.z + 2; s.events.length = 0;
}
const log = W.__log || [];
const fails = log.filter(r => !r.found);
const big = times.map((v, i) => [i, v]).filter(([, v]) => v > 8);
console.log(JSON.stringify({index, bound, wounded: +wounded, routes: log.length, failed: fails.length, failMsTotal: +fails.reduce((a, r) => a + r.ms, 0).toFixed(0), failTimes: fails.map(r => r.t).slice(0, 30), targets: [...new Set(fails.map(r => (r.to[0] - A.x).toFixed(2) + ',' + (r.to[1] - A.z).toFixed(2)))], stepsOver8ms: big.length, maxCpuMs: +Math.max(...times).toFixed(1), guardsAlive: guards.slice(0, +wounded).map(g => g.hp > 0)}));
