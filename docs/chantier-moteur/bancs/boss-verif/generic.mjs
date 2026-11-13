// Banc générique (même scénario que bench.mjs) avec journal des A* échoués et variante de filtre de couverture.
import {loadPatched} from './vlib.mjs';
import {PATCHES} from './patches.mjs';
const [root, variant = 'base'] = process.argv.slice(2);
const W = loadPatched(root, PATCHES('probe')); if (variant === 'height') W.__heightFilter = true; if (variant === 'bound') W.__bound = true;
const out = {};
for (const [label, idx, opts] of [['legacy-s0', 0, undefined], ['legacy-s2', 2, undefined], ['campaign-w10', 9, {campaign: true}], ['campaign-w16', 15, {campaign: true}]]) {
  W.__log = [];
  const w = W.FWorld.create(96, idx, opts), sim = W.FSimulation.create(w, {brain: W.FBrain.create({mode: 'cpu'})});
  const s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0}, cpu = [];
  for (let i = 0; i < 1800; i++) { input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += .01;
    const c0 = process.threadCpuUsage(); sim.step(1 / 60, input); const c = process.threadCpuUsage(c0); cpu.push((c.user + c.system) / 1000); if (s.dead) break; }
  const L = W.__log, fails = L.filter(r => !r.found), sorted = cpu.slice().sort((a, b) => a - b);
  const byCaller = {}; for (const r of fails) byCaller[r.caller] = (byCaller[r.caller] || 0) + 1;
  out[label] = {steps: cpu.length, routes: L.length, failed: fails.length, failMs: +fails.reduce((a, r) => a + r.ms, 0).toFixed(0), failExplored: fails.reduce((a, r) => a + r.explored, 0), failTargetsBelow: fails.filter(r => r.tdy < -.6).length, failTargetsAbove: fails.filter(r => r.tdy > .6).length, byCaller,
    cpuAvg: +(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(3), cpuP99: +sorted[Math.floor(sorted.length * .99)].toFixed(2), cpuMax: +sorted.at(-1).toFixed(1), over16: cpu.filter(v => v > 16).length};
}
console.log(variant, JSON.stringify(out));
