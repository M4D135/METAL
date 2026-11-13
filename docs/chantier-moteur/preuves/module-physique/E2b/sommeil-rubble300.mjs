// Module step 2b (task E2b): sleep of rubble300, module against prototype, and its wake before module step 6.
// Run from the repository root: node docs/chantier-moteur/preuves/module-physique/E2b/sommeil-rubble300.mjs
// Writes nothing (the output is copied in sommeil-rubble300.txt). Main realm of Node, no clock, no random source.
//
// 1. Sub-step at whose end the 300 pieces all sleep: the module with its bounded masses ([3, 120], default) and with
//    massMin 0.5, massMax 160 (the raw masses); the prototype on its plane and on the slab of the module (ground: false
//    plus the box (-64, -0.5, -64)..(64, 0, 64), friction 0.8, restitution 0.05, as in E2a/compare-prototype.mjs), with
//    the raw masses and with the masses bounded to [3, 120]. Same pieces, same order (bancs/phys/scenes.mjs).
// 2. P22, second part (module step 6), measured as it is now: once all sleep, impulse (6, 0, 0) at the centre of the
//    highest piece; peak of stats.awake, time until all sleep again, pieces moved by more than 2 mm.
import {load, SCENES} from '../../../../../checks/fphysics-scenes.mjs';
import {create} from '../../../bancs/phys/fphys.mjs';
import {lcg} from '../../../bancs/phys/scenes.mjs';

const F = load(), LIMIT = 3600;
function moduleSleep(opts) {
  const s = SCENES.rubble300(F, opts);
  for (let i = 1; i <= LIMIT; i++) { s.w.step(1 / 120); if (s.w.stats.sleeping === 300) return {s, at: i}; }
  return {s, at: -1};
}
// rubble300 of the prototype, rebuilt with the same draws (bancs/phys/scenes.mjs) so that the ground and the masses can change.
function prototypeSleep(slab, bounded) {
  const MAT = [[65, 0.45, 0.24], [28, 0.7, 0.16], [8, 0.55, 0.22], [25, 0.35, 0.16], [12, 0.8, 0.05]];
  const w = create({capacity: 512, ...(slab ? {ground: false} : {})});
  if (slab) w.addStatic(-64, -0.5, -64, 64, 0, 64, 0.8, 0.05);
  w.addStatic(-4, 0, -4, -3.5, 4, 4); w.addStatic(3.5, 0, -4, 4, 4, 4); w.addStatic(-4, 0, -4, 4, 4, -3.5); w.addStatic(-4, 0, 3.5, 4, 0.5, 4); w.addStatic(-1, 0, -1, 1, 0.6, 1);
  w.buildStatics();
  const r = lcg(20261112), ids = [];
  for (let i = 0; i < 300; i++) {
    const m = MAT[i % 5], sl = r() < 0.3, hx = 0.06 + r() * (sl ? 0.5 : 0.25), hy = sl ? 0.04 + r() * 0.06 : 0.06 + r() * 0.25, hz = 0.06 + r() * (sl ? 0.4 : 0.25);
    const col = i % 36, layer = (i / 36) | 0, x = -2.6 + (col % 6) * 1.04 + (r() - 0.5) * 0.1, z = -2.6 + ((col / 6) | 0) * 1.04 + (r() - 0.5) * 0.1, y = 1.2 + layer * 1.1;
    let qx = r() - 0.5, qy = r() - 0.5, qz = r() - 0.5, qw = r() - 0.5;
    const l = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1; qx /= l; qy /= l; qz /= l; qw /= l;
    let mass = Math.max(0.5, Math.min(160, 8 * hx * hy * hz * m[0]));
    if (bounded) mass = Math.min(Math.max(mass, 3), 120);
    ids.push(w.addBox(x, y, z, hx, hy, hz, mass, m[1], m[2], qx, qy, qz, qw));
  }
  for (let i = 1; i <= LIMIT; i++) { w.step(1 / 120, 1); if (ids.every(j => (w.FL[j] & 2) !== 0)) return i; }
  return -1;
}
const t = at => at < 0 ? `pas de sommeil complet en ${LIMIT} sous-pas` : `sous-pas ${at} (${(at / 120).toFixed(2)} s)`;

console.log(`FPhysics ${F.VERSION} et bancs/phys/fphys.mjs ; Node ${process.version}.\n`);
console.log('1. Sommeil complet de rubble300');
const base = moduleSleep({});
console.log(`- module, masses bornées à [3, 120] (défaut)    : ${t(base.at)} ; réveils ${base.s.w.stats.wakes}`);
const raw = moduleSleep({massMin: 0.5, massMax: 160});
console.log(`- module, masses d'origine (massMin 0.5, 160)  : ${t(raw.at)} ; réveils ${raw.s.w.stats.wakes}`);
for (const slab of [false, true]) for (const bounded of [false, true])
  console.log(`- prototype, ${(slab ? 'dalle,' : 'plan,').padEnd(7)}${(bounded ? 'masses bornées à [3, 120]' : 'masses d\'origine').padEnd(25)} : ${t(prototypeSleep(slab, bounded))}`);

console.log('\n2. P22, seconde partie (étape 6), mesurée avec le réveil provisoire d\'un seul corps');
const {s} = base, w = s.w, start = s.ids.map(h => w.body(h).pos);
const top = s.ids.reduce((a, h) => w.body(h).pos[1] > w.body(a).pos[1] ? h : a, s.ids[0]), c = w.body(top).pos, woken = new Set();
w.impulse(top, c[0], c[1], c[2], 6, 0, 0);
let peak = w.stats.awake, again = -1;
for (let i = 1; i <= LIMIT && again < 0; i++) {
  w.step(1 / 120);
  peak = Math.max(peak, w.stats.awake);
  for (const h of s.ids) if (!w.isAsleep(h)) woken.add(h);
  if (w.stats.sleeping === 300) again = i;
}
const moved = s.ids.filter((h, k) => Math.hypot(...w.body(h).pos.map((v, n) => v - start[k][n])) > 0.002);
const still = moved.filter(h => h !== top && !woken.has(h)).length;
console.log(`- pièce la plus haute à y = ${c[1].toFixed(3)} ; pic de ${peak} éveillés (attendu ≤ 16) ; tout se rendort ${t(again)} plus tard (attendu < 2 s) ;`
  + ` ${moved.length} pièce(s) déplacée(s) de plus de 2 mm (attendu ≤ 16), dont ${still} restée(s) endormie(s) tout du long (attendu 0) ; ${woken.size} pièce(s) réveillée(s) ; réveils ${w.stats.wakes}`);
