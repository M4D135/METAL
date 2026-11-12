// Accumulates rubble with real rockets on several walls, then measures debris physics cost while falling and at rest,
// plus snapshot size/time with heavy destruction. Needs SRC=<copy with instr2>.
// usage: SRC=dir node rubble.mjs <ferroRoot> [spec=l:0] [walls=8]
import {load, now} from './lib.mjs';
const [root, spec = 'l:0', wallsArg = '8'] = process.argv.slice(2);
const W = load(root);
const [, idx] = spec.split(':');
const world = W.FWorld.create(96, +idx);
const inventory = {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory});
const s = sim.state, p = s.player;
const walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) {
    const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = sim.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || sim.blocked(x, z, .28)) continue;
    const hit = sim.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue;
    walls.push({x, y, z, yaw: Math.atan2(-nx, nz), cx, cz}); break;
  }
}
const far = walls.filter((w, i) => walls.findIndex(q => Math.hypot(q.cx - w.cx, q.cz - w.cz) < 12) === i);
const phases = [];
let shots = 0;
for (const wall of far.slice(0, +wallsArg)) {
  for (let k = 0; k < 2; k++) { // two rockets per wall
    Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: k ? .08 : 0, hp: 100});
    s.inventory.ammo[2] = 12; W.__s.debris = 0; W.__s.pump = 0; let t = 0;
    for (let i = 0; i < 180; i++) { const a = now(); sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); t += now() - a; s.events.length = 0; if (s.dead) { s.dead = false; } }
    shots++;
    phases.push({shot: shots, debris: s.debris.length, structural: s.debris.filter(q => q.structural).length, resting: s.debris.filter(q => q.resting).length, stepMsAvg: +(t / 180).toFixed(3), debrisMsPerStep: +(W.__s.debris / 180).toFixed(3), pumpMsPerStep: +(W.__s.pump / 180).toFixed(3)});
  }
}
// steady state: everything at rest, player idle far from rubble
W.__s.debris = 0; W.__s.pump = 0; let t = 0;
for (let i = 0; i < 600; i++) { const a = now(); sim.step(1 / 60, {}); t += now() - a; s.events.length = 0; }
const rest = {debris: s.debris.length, resting: s.debris.filter(q => q.resting).length, stepMsAvg: +(t / 600).toFixed(3), debrisMsPerStep: +(W.__s.debris / 600).toFixed(3)};
let a = now(); const snap = sim.snapshot(); const snapMs = now() - a; a = now(); const json = JSON.stringify(snap); const strMs = now() - a;
const parts = {destruction: JSON.stringify(snap.destruction).length, rubble: JSON.stringify(snap.state.rubble).length, enemies: JSON.stringify(snap.state.enemies).length, loot: JSON.stringify(snap.state.loot || []).length};
a = now(); const ok = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory}).restore(JSON.parse(json), {recover: true}); const restoreMs = now() - a;
console.log(JSON.stringify({spec, walls: far.length, shots, rest, snapshotMs: +snapMs.toFixed(2), stringifyMs: +strMs.toFixed(2), snapshotChars: json.length, parts, restoreOk: ok, createPlusRestoreMs: +restoreMs.toFixed(1), destructionStates: snap.destruction.states.length, cuts: snap.destruction.states.reduce((n, q) => n + q.cuts.length, 0), meshes: sim.destruction.meshes.length, colliders: sim.destruction.colliders.length}));
for (const q of phases) console.log(JSON.stringify(q));
