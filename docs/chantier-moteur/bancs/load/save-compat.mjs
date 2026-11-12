// Save compatibility across releases: a checkpoint made by the previous release (sources extracted with
// `git show 00217cd:src/<f>.js` into bench/load/old-00217cd, repo untouched) restored by the current code.
// Same world generation number => the shell calls sim.restore(); a refusal shows "Point de reprise illisible".
// usage: node save-compat.mjs <ferroRoot> <oldSrcDir> [steps=600]
import {load} from './lib.mjs';
const [root, oldDir, stepsArg = '600'] = process.argv.slice(2);
const W0 = load(root, [], oldDir), W1 = load(root);
const fnv = s => { let f = 2166136261; for (let i = 0; i < s.length; i++) f = Math.imul(f ^ s.charCodeAt(i), 16777619); return (f >>> 0).toString(36); };
const cases = [['legacy', 0, undefined], ['legacy', 1, undefined], ['legacy', 2, undefined], ['campaign1', 0, {campaign: true}], ['campaign1', 3, {campaign: true}], ['campaign2', 0, {campaign: true, campaignVersion: 2}], ['campaign2', 9, {campaign: true, campaignVersion: 2}]];
for (const [label, index, opts] of cases) {
  const w0 = W0.FWorld.create(96, index, opts), w1 = W1.FWorld.create(96, index, opts);
  const sim0 = W0.FSimulation.create(w0, {armorSystem: true}), s = sim0.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
  const entry = JSON.stringify(sim0.snapshot());
  for (let i = 0; i < +stepsArg; i++) { input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; s.player.yaw += 0.01; sim0.step(1 / 60, input); s.events.length = 0; if (s.dead) break; }
  const later = JSON.stringify(sim0.snapshot());
  const okEntry = W1.FSimulation.create(w1, {armorSystem: true}).restore(JSON.parse(entry), {recover: true});
  const okLater = W1.FSimulation.create(w1, {armorSystem: true}).restore(JSON.parse(later), {recover: true});
  console.log(JSON.stringify({label, index, generationOld: w0.generation, generationNew: w1.generation, campaignVersionOld: w0.campaignVersion, sameWorldJson: fnv(JSON.stringify(w0)) === fnv(JSON.stringify(w1)), meshesOld: w0.meshes.length, meshesNew: w1.meshes.length, collidersOld: w0.colliders.length, collidersNew: w1.colliders.length, restoreEntryCheckpoint: okEntry, restoreAfter10s: okLater, rubbleInLater: (JSON.parse(later).state.rubble || []).length}));
}
