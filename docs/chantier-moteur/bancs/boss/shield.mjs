// Le bouclier levé face au colosse protège-t-il de chaque famille d'attaque ?
// Joueur à 15 m, bouclier levé en continu (fireLeft), regard sur le cœur (cas réel de visée) ou à l'horizontale.
import {load, loadout, corePoint, aimAt} from './lib.mjs';
const [root] = process.argv.slice(2);
const W = load(root), dt = 1 / 60, rows = [];
for (const [index, step, kind] of [[0, 0, 'slam'], [0, 1, 'ring'], [1, 0, 'rocketZone'], [1, 1, 'sweep']]) for (const look of ['core', 'horizon', 'down']) for (const shield of [true, false]) {
  const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
  const L = loadout(W, index);
  const sim = W.FSimulation.create(world, {...L}); // script pur (sans réseau) pour forcer la famille
  const s = sim.state, p = s.player, A = world.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
  if (!shield) s.equipment.left = null;
  Object.assign(p, {x: A.x - 15, y: A.y, z: A.z, yaw: Math.PI / 2, pitch: 0}); sim.step(0, {});
  boss.bossStep = step; boss.bossClock = 0; boss.weakPointOpen = false; boss.weakTimer = 0; s.events.length = 0;
  let hp0 = p.hp, blocks = 0, absorbed = 0, attacks = new Set(), t = 0;
  for (let i = 0; i < 6 / dt; i++) {
    if (look === 'core') { const c = corePoint(boss); aimAt(p, c.x, c.y, c.z); } else if (look === 'horizon') { aimAt(p, boss.x, p.y + 1.62, boss.z); } else { aimAt(p, boss.x, p.y + 1.62, boss.z); p.pitch = -.6; }
    const keep = {x: p.x, z: p.z};
    sim.step(dt, {fireLeft: shield}); p.x = keep.x; p.z = keep.z; // joueur immobile : on mesure la protection, pas l'esquive
    for (const a of s.bossAttacks) attacks.add(a.kind);
    for (const e of s.events) if (e.name === 'shieldBlock') { blocks++; absorbed += e.absorbed; }
    s.events.length = 0;
    if (s.bossAttacks.length === 0 && attacks.size && i * dt > 1) break;
  }
  rows.push({kind, attacks: [...attacks].join('+'), look, shield, pitchDeg: +(p.pitch * 180 / Math.PI).toFixed(0), damage: +(hp0 - p.hp).toFixed(1), blocks, absorbed: +absorbed.toFixed(1), energy: +(s.shield?.energy ?? 0).toFixed(0)});
}
for (const r of rows) console.log(JSON.stringify(r));
