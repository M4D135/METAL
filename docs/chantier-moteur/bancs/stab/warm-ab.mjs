// STAB — échauffement : même session déterministe de 10 s (toutes armes, explosions) mesurée À FROID (juste après
// le chargement) ou À CHAUD (après une session cachée identique, puis rechargement du monde = nouvelle simulation).
// node warm-ab.mjs <racine METAL> <monde> <cold|warm>     (temps CPU du fil ; à alterner et répéter)
import {createHarness, cpuNow, resetProbes, EXC, PROBE_NAMES} from './harness.mjs';
const [root, w = 'c0', variant = 'cold'] = process.argv.slice(2), index = +w.slice(1);
const H = await createHarness(root);
let t = 0; for (let i = 0; i < 60; i++) { t += 16.667; H.frame(t); }
await H.startGame();
const EV = ['explosion', 'materialBreak', 'rocket', 'grenadeLaunch', 'waveStart'];
function session(measure) {
  H.G.load(index, 96, undefined, true, 2); H.G.saveCheckpoint(); H.G.start('bench'); H.now = 1e6; H.G.setMode('playing'); // horloge recalée : même découpage en pas à froid et à chaud
  const sim = H.G.sim, s = sim.state, world = H.G.world; let mask = 0; const step = sim.step; sim.step = (dt, input) => { const r = step(dt, input); for (const e of s.events) { const k = EV.indexOf(e.name); if (k >= 0) mask |= 1 << k; } return r; };
  const inv = s.inventory; inv.weapons.fill(true); const caps = sim.ammoCaps || [180, 36, 12, 16, 1]; inv.ammo = inv.ammo.map((v, i) => caps[i] ?? v);
  const stops = [...world.enemies.map(e => [e.x, e.z])]; let cur = [world.spawn.x, world.spawn.z]; const route = []; const left = stops.slice(); while (left.length && route.length < 40) { let bi = 0, bd = Infinity; for (let k = 0; k < left.length; k++) { const d = Math.hypot(left[k][0] - cur[0], left[k][1] - cur[1]); if (d < bd) { bd = d; bi = k; } } cur = left.splice(bi, 1)[0]; route.push(cur); }
  let leg = 0, firing = false, slot = -1; const ms = [], flags = []; t = H.now;
  for (let i = 0; i < 600; i++) {
    const p = s.player, wp = route[leg % route.length], dx = wp[0] - p.x, dz = wp[1] - p.z, d = Math.hypot(dx, dz);
    if (d < 1.5) leg++; else { const k = Math.min(1, 7 / 60 / d); p.x += dx * k; p.z += dz * k; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y; }
    p.yaw = Math.atan2(dx, -dz) + Math.sin(i / 45) * .9; p.pitch = Math.sin(i / 70) * .12; if (p.hp < 100) p.hp = 100;
    const wf = (i % 30) < 12; if (wf !== firing) { firing = wf; H.G.fire = wf; } const sl = Math.floor(i / 60) % 5; if (sl !== slot) { slot = sl; H.G.switchWeapon([4, 0, 2, 1, 3][sl]); }
    if (H.G.mode !== 'playing') H.G.togglePause();
    t += 16.667; mask = 0; const a = cpuNow(); H.frame(t); ms.push(cpuNow() - a); flags.push(mask);
  }
  H.G.fire = false; let h = 2166136261 >>> 0; const mix = v => { h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619) >>> 0; }; mix(s.player.x); mix(s.player.z); mix(s.time); mix(s.kills); mix(s.shots); for (const e of s.enemies) { mix(e.x); mix(e.z); mix(e.hp); }
  return {ms, flags, hash: h.toString(16), steps: H.C.steps};
}
if (variant === 'warm') session(false);
const c0 = H.C.steps; const {ms, flags, hash, steps} = session(true);
const sorted = ms.slice().sort((a, b) => a - b), med = sorted[300];
const firstOf = k => { const i = flags.findIndex(f => f & (1 << k)); return i < 0 ? null : +ms[i].toFixed(2); };
const laterOf = k => { const v = ms.filter((_, i) => flags[i] & (1 << k)).slice(1).sort((a, b) => a - b); return v.length ? +v[v.length >> 1].toFixed(2) : null; };
console.log(JSON.stringify({variant, w, hash, steps: steps - c0, median: +med.toFixed(2), f0: +ms[0].toFixed(2), f0x: +(ms[0] / med).toFixed(1), first10sum: +ms.slice(0, 10).reduce((a, b) => a + b, 0).toFixed(1), over3x: ms.filter(v => v > 3 * med).length, over6x: ms.filter(v => v > 6 * med).length, max: +sorted[599].toFixed(1), sum: +ms.reduce((a, b) => a + b, 0).toFixed(0),
  firstWeaponSwitchFrames: [0, 60, 120, 180, 240].map(i => +Math.max(...ms.slice(i, i + 3)).toFixed(2)), first: Object.fromEntries(EV.map((n, k) => [n, [firstOf(k), laterOf(k)]]))}));
process.exit(0);
