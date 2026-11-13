// Phase 2 : intervalle entre les deux fronts d'onde (colosse/veilleur) vs recharge du dash (1,7 s).
import {load, loadout} from './lib.mjs';
const [root, idxArg = '0'] = process.argv.slice(2);
const W = load(root), index = +idxArg, dt = 1 / 60;
const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
const sim = W.FSimulation.create(world, {...loadout(W, index)}); // sans réseau : script pur
const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
Object.assign(p, {x: A.x - 15, y: A.y, z: A.z, yaw: Math.PI / 2}); sim.step(0, {}); boss.hp = boss.maxHp * .3; sim.step(dt, {}); s.events.length = 0;
const fronts = new Map(); const tells = [];
for (let i = 0; i < 40 / dt; i++) {
  sim.step(dt, {}); p.hp = s.maxHp;
  for (const e of s.events) if (e.name === 'bossTell') tells.push({t: +(i * dt).toFixed(2), kind: e.kind, phase: e.phase});
  for (const a of s.bossAttacks) if (a.kind === 'ring' && a.active && !fronts.has(a.id) && a.currentRadius >= Math.hypot(p.x - a.x, p.z - a.z) - .28) fronts.set(a.id, +(i * dt).toFixed(2));
  s.events.length = 0;
}
const f = [...fronts.values()]; const pairs = []; for (let i = 1; i < f.length; i++) if (f[i] - f[i - 1] < 2) pairs.push(+(f[i] - f[i - 1]).toFixed(2));
console.log(JSON.stringify({index, kind: boss.bossKind, phase: boss.phase, tells: tells.slice(0, 8), ringFrontsAtPlayer: f, doubleRingGaps: pairs, dashCooldown: 1.7, dashIFrames: .2}));
