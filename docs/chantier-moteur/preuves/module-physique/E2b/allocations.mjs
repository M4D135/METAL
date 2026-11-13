// Module step 2b (task E2b, PHYS-05): indicative allocation check on the new scenes and the new actions, before the
// --alloc mode of the bench (module step 11, brief §8.2).
// Run from the repository root: node --expose-gc --max-semi-space-size=64 docs/chantier-moteur/preuves/module-physique/E2b/allocations.mjs
// New-space bytes. Each scene is first run once whole to warm the optimiser, then a fresh copy is measured as the
// brief asks: rubble300 (NOSLEEP, so that it stays awake) after 300 sub-steps, blast200 just after its blast (sub-step
// 240); 5 measures of 120 sub-steps, median. Actions: 5 measures of 1 000 calls, median, per call. The semi-space is
// large enough for no scavenge to run during a measure; a loop that calls an empty function costs 24 bytes per call.
import v8 from 'node:v8';
import {load, SCENES, NOSLEEP} from '../../../../../checks/fphysics-scenes.mjs';

if (typeof globalThis.gc !== 'function') throw new Error('run with --expose-gc --max-semi-space-size=64');
const F = load(), used = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
const median5 = f => { const out = []; for (let rep = 0; rep < 5; rep++) out.push(f()); return out.sort((x, y) => x - y)[2]; };
function steps(w, n) { globalThis.gc(); const a = used(); for (let i = 0; i < n; i++) w.step(1 / 120); return (used() - a) / n; }
function scene(name, opts, until) {
  const s = SCENES[name](F, opts);
  for (let i = 0; i < until; i++) { if (s.tick) s.tick(i); s.w.step(1 / 120); }
  return s;
}
scene('rubble300', NOSLEEP, 900); scene('blast200', {}, 900);
const r = scene('rubble300', NOSLEEP, 300), b = scene('blast200', {}, 241);
console.log(`Node ${process.version} ; octets alloués dans le tas jeune, médiane de 5 mesures`);
console.log(`- rubble300 NOSLEEP après 300 sous-pas (${r.w.stats.awake} éveillés, ${r.w.stats.contacts} points) : ${median5(() => steps(r.w, 120)).toFixed(0)} octets par sous-pas`);
console.log(`- blast200 juste après le souffle (${b.w.stats.awake} éveillés, ${b.w.stats.contacts} points) : ${median5(() => steps(b.w, 120)).toFixed(0)} octets par sous-pas`);
// Two calls per iteration (opposite signs, so that the body does not drift); bytes per call.
const h = r.ids[150], w = r.w, u = b.w, calls = f => median5(() => { globalThis.gc(); const a = used(); for (let i = 0; i < 1000; i++) f(i); return (used() - a) / 2000; });
const p = w.body(h).pos;
console.log('- arguments constants (littéraux, sans nouveau nombre à mettre en boîte) :');
console.log(`  impulse ${calls(() => { w.impulse(h, 0.1, 1.5, -0.3, 1e-3, 0, 0); w.impulse(h, 0.1, 1.5, -0.3, -1e-3, 0, 0); }).toFixed(0)}, setVelocity ${calls(() => { w.setVelocity(h, 0, 1e-3, 0, 0, 0, 0); w.setVelocity(h, 0, -1e-3, 0, 0, 0, 0); }).toFixed(0)},`
  + ` blast sur les 200 corps de blast200 ${calls(() => { u.blast(0, 0.5, 0, 14, 1e-3); u.blast(0, 0.5, 0, 14, 0); }).toFixed(0)} octets par appel`);
console.log('- arguments calculés à chaque appel (point lu dans un tableau, impulsion multipliée) :');
console.log(`  impulse ${calls(i => { const s = 1e-3 * (i & 1 ? 1 : -1); w.impulse(h, p[0], p[1] + 0.01, p[2], s, 0, 0); w.impulse(h, p[0], p[1] + 0.01, p[2], -s, 0, 0); }).toFixed(0)},`
  + ` setVelocity ${calls(i => { w.setVelocity(h, 0, 1e-3 * (i & 1), 0, 0, 0, 0); w.setVelocity(h, 0, -1e-3 * (i & 1), 0, 0, 0, 0); }).toFixed(0)} octets par appel`);
const nop = (a, b, c, d, e, f, g) => a;
console.log(`- témoin, une fonction vide à 7 arguments, constants puis calculés : ${calls(() => { nop(h, 0.1, 1.5, -0.3, 1e-3, 0, 0); nop(h, 0.1, 1.5, -0.3, -1e-3, 0, 0); }).toFixed(0)}`
  + ` et ${calls(i => { const s = 1e-3 * (i & 1 ? 1 : -1); nop(h, p[0], p[1] + 0.01, p[2], s, 0, 0); nop(h, p[0], p[1] + 0.01, p[2], -s, 0, 0); }).toFixed(0)} octets par appel`);
console.log('Lecture : le pas n\'alloue rien de mesurable (24 octets, le coût de la boucle de mesure, comme à l\'étape 2a). Les actions non plus avec des'
  + ' arguments constants. Avec des arguments calculés, ce qu\'on paie est la mise en boîte des nombres neufs passés à une fonction que l\'optimiseur'
  + ' ne met pas en ligne (PHYS-05) : le témoin vide, mis en ligne, n\'en paie aucun. Hors du pas, c\'est permis (§4.7).');
