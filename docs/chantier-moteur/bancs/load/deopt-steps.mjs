// Prints a marker after each step so V8 --trace-deopt lines can be attributed to steps.
// usage: node --trace-deopt deopt-steps.mjs <ferroRoot> [spec=l:0] [steps=1800] [recreateAt=-1]
import {load, makeWorld, now} from './lib.mjs';
const [root, spec = 'l:0', stepsArg = '1800', recreateArg = '-1'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const brain = W.FBrain.create({mode: 'cpu'});
let sim = W.FSimulation.create(world, {brain, armorSystem: true});
let s = sim.state; const input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
for (let i = 0; i < +stepsArg; i++) {
  if (i === +recreateArg) { const snap = sim.snapshot(); sim = W.FSimulation.create(world, {brain, armorSystem: true}); sim.restore(snap); s = sim.state; console.log('@@RECREATE ' + i); }
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  const t0 = now(); sim.step(1 / 60, input); const d = now() - t0;
  console.log('@@STEP ' + i + ' ' + d.toFixed(2) + ' ' + (s.aiStats.pathSearches || 0) + ' ' + (s.aiStats.navPending || 0));
  s.events.length = 0; if (s.dead) break;
}
