// 5 simulated minutes (18,000 steps at 60 Hz): heap, GC count/pauses, array growth, snapshot size.
// Scenario = bench2 + a respawn of the player when dead (restore of the last snapshot, like the shell).
// usage: node --expose-gc memory.mjs <ferroRoot> [spec=l:0] [steps=18000] [rocketEvery=0]
import {load, makeWorld, now, gcObserver} from './lib.mjs';
const [root, spec = 'l:0', stepsArg = '18000', rocketArg = '0'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const [kind] = spec.split(':');
const opts = {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true};
if (+rocketArg && kind !== 'c') opts.inventory = {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false};
const sim = W.FSimulation.create(world, opts);
const s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
globalThis.gc?.(); const base = process.memoryUsage();
const gc = await gcObserver();
const samples = []; let checkpoint = JSON.stringify(sim.snapshot()), deaths = 0, maxStep = 0, snapMax = 0, saves = 0, saveMsMax = 0, saveMsTotal = 0;
const t0 = now();
for (let i = 0; i < +stepsArg; i++) {
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  input.weapon = +rocketArg && i % +rocketArg === 0 ? 2 : (+rocketArg ? 0 : undefined);
  const a = now(); sim.step(1 / 60, input); maxStep = Math.max(maxStep, now() - a);
  // shell-like checkpoint on the events that call saveCheckpoint()
  if (s.events.some(e => ['core', 'mechanism', 'encounterClear', 'bossDeath', 'weaponPickup', 'shieldPickup', 'armorPickup', 'bossReward', 'trophy', 'trophyComplete'].includes(e.name) || e.name === 'liftStop' && e.carrying || e.name === 'lootPickup' && (e.boss || e.armor > 0))) {
    const b = now(); checkpoint = JSON.stringify(sim.snapshot()); const ms = now() - b; saves++; saveMsTotal += ms; saveMsMax = Math.max(saveMsMax, ms); snapMax = Math.max(snapMax, checkpoint.length);
  }
  s.events.length = 0;
  if (s.dead) { deaths++; sim.restore(JSON.parse(checkpoint), {recover: true}); }
  if (i % 300 === 299) await new Promise(r => setImmediate(r));
  if (i % 1800 === 1799) {
    const m = process.memoryUsage();
    samples.push({t: Math.round((i + 1) / 60) + 's', heapMB: +(m.heapUsed / 1048576).toFixed(1), debris: s.debris.length, rubble: s.debris.filter(q => q.structural).length, resting: s.debris.filter(q => q.resting).length, particles: s.particles.length, bullets: s.bullets.length, explosions: s.explosions.length, loot: s.loot.length, projectiles: s.projectiles.length,
      pathNodes: s.enemies.reduce((n, e) => n + e.path.length, 0), destructionStates: sim.destruction.snapshot().states.length, cuts: sim.destruction.snapshot().states.reduce((n, q) => n + q.cuts.length, 0), meshes: sim.destruction.meshes.length, colliders: sim.destruction.colliders.length,
      kills: s.kills, rev: s.destructionRevision, snapshotChars: JSON.stringify(sim.snapshot()).length});
  }
}
const wall = now() - t0;
await new Promise(r => setTimeout(r, 100));
gc.stop();
const kinds = {}; for (const e of gc.entries) { const k = e.kind === 1 ? 'minor' : e.kind === 2 ? 'major' : e.kind === 4 ? 'incremental' : e.kind === 8 ? 'weak' : String(e.kind); (kinds[k] ||= {n: 0, ms: 0, max: 0}); kinds[k].n++; kinds[k].ms += e.ms; kinds[k].max = Math.max(kinds[k].max, e.ms); }
for (const k in kinds) { kinds[k].ms = +kinds[k].ms.toFixed(1); kinds[k].max = +kinds[k].max.toFixed(2); }
globalThis.gc?.(); const end = process.memoryUsage();
console.log(JSON.stringify({spec, steps: +stepsArg, wallMs: Math.round(wall), msPerStep: +(wall / +stepsArg).toFixed(3), maxStepMs: +maxStep.toFixed(1), deaths, saves, saveMsMax: +saveMsMax.toFixed(2), saveMsAvg: +(saveMsTotal / Math.max(1, saves)).toFixed(2), snapMaxChars: snapMax,
  heapBaseMB: +(base.heapUsed / 1048576).toFixed(1), heapEndAfterGcMB: +(end.heapUsed / 1048576).toFixed(1), gc: kinds, gcPerMinute: +(gc.entries.length / (+stepsArg / 3600)).toFixed(1)}, null, 0));
for (const q of samples) console.log(JSON.stringify(q));
