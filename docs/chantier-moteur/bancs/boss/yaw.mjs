// Rotation du colosse quand le joueur tourne autour à 7,6 m/s : sauts de lacet par pas.
import {load, loadout} from './lib.mjs';
const [root, idxArg = '2'] = process.argv.slice(2); const W = load(root), index = +idxArg, dt = 1 / 60;
const w = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), sim = W.FSimulation.create(w, loadout(W, index));
const s = sim.state, p = s.player, A = w.bossArena, boss = s.enemies.find(e => e.type === 3 && e.bossScale > 1);
Object.assign(p, {x: A.x - 15, y: A.y, z: A.z}); sim.step(0, {}); s.events.length = 0;
const jumps = []; let last = boss.yaw, still = 0, moved = 0, maxJump = 0;
for (let i = 0; i < 40 / dt; i++) {
  const a = Math.atan2(p.z - boss.z, p.x - boss.x) + 7.6 / 15 * dt; // orbite de 15 m à 7,6 m/s
  p.x = boss.x + Math.cos(a) * 15; p.z = boss.z + Math.sin(a) * 15;
  sim.step(dt, {}); p.hp = s.maxHp;
  let d = Math.atan2(Math.sin(boss.yaw - last), Math.cos(boss.yaw - last)); last = boss.yaw;
  if (Math.abs(d) < 1e-9) still++; else { moved++; maxJump = Math.max(maxJump, Math.abs(d)); jumps.push(Math.abs(d)); }
  s.events.length = 0;
}
jumps.sort((a, b) => a - b);
const tip = boss.bossScale * 1.5; // demi-envergure approx. (canons à 1,04×échelle, épaules ~1,5×)
console.log(JSON.stringify({index, kind: boss.bossKind, steps: still + moved, stepsWithRotation: moved, stepsFrozen: still, medianJumpDeg: +(jumps[Math.floor(jumps.length / 2)] * 180 / Math.PI).toFixed(1), maxJumpDeg: +(maxJump * 180 / Math.PI).toFixed(1), tipJumpMaxM: +(maxJump * tip).toFixed(2), orbitDegPerS: +(7.6 / 15 * 180 / Math.PI).toFixed(1)}));
