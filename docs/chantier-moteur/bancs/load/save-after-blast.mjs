// Cost of the shell's saveCheckpoint() (snapshot + JSON.stringify) right after a rocket breach (nav still pending), vs idle.
// usage: [SRC=dir] node save-after-blast.mjs <ferroRoot> [spec=l:0] [walls=4]
import {load, now} from './lib.mjs';
const [root, spec = 'l:0', wallsArg = '4'] = process.argv.slice(2);
const W = load(root);
const world = W.FWorld.create(96, +spec.split(':')[1]);
const inventory = {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const mk = () => W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory});
const probe = mk(), walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) { const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x, z, .28)) continue; const hit = probe.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue; walls.push({x, y, z, yaw: Math.atan2(-nx, nz)}); break; }
}
for (const wall of walls.slice(0, +wallsArg)) {
  const sim = mk(), s = sim.state, p = s.player; for (let i = 0; i < 30; i++) sim.step(1 / 60, {});
  let t = now(); JSON.stringify(sim.snapshot()); const idle = now() - t;
  Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: 0}); const rev = s.destructionRevision; let k = 0;
  for (; k < 120 && s.destructionRevision === rev; k++) { sim.step(1 / 60, k === 0 ? {weapon: 2, fire: true} : {}); s.events.length = 0; }
  for (let i = 0; i < 5; i++) sim.step(1 / 60, {});
  const pending = s.aiStats.navPending; t = now(); const snap = sim.snapshot(); const a = now() - t; t = now(); const json = JSON.stringify(snap); const b = now() - t;
  console.log(JSON.stringify({idleSaveMs: +idle.toFixed(2), navPendingBefore: pending, snapshotMs: +a.toFixed(2), stringifyMs: +b.toFixed(2), chars: json.length}));
}
