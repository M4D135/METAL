// Module step 2a (task E2a): indicative allocation check of step(), before the bench of the brief (§8.2).
// Run from the repository root: node --expose-gc --max-semi-space-size=64 docs/chantier-moteur/preuves/module-physique/E2a/allocations.mjs
// New-space bytes per sub-step, after a warm-up of 3 000 sub-steps (NOSLEEP), 5 measures of 120 sub-steps, median.
// The semi-space is large enough for no scavenge to run during a measure. The empty world gives the cost of the
// measuring loop itself. "lecture de config" is the same module with the first form of collide(), which read the
// margin and maxLinear settings from w.config (a plain object): V8 then boxed the three speeds of each body.
import v8 from 'node:v8';
import {source, SCENES, NOSLEEP, B64} from '../../../../../checks/fphysics-scenes.mjs';

if (typeof globalThis.gc !== 'function') throw new Error('run with --expose-gc --max-semi-space-size=64');
const NOW = 'const h=SCR[9],mg=SCR[14],lim=SCR[15];', OLD = 'const h=SCR[9],mg=C.margin,lim=C.maxLinear;';
if (!source().includes(NOW)) throw new Error('collide() first line not found in src/physics.js');
const loadWith = text => { const W = {}; new Function('window', text)(W); return W.FPhysics; };
const used = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
function measure(F, make) {
  const w = make(F);
  for (let i = 0; i < 3000; i++) w.step(1 / 120);
  const out = [];
  for (let rep = 0; rep < 5; rep++) { globalThis.gc(); const a = used(); for (let i = 0; i < 120; i++) w.step(1 / 120); out.push((used() - a) / 120); }
  return out.sort((x, y) => x - y)[2];
}
const scenes = {
  'monde vide': F => F.create({bounds: B64, ground: 0, capacity: 8, maxContacts: 256, maxStatics: 16}),
  stack10: F => SCENES.stack10(F, NOSLEEP).w,
  pyramid55: F => SCENES.pyramid55(F, NOSLEEP).w,
};
console.log(`Node ${process.version} ; octets alloués par sous-pas (médiane de 5 mesures de 120 sous-pas, après 3 000 sous-pas)`);
for (const [name, make] of Object.entries(scenes)) {
  const now = measure(loadWith(source()), make), old = measure(loadWith(source().replace(NOW, OLD)), make);
  console.log(`- ${name.padEnd(10)} module : ${now.toFixed(0).padStart(5)} ; lecture de config dans collide() : ${old.toFixed(0).padStart(5)}`);
}
