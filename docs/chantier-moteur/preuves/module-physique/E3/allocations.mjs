// Module step 3 (task E3, PHYS-05): indicative allocation check of the new sub-step paths (round shapes against boxes,
// statics and each other, rolling damping, a moving kinematic body), before the --alloc mode of the bench (step 11).
// Run from the repository root: node --expose-gc --max-semi-space-size=64 docs/chantier-moteur/preuves/module-physique/E3/allocations.mjs
// New-space bytes, 5 measures of 120 iterations, median; the semi-space is large enough for no scavenge to run during a
// measure. Unlike E2b/allocations.mjs, each world is warmed by 3 000 iterations of its own before the measure: the
// functions of a world are closures of create(), and the optimised code made with the closures of a first world is
// thrown away ("wrong call target") when a second world runs it, so a fresh copy measured after 300 iterations can
// still run unoptimised code, which boxes its floats (56 to 1 500 bytes per iteration in such trials).
import v8 from 'node:v8';
import {load, B64, NOSLEEP, lcg, yard} from '../../../../../checks/fphysics-scenes.mjs';

if (typeof globalThis.gc !== 'function') throw new Error('run with --expose-gc --max-semi-space-size=64');
const F = load(), used = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
const median5 = f => { const out = []; for (let rep = 0; rep < 5; rep++) out.push(f()); return out.sort((x, y) => x - y)[2]; };
const per = (n, f) => median5(() => { globalThis.gc(); const a = used(); for (let i = 0; i < n; i++) f(i); return (used() - a) / n; });

// 20 spheres, 20 capsules and 20 boxes of lcg(7) dropped in the yard, without sleep.
function round(until) {
  const w = F.create({bounds: B64, ground: 0, ...NOSLEEP}), r = lcg(7);
  yard(w);
  for (let k = 0; k < 60; k++) {
    const pos = [(r() - 0.5) * 6, 0.5 + k * 0.3, (r() - 0.5) * 6], rot = [r() * 3, r() * 3, r() * 3], material = k % 5;
    if (k % 3 === 0) w.addBody({shape: 'sphere', radius: 0.15 + 0.2 * r(), pos, rot, material});
    else if (k % 3 === 1) w.addBody({shape: 'capsule', radius: 0.1 + 0.1 * r(), height: 0.6 + 0.6 * r(), pos, rot, material});
    else w.addBody({size: [0.3 + 0.4 * r(), 0.3 + 0.4 * r(), 0.3 + 0.4 * r()], pos, rot, material});
  }
  for (let i = 0; i < until; i++) w.step(1 / 120);
  return w;
}
// A kinematic lift moved between two targets given as literals (no new number to box in the call), with a sphere and a
// box on it, without sleep: one setKinematic and one step(1/120) per iteration; still: step(1/120) only, the lift stopped.
function lift(until, still) {
  const w = F.create({bounds: B64, ground: 0, ...NOSLEEP}), k = w.addBody({size: [2, 0.2, 2], pos: [0, 0.1, 0], kinematic: true});
  w.addBody({shape: 'sphere', radius: 0.3, pos: [0.5, 0.5, 0], mass: 10});
  w.addBody({size: [0.6, 0.6, 0.6], pos: [-0.5, 0.5, 0], mass: 20});
  const go = still ? () => w.step(1 / 120) : i => { if (i & 1) w.setKinematic(k, 0, 0.1, 0, 0, 0, 0, 1); else w.setKinematic(k, 0, 0.12, 0, 0, 0, 0, 1); w.step(1 / 120); };
  for (let i = 0; i < until; i++) go(i);
  return {w, go};
}

const w = round(3000), l = lift(3000), s = lift(3000, true), nop = i => i;
console.log(`Node ${process.version} ; octets alloués dans le tas jeune, médiane de 5 mesures de 120 itérations`);
console.log(`- 60 sphères, capsules et boîtes dans la cour, NOSLEEP, après 3 000 sous-pas (${w.stats.awake} éveillés, ${w.stats.contacts} points) : ${per(120, () => w.step(1 / 120)).toFixed(0)} octets par sous-pas`);
console.log(`- ascenseur cinématique en mouvement, une sphère et une boîte dessus (${l.w.stats.awake} éveillés, ${l.w.stats.contacts} points) : ${per(120, l.go).toFixed(0)} octets par setKinematic + step`);
console.log(`- le même, ascenseur arrêté, les deux passagers posés dessus (${s.w.stats.awake} éveillés, ${s.w.stats.contacts} points) : ${per(120, s.go).toFixed(0)} octets par sous-pas`);
console.log(`- témoin, une fonction vide appelée par la même boucle : ${per(120, nop).toFixed(0)} octets par appel`);
