// CPU profile of loading phases (warm, after one discarded run): FWorld.create, FSimulation.create, restore.
// usage: node gen-profile.mjs <ferroRoot> <spec> [phase=gen|sim|restore|setworld]
import {load, makeWorld, profiler, summarize, stubCanvas, time} from './lib.mjs';
const [root, spec = 'c:9', phase = 'gen'] = process.argv.slice(2);
const W = load(root);
const brain = W.FBrain.create({mode: 'cpu'});
// warm-up (JIT), discarded
{ const w = makeWorld(W, spec); const s = W.FSimulation.create(w, {brain, armorSystem: true}); s.restore(s.snapshot()); }
const prof = await profiler();
let world = phase === 'gen' ? null : makeWorld(W, spec), sim = phase === 'restore' || phase === 'setworld' ? W.FSimulation.create(world, {brain, armorSystem: true}) : null;
const snap = sim ? JSON.parse(JSON.stringify(sim.snapshot())) : null;
const {canvas} = stubCanvas(); const r = W.FRender.create(canvas);
await prof.start();
const [, ms] = time(() => {
  if (phase === 'gen') world = makeWorld(W, spec);
  else if (phase === 'sim') sim = W.FSimulation.create(world, {brain, armorSystem: true});
  else if (phase === 'restore') sim.restore(snap, {recover: true});
  else if (phase === 'setworld') r.setWorld(sim.destruction.meshes, sim.destruction.lights, world.environment);
});
const profile = await prof.stop();
const sum = summarize(profile, 28);
console.log(phase, spec, 'wall', ms.toFixed(1), 'ms; sampled', sum.totalMs, 'ms');
console.log('INCLUSIVE'); for (const row of sum.inclusive) console.log(row.join('  '));
console.log('SELF'); for (const row of sum.self.slice(0, 16)) console.log(row.join('  '));
