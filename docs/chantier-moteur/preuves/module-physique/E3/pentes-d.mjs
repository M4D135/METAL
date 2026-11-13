// P08 (d), module step 3: a cube of 0.6 m (20 kg, friction 0.6) released unrotated above the slope of P08 (a)
// (slopeX 0.5 at y = 1, floor friction 0.7, mu = 0.648 > 0.5). Measures, since the first sub-step with a contact, the
// displacement of the centre and of the body point of first contact (the bottom edge x = +0.3, y = -0.3), the largest
// down-slope speed of the centre and the rest, for several drop heights and solver settings; then the same tipping on a
// flat ground. Run from the root of the repository: node docs/chantier-moteur/preuves/module-physique/E3/pentes-d.mjs
import {load, B64} from '../../../../../checks/fphysics-scenes.mjs';

const F = load(), SMALL = {capacity: 8, maxContacts: 256, maxStatics: 16, maxJoints: 4}, EDGE = [0.3, -0.3, 0];
const point = (w, h, l) => { const b = w.body(h), m = w.matrix(h); return [0, 1, 2].map(r => b.pos[r] + m[3 * r] * l[0] + m[3 * r + 1] * l[1] + m[3 * r + 2] * l[2]); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const L = Math.hypot(1, 0.5), T = [1 / L, 0.5 / L];

// gap: height of the lowest edge above the slope (the surface is at y = 1.15 under it).
function slope(label, gap, opts = {}, body = {}) {
  const w = F.create({bounds: B64, ...SMALL, ...opts});
  w.setStatics([], [{x: 0, z: 0, w: 10, d: 4, y: 1, slopeX: 0.5}]);
  const h = w.addBody({size: [0.6, 0.6, 0.6], pos: [0, 1.15 + gap + 0.3, 0], mass: 20, friction: 0.6, ...body});
  let first = -1, edge0 = null, centre0 = null, slide = 0, asleep = -1;
  for (let i = 1; i <= 360; i++) {
    w.step(1 / 120);
    const b = w.body(h);
    if (first < 0 && w.stats.contacts > 0) { first = i; edge0 = point(w, h, EDGE); centre0 = b.pos; }
    if (first > 0) slide = Math.max(slide, -(b.vel[0] * T[0] + b.vel[1] * T[1]));
    if (asleep < 0 && w.isAsleep(h)) asleep = i;
  }
  const b = w.body(h), m = w.matrix(h), n = [-0.5 / L, 1 / L, 0];
  console.log(`${label.padEnd(34)} contact ${String(first).padStart(3)} | arête ${dist(point(w, h, EDGE), edge0).toFixed(4)} m | centre ${dist(b.pos, centre0).toFixed(4)} m | v max vers le bas ${slide.toFixed(3)} m/s | endormi ${asleep > 0 ? (asleep / 120).toFixed(2) + ' s' : 'non'} | axe Y ${dist([m[1], m[4], m[7]], n).toExponential(1)}`);
}

console.log('# cube lâché sur la pente de P08 (a) ; déplacements depuis le premier sous-pas avec un contact');
for (const g of [0.5, 0.35, 0.2, 0.1, 0.05, 0.01, 0.001]) slope(`jeu ${g} m`, g);
console.log('# réglages (jeu 0,5 m, puis 0,01 m)');
for (const g of [0.5, 0.01]) {
  slope(`jeu ${g}, rebond 0`, g, {}, {restitution: 0});
  slope(`jeu ${g}, iterations 4`, g, {iterations: 4});
  slope(`jeu ${g}, iterations 8, relax 4`, g, {iterations: 8, relaxIterations: 4});
  slope(`jeu ${g}, frottement 1 et 1`, g, {}, {friction: 1});
  slope(`jeu ${g}, tick 1/240`, g, {tick: 1 / 240});
}
// Same tipping on a flat ground: the cube rests on its edge, tilted by -atan(0.5), and falls onto its face.
console.log('# même basculement sur un sol plat (cube posé sur son arête, incliné de -atan(0,5))');
{
  const w = F.create({bounds: B64, ...SMALL, ground: 0}), a = Math.atan(0.5), c = Math.cos(a), s = Math.sin(a);
  const h = w.addBody({size: [0.6, 0.6, 0.6], pos: [0, 0.3 * c + 0.3 * s + 0.001, 0], quat: [0, 0, Math.sin(-a / 2), Math.cos(-a / 2)], mass: 20, friction: 0.6});
  const e0 = point(w, h, EDGE);
  for (let i = 0; i < 360; i++) w.step(1 / 120);
  console.log(`sol plat                           arête ${dist(point(w, h, EDGE), e0).toFixed(4)} m | endormi ${w.isAsleep(h)}`);
}
// Rigid tipping without slip: the centre goes from (-0.3, 0.3) to R(atan 0.5)(-0.3, 0.3) around the edge.
{
  const a = Math.atan(0.5), x = -0.3 * Math.cos(a) - 0.3 * Math.sin(a), y = -0.3 * Math.sin(a) + 0.3 * Math.cos(a);
  console.log(`# basculement rigide sans glissement : le centre se déplace de ${Math.hypot(x + 0.3, y - 0.3).toFixed(4)} m`);
}
