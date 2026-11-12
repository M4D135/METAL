// With SRC=<instr copy>: per-step route() cost (segmentFree calls, explored nodes) for the bench2 scenario.
// usage: SRC=dir node routes.mjs <ferroRoot> [spec] [steps=1800]
import {load, makeWorld, now} from './lib.mjs';
const [root, spec = 'c:9', stepsArg = '1800'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true});
const s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
const all = []; let spikes = [];
for (let i = 0; i < +stepsArg; i++) {
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  W.__s.t = i; const before = W.__s.routes.length, sf0 = W.__s.sf;
  const t0 = now(); sim.step(1 / 60, input); const d = now() - t0;
  const routes = W.__s.routes.slice(before); all.push(...routes);
  if (d > 8) spikes.push({i, ms: +d.toFixed(1), sfTotal: W.__s.sf - sf0, routes: routes.filter(r => r.ms > .5).map(r => ({ms: +r.ms.toFixed(1), sf: r.sf, explored: r.explored, astar: r.astar, found: r.found, len: r.len, dist: +r.dist.toFixed(1)}))});
  s.events.length = 0; if (s.dead) break;
}
const astar = all.filter(r => r.astar), direct = all.filter(r => !r.astar);
const q = (a, f) => { const v = a.map(f).sort((x, y) => x - y); return v.length ? {n: v.length, p50: +v[v.length >> 1].toFixed(2), p95: +v[Math.floor(v.length * .95)].toFixed(2), max: +v.at(-1).toFixed(2), sum: +v.reduce((n, x) => n + x, 0).toFixed(1)} : null; };
console.log(JSON.stringify({spec, routeCalls: all.length, astar: {ms: q(astar, r => r.ms), sf: q(astar, r => r.sf), explored: q(astar, r => r.explored), cold2000: astar.filter(r => r.sf > 2000).length, failed: astar.filter(r => !r.found).length, capped: astar.filter(r => r.explored >= 2400).length},
  directOrRejected: {ms: q(direct, r => r.ms), sf: q(direct, r => r.sf)}, totalSegmentFree: W.__s.sf, uncachedBigRadiusSweeps: W.__s.big || 0,
  enemyTypes: s.enemies.reduce((m, e) => (m[e.type] = (m[e.type] || 0) + 1, m), {})}, null, 0));
for (const x of spikes) console.log(JSON.stringify(x));
