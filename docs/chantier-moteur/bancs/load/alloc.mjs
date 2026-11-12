// Allocation sites per simulated step (sampling heap profiler incl. objects already collected).
// usage: node alloc.mjs <ferroRoot> [spec=l:0] [warm=600] [steps=1800] [mode=play|rubble]
import {load, makeWorld} from './lib.mjs';
import inspector from 'node:inspector';
const [root, spec = 'l:0', warmArg = '600', stepsArg = '1800', mode = 'play'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true});
const s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
const drive = i => { if (mode === 'idle') return {}; input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01; return input; };
for (let i = 0; i < +warmArg; i++) { sim.step(1 / 60, drive(i)); s.events.length = 0; if (s.dead) break; }
const session = new inspector.Session(); session.connect();
const post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, r) => e ? rej(e) : res(r)));
await post('HeapProfiler.enable');
await post('HeapProfiler.startSampling', {samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true});
let steps = 0;
for (let i = +warmArg; i < +warmArg + +stepsArg; i++) { sim.step(1 / 60, drive(i)); s.events.length = 0; steps++; if (s.dead) break; }
const {profile} = await post('HeapProfiler.stopSampling');
const bySelf = new Map(); let total = 0;
(function walk(n, stack) {
  const cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1);
  if (n.selfSize) { bySelf.set(k, (bySelf.get(k) || 0) + n.selfSize); total += n.selfSize; }
  for (const c of n.children || []) walk(c, stack);
})(profile.head, []);
console.log(JSON.stringify({spec, mode, steps, totalMB: +(total / 1048576).toFixed(1), kbPerStep: +(total / 1024 / steps).toFixed(1), debris: s.debris.length, awake: s.aiStats.awake}));
for (const [k, v] of [...bySelf].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log((v / 1024 / steps).toFixed(1) + ' KB/step', (100 * v / total).toFixed(1) + '%', k);
