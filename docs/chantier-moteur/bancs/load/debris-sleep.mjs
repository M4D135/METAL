// Rubble that never comes to rest: after real rockets on several walls, which pieces stay awake for minutes,
// and what updateDebris costs per step (a) as is, (b) if awake-but-still pieces slept, (c) if resting pieces were skipped.
// Needs SRC=<copy with instr2> (G.__s.debris accumulates updateDebris time).
// usage: SRC=dir node debris-sleep.mjs <ferroRoot> [spec=l:0] [walls=8]
import {load, now} from './lib.mjs';
const [root, spec = 'l:0', wallsArg = '8'] = process.argv.slice(2);
const W = load(root);
const world = W.FWorld.create(96, +spec.split(':')[1]);
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true, inventory: {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false}});
const s = sim.state, p = s.player, walls = [];
for (const g of world.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
  const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
  for (const sign of [-1, 1]) { const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = sim.ground(x, z);
    if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || sim.blocked(x, z, .28)) continue; const hit = sim.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue; walls.push({x, y, z, yaw: Math.atan2(-nx, nz), cx, cz}); break; }
}
const far = walls.filter((w, i) => walls.findIndex(q => Math.hypot(q.cx - w.cx, q.cz - w.cz) < 12) === i);
for (const wall of far.slice(0, +wallsArg)) for (let k = 0; k < 2; k++) {
  Object.assign(p, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: k ? .08 : 0, hp: 100}); s.inventory.ammo[2] = 12;
  for (let i = 0; i < 180; i++) { sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); s.events.length = 0; s.dead = false; }
}
Object.assign(p, {x: far[0].x, z: far[0].z, y: far[0].y});
const idle = n => { W.__s.debris = 0; let t = 0; for (let i = 0; i < n; i++) { const a = now(); sim.step(1 / 60, {}); t += now() - a; s.events.length = 0; s.dead = false; p.hp = 100; } return {stepMs: +(t / n).toFixed(3), debrisMs: +(W.__s.debris / n).toFixed(3)}; };
idle(600);
const awake0 = s.debris.filter(q => q.structural && !q.resting).map(q => q.id);
const a = idle(3600); // one more simulated minute
const awake1 = s.debris.filter(q => q.structural && !q.resting);
const persistent = awake1.filter(q => awake0.includes(q.id));
const detail = persistent.slice(0, 6).map(q => ({id: q.id, speed: +Math.hypot(q.vx, q.vy, q.vz).toFixed(3), settle: q.settleTime, shape: q.shape, size: q.size.map(v => +v.toFixed(2)), rot: q.rotation.map(v => +v.toFixed(2))}));
// (b) forcing them to sleep does not hold: updateDebris wakes any resting piece without a top-face support.
for (const q of persistent) { q.resting = true; q.vx = q.vy = q.vz = 0; q.angularVelocity = [0, 0, 0]; }
idle(2); const rewoken = s.debris.filter(q => q.structural && !q.resting).length;
// (c) cost split, alternated blocks of 600 steps: all pieces / without the never-resting ones / only the never-resting ones.
const all = s.debris.slice(), awake = all.filter(q => q.structural && !q.resting), resting = all.filter(q => !awake.includes(q));
const runs = {all: [], noAwake: [], onlyAwake: [], none: []};
for (let rep = 0; rep < 3; rep++) for (const [k, list] of [['all', all], ['noAwake', resting], ['onlyAwake', awake], ['none', []]]) {
  s.debris = list.slice(); runs[k].push(idle(600));
}
s.debris = all;
const med = a => a.map(v => v.debrisMs).sort((x, y) => x - y)[1];
console.log(JSON.stringify({spec, rubble: all.filter(q => q.structural).length, awakeAfter10s: awake0.length, stillAwakeAfter70s: persistent.length, rewokenAfterForcedSleep: rewoken, debrisMsPerStepMedian: {all: med(runs.all), withoutNeverResting: med(runs.noAwake), onlyNeverResting: med(runs.onlyAwake), empty: med(runs.none)}, stepMsMedianAll: runs.all.map(v => v.stepMs).sort((x, y) => x - y)[1], detail}));
