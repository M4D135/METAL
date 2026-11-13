// Module step 2b (task E2b): the scenes rubble300 and blast200 of checks/fphysics-scenes.mjs against those of the
// prototype (docs/chantier-moteur/bancs/phys/scenes.mjs), and blast against the prototype explode.
// Run from the repository root: node docs/chantier-moteur/preuves/module-physique/E2b/scenes-prototype.mjs
// Writes nothing (the output is copied in scenes-prototype.txt). Main realm of Node, no clock, no random source.
//
// 1. Data read in the prototype source: the material table (MAT) and the static boxes (addStatic calls).
// 2. Bodies at creation, one by one in the same order: centre and half-sizes (===), quaternion (the module normalises
//    it again: largest gap), mass (1/originalMass against the inverse mass of the prototype, read as the velocity that
//    a unit impulse at its centre leaves), friction and restitution (material i % 5, or the literals of blast200).
// 3. blast against explode, before any sub-step. The bodies of a module scene are pending at creation (they wake one
//    batch per sub-step), so the module bodies are created again with asleep: true (active at once, same poses);
//    the prototype scene is taken as it is. Velocities compared body by body after the call, as they are, then with
//    the caps |v| <= 40 and |w| <= 30 applied to the prototype velocities: the module caps them at once, after each
//    action (as addBody does), the prototype at its next sub-step, after the solver.
// 4. Lowest vertex of blast200 (P29 a asks >= -0.015 in the 15 s after the blast; module step 7): each engine on its
//    own scene, blast before sub-step 241 (index 240, as the bench does), then 1 800 sub-steps.
import {readFileSync} from 'node:fs';
import {load, SCENES, YARD, WALLS30, lowest} from '../../../../../checks/fphysics-scenes.mjs';
import {SCENES as PROTO} from '../../../bancs/phys/scenes.mjs';

const F = load(), text = readFileSync(new URL('../../../bancs/phys/scenes.mjs', import.meta.url), 'utf8');
const fail = m => { console.log('ÉCART : ' + m); process.exitCode = 1; };
const gap = (a, b) => a.reduce((m, v, k) => Math.max(m, Math.abs(v - b[k])), 0);

console.log(`FPhysics ${F.VERSION} contre bancs/phys/scenes.mjs ; Node ${process.version}.\n`);
console.log('1. Données du prototype lues dans sa source');
const mat = [...text.match(/const MAT = \{(.*)\};/)[1].matchAll(/(\w+): \{ d: ([\d.]+), f: ([\d.]+), r: ([\d.]+) \}/g)]
  .map(m => ({name: m[1], density: +m[2], friction: +m[3], restitution: +m[4]}));
if (mat.length !== 5) fail('MAT: ' + mat.length + ' entries');
mat.forEach((m, k) => { for (const key of Object.keys(m)) if (F.MATERIALS[k][key] !== m[key]) fail(`MATERIALS[${k}].${key}`); });
console.log(`- matières : ${mat.map(m => `${m.name} (${m.density}, ${m.friction}, ${m.restitution})`).join(', ')} ; MATERIALS identique, dans le même ordre`);
const boxes = src => [...src.matchAll(/addStatic\(([^)]*)\)/g)].map(m => m[1].split(',').map(Number))
  .map(([x0, y0, z0, x1, y1, z1]) => ({minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1}));
for (const [label, mine, src] of [['rubble300 (walls)', YARD, text.match(/function walls[^\n]*\n([^\n]*)/)[1]], ['blast200', WALLS30, text.match(/export function blast200[^\n]*\n([^\n]*)/)[1]]]) {
  const theirs = boxes(src);
  if (theirs.length !== mine.length || theirs.some((b, k) => Object.keys(b).some(key => b[key] !== mine[k][key]))) fail(label + ' statics');
  console.log(`- statiques de ${label} : ${theirs.length} boîtes, identiques à ${mine === YARD ? 'YARD' : 'WALLS30'} ; le module ajoute la dalle du sol (ground: 0), le prototype son plan`);
}

