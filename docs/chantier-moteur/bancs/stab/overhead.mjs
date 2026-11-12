// STAB — surcoût de l'enregistreur : même session déterministe de 20 s (monde c9, pilote tour), sondes actives ou non.
// node overhead.mjs <racine METAL> <on|off>   (temps CPU du fil ; à alterner)
import {createHarness, cpuNow} from './harness.mjs';
const [root, mode = 'on'] = process.argv.slice(2);
const H = await createHarness(root, {probes: mode === 'on'});
let t = 0; for (let i = 0; i < 30; i++) { t += 16.667; H.frame(t); }
await H.startGame(); H.G.load(9, 96, undefined, true, 2); H.G.saveCheckpoint(); H.G.start('bench'); H.now = 1e6; H.G.setMode('playing');
const sim = H.G.sim, s = sim.state, world = H.G.world; s.inventory.weapons.fill(true);
const stops = world.enemies.map(e => [e.x, e.z]); let leg = 0, firing = false; t = H.now; const ms = [];
for (let i = 0; i < 1200; i++) { const p = s.player, w = stops[leg % stops.length], dx = w[0] - p.x, dz = w[1] - p.z, d = Math.hypot(dx, dz); if (d < 1.5) leg++; else { const k = Math.min(1, 7 / 60 / d); p.x += dx * k; p.z += dz * k; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y; }
  p.yaw = Math.atan2(dx, -dz) + Math.sin(i / 45) * .9; if (p.hp < 100) p.hp = 100; const wf = (i % 30) < 12; if (wf !== firing) { firing = wf; H.G.fire = wf; } if (H.G.mode !== 'playing') H.G.togglePause();
  t += 16.667; const a = cpuNow(); H.frame(t); ms.push(cpuNow() - a); }
ms.sort((a, b) => a - b); console.log(JSON.stringify({mode, total: +ms.reduce((a, b) => a + b, 0).toFixed(0), median: +ms[600].toFixed(3), steps: H.C.steps}));
process.exit(0);
