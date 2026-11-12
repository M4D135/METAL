// LOAD-01: checkpoints refused by the rubble validator, and two candidate fixes, on generated worlds.
// For each checkpoint: original restore, original restore with rubble stripped (legacy format), patched restore (rubblefix)
// plus exactness of the patched restore (restored.snapshot() === saved snapshot).
// usage: node rubble-fix.mjs <ferroRoot> <rubblefixSrcDir> [mode=walk|rocket] [spec=l:0] [n=12]
import {load, makeWorld} from './lib.mjs';
const [root, fixDir, mode = 'walk', spec = 'l:0', nArg = '12'] = process.argv.slice(2);
const W0 = load(root), W1 = load(root, [], fixDir);
const campaign = spec.startsWith('c:');
const opts = W => { const o = {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true}; if (mode === 'rocket') { o.inventory = campaign ? {weapons: [true, true, true, true, true], ammo: [180, 36, 12, 16, 1], shield: false} : {weapons: [true, true, true, true], ammo: [180, 36, 12, 16], shield: false}; if (campaign) { o.campaign = {version: 2, discovered: ['pistol', 'smg', 'shotgun', 'grenade', 'rocket'], claimedBossRewards: []}; o.equipment = {right: 2, left: null, shieldEnergy: 100}; } } return o; };
const world0 = makeWorld(W0, spec), world1 = makeWorld(W1, spec);
const mk0 = () => W0.FSimulation.create(world0, opts(W0)), mk1 = () => W1.FSimulation.create(world1, opts(W1));
const stats = {spec, mode, checkpoints: 0, origOk: 0, strippedOk: 0, fixOk: 0, fixExact: 0, fixMs: [], origMs: []};
function judge(sim) {
  const snap = sim.snapshot(), json = JSON.stringify(snap); stats.checkpoints++;
  let t = performance.now(); if (mk0().restore(JSON.parse(json), {recover: true})) stats.origOk++; stats.origMs.push(performance.now() - t);
  const stripped = JSON.parse(json); delete stripped.rubbleVersion; delete stripped.state.rubble; delete stripped.timers.rubbleSerial;
  if (mk0().restore(stripped, {recover: true})) stats.strippedOk++;
  const r = mk1(); t = performance.now(); const ok = r.restore(JSON.parse(json), {recover: true}); stats.fixMs.push(performance.now() - t);
  if (ok) { stats.fixOk++; if (JSON.stringify(r.snapshot()) === json) stats.fixExact++; }
}
if (mode === 'walk') {
  const sim = mk0(), s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
  for (let i = 0; i < 300 * +nArg; i++) {
    input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
    sim.step(1 / 60, input); s.events.length = 0; if (s.dead) break;
    if (i % 300 === 299) judge(sim);
  }
} else {
  const probe = mk0(), walls = [];
  for (const g of world0.destructibles.filter(g => g.kind === 'wall' && g.colliders.length)) {
    const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, thinX = b.maxX - b.minX < b.maxZ - b.minZ;
    for (const sign of [-1, 1]) { const nx = thinX ? sign : 0, nz = thinX ? 0 : sign, x = cx + nx * 7, z = cz + nz * 7, y = probe.ground(x, z);
      if (!Number.isFinite(y) || Math.abs(y - b.minY) > .1 || probe.blocked(x, z, .28)) continue; const hit = probe.ray([x, y + 1.62, z], [-nx, 0, -nz], 9); if (hit < 6 || hit > 7.4) continue; walls.push({x, y, z, yaw: Math.atan2(-nx, nz)}); break; }
  }
  for (const wall of walls.slice(0, +nArg)) {
    const sim = mk0(), s = sim.state; Object.assign(s.player, {x: wall.x, z: wall.z, y: wall.y, yaw: wall.yaw, pitch: 0});
    for (let i = 0; i < 300; i++) { sim.step(1 / 60, i === 0 ? {weapon: 2, fire: true} : {}); s.events.length = 0; }
    if (!s.dead && s.debris.some(q => q.structural)) judge(sim);
  }
}
const med = a => a.length ? +a.slice().sort((x, y) => x - y)[a.length >> 1].toFixed(1) : null;
console.log(JSON.stringify({...stats, origMs: med(stats.origMs), fixMs: med(stats.fixMs)}));