console.log('\n2. Corps à la création');
for (const name of ['rubble300', 'blast200']) {
  const s = SCENES[name](F), p = PROTO[name](), pw = p.w;
  if (s.ids.length !== p.ids.length) fail(name + ' body count');
  let q = 0, clamped = 0, lo = Infinity, hi = -Infinity, slabs = 0;
  s.ids.forEach((h, k) => {
    const b = s.w.body(h), j = p.ids[k], i3 = j * 3;
    if (b.pos.some((v, c) => v !== pw.P[i3 + c])) fail(`${name} ${k} pos`);
    if (b.size.some((v, c) => v / 2 !== pw.H[i3 + c])) fail(`${name} ${k} size`);
    q = Math.max(q, gap(b.quat, [...pw.Q.subarray(j * 4, j * 4 + 4)]));
    pw.impulseAt(j, pw.P[i3], pw.P[i3 + 1], pw.P[i3 + 2], 1, 0, 0);
    if (1 / b.originalMass !== pw.V[j * 6]) fail(`${name} ${k} mass ${b.originalMass} against ${1 / pw.V[j * 6]}`);
    if (b.mass !== b.originalMass) clamped++;
    lo = Math.min(lo, b.originalMass); hi = Math.max(hi, b.originalMass);
    const barrel = name === 'blast200' && b.size[0] === 0.6 && b.size[1] === 0.9, m = mat[k % 5];
    const want = name === 'rubble300' ? [m.friction, m.restitution] : barrel ? [0.45, 0.24] : [0.6, 0.2];
    if (b.friction !== want[0] || b.restitution !== want[1]) fail(`${name} ${k} friction or restitution`);
    if (name === 'rubble300' && Math.min(...b.size) < 0.2) slabs++;
  });
  console.log(`- ${name} : ${s.ids.length} corps ; centres et demi-tailles identiques (===) ; quaternions à ${q.toExponential(2)} près ; masses identiques`
    + ` (${lo.toFixed(2)} à ${hi.toFixed(2)} kg), dont ${clamped} bornée(s) par le module à [3, 120] pour le solveur ; frottement et restitution identiques`
    + (name === 'rubble300' ? ` ; ${slabs} pièce(s) de moins de 20 cm d'épaisseur` : ''));
}

