// Debug helper: which require() fails when restoring the heavy-rubble snapshot.
import {load} from './lib.mjs';
const [root] = process.argv.slice(2);
const W = load(root);
const world = W.FWorld.create(96, 0);
const inventory = {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory});
const s = sim.state, p = s.player;
const walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) { const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = sim.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || sim.blocked(x, z, .28)) continue; const hit = sim.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue; walls.push({x, y, z, yaw: Math.atan2(-nx, nz), cx, cz}); break; }
}
const far = walls.filter((w, i) => walls.findIndex(q => Math.hypot(q.cx - w.cx, q.cz - w.cz) < 12) === i);
const mk = () => W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory});
let n = 0;
for (const wall of far.slice(0, 8)) for (let k = 0; k < 2; k++) {
  Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: k ? .08 : 0});
  for (let i = 0; i < 180; i++) { sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); s.events.length = 0; }
  n++; W.__s.restoreError = W.__s.restoreCatch = undefined;
  const snap = JSON.parse(JSON.stringify(sim.snapshot())); const ok = mk().restore(snap, {recover: true});
  console.log('shot', n, 'dead', s.dead, 'hp', p.hp.toFixed(1), 'rubble', s.debris.filter(q => q.structural).length, 'restoreOk', ok, ok ? '' : (W.__s.restoreCatch + ' @ ' + W.__s.restoreError));
  if (s.dead) break;
}
