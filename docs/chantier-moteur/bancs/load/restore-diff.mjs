// Which fields differ between a saved checkpoint and the snapshot of the sim restored from it (patched restore)?
// Also profiles the patched restore (create excluded) on the heaviest checkpoint.
// usage: node restore-diff.mjs <ferroRoot> <fixSrcDir> [spec=c:3] [checkpoints=12]
import {load, makeWorld, profiler, summarize} from './lib.mjs';
const [root, fixDir, spec = 'c:3', nArg = '12'] = process.argv.slice(2);
const W = load(root, [], fixDir), world = makeWorld(W, spec);
const mk = () => W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true});
const sim = mk(), s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
function diff(a, b, path = '', out = []) {
  if (out.length > 12) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || a === null || b === null || typeof a !== 'object') { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path + ': ' + JSON.stringify(a)?.slice(0, 120) + ' -> ' + JSON.stringify(b)?.slice(0, 120)); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path + '.' + k, out);
  return out;
}
let heavy = null;
for (let i = 0; i < 300 * +nArg; i++) {
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  sim.step(1 / 60, input); s.events.length = 0; if (s.dead) break;
  if (i % 300 === 299) {
    const json = JSON.stringify(sim.snapshot()), r = mk(), ok = r.restore(JSON.parse(json), {recover: true});
    const again = ok && JSON.stringify(r.snapshot());
    if (ok && again !== json) console.log('t=' + (i + 1) / 60 + 's not exact:', diff(JSON.parse(json), JSON.parse(again)).join(' | '));
    if (!heavy || json.length > heavy.length) heavy = json;
  }
}
const prof = await profiler(); const r = mk(); await prof.start(); const t = performance.now(); const ok = r.restore(JSON.parse(heavy), {recover: true}); const ms = performance.now() - t; const p = await prof.stop();
const sum = summarize(p, 14);
console.log(JSON.stringify({spec, heavyChars: heavy.length, ok, restoreMs: +ms.toFixed(1), inclusive: sum.inclusive, self: sum.self.slice(0, 8)}, null, 0));