console.log('\n3. blast contre explode, avant tout sous-pas');
function asleepCopy(name) {
  const s = SCENES[name](F), w = F.create(s.w.config);
  w.setStatics(s.statics, []);
  const ids = s.ids.map(h => { const b = s.w.body(h); return w.addBody({size: b.size, pos: b.pos, quat: b.quat, mass: b.originalMass, friction: b.friction, restitution: b.restitution, asleep: true}); });
  return {w, ids};
}
// The caps of the module (cap(i) in src/physics.js), on a copy of the 6 prototype velocities of one body.
function capped(u) {
  const l = Math.hypot(u[0], u[1], u[2]), a = Math.hypot(u[3], u[4], u[5]), out = u.slice();
  if (u[0] * u[0] + u[1] * u[1] + u[2] * u[2] > 40 * 40) for (let c = 0; c < 3; c++) out[c] *= 40 / l;
  if (u[3] * u[3] + u[4] * u[4] + u[5] * u[5] > 30 * 30) for (let c = 3; c < 6; c++) out[c] *= 30 / a;
  return out;
}
for (const [name, args] of [['blast200', [0, 0.5, 0, 14, 900]], ['rubble300', [0, 2, 0, 5, 400]], ['rubble300', [2.5, 6, -2.5, 4, 150, 6]]]) {
  const {w, ids} = asleepCopy(name), p = PROTO[name](), n = w.blast(...args), m = p.w.explode(...args);
  let same = 0, raw = 0, spun = 0, sameCapped = 0, worst = 0, worstClamped = 0, pushedClamped = 0;
  ids.forEach((h, k) => {
    const b = w.body(h), j = p.ids[k], mine = [...b.vel, ...b.ang], theirs = [...p.w.V.subarray(j * 6, j * 6 + 6)], cut = capped(theirs);
    if (mine.every((v, c) => v === theirs[c])) same++;
    raw = Math.max(raw, gap(mine, theirs) / Math.max(1e-300, ...theirs.map(Math.abs)));
    if (Math.hypot(theirs[3], theirs[4], theirs[5]) > 30) spun++;
    const g = gap(mine, cut) / Math.max(1e-300, ...cut.map(Math.abs));
    if (b.mass !== b.originalMass) { worstClamped = Math.max(worstClamped, g); if (mine.some(v => v !== 0)) pushedClamped++; return; }
    if (mine.every((v, c) => v === cut[c])) sameCapped++;
    worst = Math.max(worst, g);
  });
  if (n !== m) fail(`${name} blast ${n} against explode ${m}`);
  if (worst > 1e-12) fail(`${name}: relative gap ${worst} on a body of unclamped mass, after the caps`);
  const free = ids.filter(h => { const b = w.body(h); return b.mass === b.originalMass; }).length;
  console.log(`- ${name}, blast(${args.join(', ')}) : ${n} corps poussés par le module, ${m} par explode ; brutes : ${same}/${ids.length} vitesses identiques bit à bit,`
    + ` écart relatif max ${raw.toFixed(2)} ; explode met ${spun} corps à plus de 30 rad/s. Bornes du module appliquées au prototype : ${sameCapped}/${free} corps de masse`
    + ` non bornée identiques bit à bit, écart relatif max ${worst.toExponential(2)}` + (pushedClamped ? ` ; ${pushedClamped} poussé(s) de masse bornée : écart relatif jusqu'à ${worstClamped.toFixed(2)} (masse physique du module, §4.7)` : ''));
}
console.log('\n4. Plus bas sommet de blast200, souffle avant le sous-pas 241 (P29 a : ≥ −15 mm pendant les 15 s qui suivent ; étape 7)');
function protoLowest(pw, list) {
  let m = Infinity;
  for (const b of list) {
    const q = b * 3, r = b * 9;
    for (let k = 0; k < 8; k++) {
      const y = pw.P[q + 1] + pw.R[r + 3] * (k & 1 ? pw.H[q] : -pw.H[q]) + pw.R[r + 4] * (k & 2 ? pw.H[q + 1] : -pw.H[q + 1]) + pw.R[r + 5] * (k & 4 ? pw.H[q + 2] : -pw.H[q + 2]);
      if (y < m) m = y;
    }
  }
  return m;
}
for (const who of ['module', 'prototype']) {
  const s = who === 'module' ? SCENES.blast200(F) : PROTO.blast200(), w = s.w, low = [Infinity, 0, Infinity, 0];
  for (let i = 0; i < 240 + 1800; i++) {
    if (who === 'module') s.tick(i); else if (i === 240) w.explode(0, 0.5, 0, 14, 900);
    if (who === 'module') w.step(1 / 120); else w.step(1 / 120, 1);
    const y = who === 'module' ? lowest(w, s.ids) : protoLowest(w, s.ids), k = i < 240 ? 0 : 2;
    if (y < low[k]) { low[k] = y; low[k + 1] = i + 1; }
  }
  console.log(`- ${who.padEnd(9)} : avant le souffle ${(low[0] * 1000).toFixed(2)} mm (sous-pas ${low[1]}) ; après ${(low[2] * 1000).toFixed(2)} mm (sous-pas ${low[3]}, ${low[3] - 240} après le souffle)`);
}
console.log(process.exitCode ? '\nRÉSULTAT : écarts (voir plus haut)'
  : '\nRÉSULTAT : scènes identiques au prototype ; blast = explode du prototype, à la masse physique bornée et aux bornes de vitesse appliquées tout de suite près');
