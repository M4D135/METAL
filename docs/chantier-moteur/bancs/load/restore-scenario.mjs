// bench2 scenario (pistol/SMG only, no explosive from the player): is the checkpoint restorable every 5 s?
// usage: [SRC=dir] node restore-scenario.mjs <ferroRoot> [spec] [steps=3600]
import {load, makeWorld} from './lib.mjs';
const [root, spec = 'l:0', stepsArg = '3600'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const mk = () => W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true});
const sim = mk(), s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
const out = [];
for (let i = 0; i < +stepsArg; i++) {
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  sim.step(1 / 60, input); s.events.length = 0; if (s.dead) break;
  if (i % 300 === 299) { W.__s.rubbleFail = []; const ok = mk().restore(JSON.parse(JSON.stringify(sim.snapshot())), {recover: true}); const f = W.__s.rubbleFail?.[0];
    out.push((i + 1) / 60 + 's rubble=' + s.debris.filter(q => q.structural).length + ' rev=' + s.destructionRevision + ' restore=' + ok + (f ? ' overlap ' + f.sourceId + ' pen=' + f.pen.map(v => v.toFixed(3)).join('/') : '')); }
}
console.log(spec + ': ' + out.join(' | '));
