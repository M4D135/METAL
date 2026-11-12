import {load, loadout} from './lib.mjs';
const root = process.argv[2], W = load(root);
for (const index of (process.argv[3] || '0,1,2').split(',').map(Number)) {
  const t0 = performance.now();
  const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2});
  const gen = performance.now() - t0;
  const L = loadout(W, index);
  const t1 = performance.now();
  const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), ...L});
  const init = performance.now() - t1;
  const s = sim.state, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1), a = world.bossArena;
  const guards = s.enemies.filter(e => e.bossWave);
  console.log(JSON.stringify({index, stage: world.stage, gen: +gen.toFixed(0), init: +init.toFixed(0), arena: a, boss: {id: boss.id, kind: boss.bossKind, scale: boss.bossScale, hp: boss.hp, x: boss.x, z: boss.z, baseY: boss.baseY, y: boss.y},
    guards: guards.map(g => ({id: g.id, type: g.type, wave: g.bossWave, bossId: g.bossId, x: +(g.x - a.x).toFixed(1), z: +(g.z - a.z).toFixed(1), hp: g.hp})),
    meshes: world.meshes.length, colliders: world.colliders.length, enemies: world.enemies.length,
    arenaColliders: world.colliders.filter(c => c.maxX > a.x - 31 && c.minX < a.x + 31 && c.maxZ > a.z - 31 && c.minZ < a.z + 31).length,
    arenaPickups: world.pickups.filter(q => Math.abs(q.x - a.x) < 31 && Math.abs(q.z - a.z) < 31).map(q => ({kind: q.kind, weapon: q.weapon, amount: q.amount, d: +Math.hypot(q.x - a.x, q.z - a.z).toFixed(1)})),
    stats: sim.stats, caps: sim.ammoCaps, inv: s.inventory, equip: s.equipment, adaptation: s.adaptation}));
}
