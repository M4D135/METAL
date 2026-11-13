// Module step 2a (task E2a): FPhysics against the prototype bancs/phys/fphys.mjs on the same ground slab.
// Run from the repository root: node docs/chantier-moteur/preuves/module-physique/E2a/compare-prototype.mjs
// Writes nothing (the output is copied in compare-prototype.txt). Main realm of Node, no clock, no random source.
//
// The prototype runs with ground: false plus the static box (-64, -0.5, -64)..(64, 0, 64), friction 0.8, restitution
// 0.05: the slab that FPhysics builds for ground: 0 (prototype-on-slab variant of the lead, run08). Same crates, same
// order of creation, one sub-step per call (step(1/120, 1)).
import {load, source, SCENES, NOSLEEP, drift, lowest} from '../../../../../checks/fphysics-scenes.mjs';
import {create as prototype} from '../../../bancs/phys/fphys.mjs';

const F = load(), STEPS = 1200, mm = v => (v * 1000).toFixed(2) + ' mm';

// The prototype twin of a module scene: same capacity, same crates (half-size 0.4, mass 30, friction 0.6, rest. 0.1).
function twin(scene, capacity, sleep) {
  const p = prototype({capacity, ground: false, ...(sleep ? {} : {sleepTime: 1e9})});
  p.addStatic(-64, -0.5, -64, 64, 0, 64, 0.8, 0.05); p.buildStatics();
  const ids = scene.ideal.map(([x, y, z]) => p.addBox(x, y, z, 0.4, 0.4, 0.4, 30, 0.6, 0.1));
  return {p, ids};
}
// Prototype diagnostics, read on its own arrays (as bancs/phys/drift.mjs and run08 do).
const protoDrift = (p, ids, ideal) => ids.reduce((m, b, k) => Math.max(m, Math.hypot(p.P[b * 3] - ideal[k][0], p.P[b * 3 + 2] - ideal[k][2])), 0);
function protoLowest(p, ids) {
  let m = Infinity;
  for (const b of ids) {
    const q = b * 3, r = b * 9;
    for (let k = 0; k < 8; k++) {
      const y = p.P[q + 1] + p.R[r + 3] * (k & 1 ? p.H[q] : -p.H[q]) + p.R[r + 4] * (k & 2 ? p.H[q + 1] : -p.H[q + 1]) + p.R[r + 5] * (k & 4 ? p.H[q + 2] : -p.H[q + 2]);
      if (y < m) m = y;
    }
  }
  return m;
}
// Diagnostics of one run: drift at 1, 5, 10 s, lowest vertex (whole run and from 1 s), top settling.
function track() { return {drift: [], low: Infinity, lowAt: 0, late: Infinity, lateAt: 0}; }
function note(d, i, y, dr) {
  if (y < d.low) { d.low = y; d.lowAt = i; }
  if (i >= 120 && y < d.late) { d.late = y; d.lateAt = i; }
  if (i === 120 || i === 600 || i === 1200) d.drift.push(dr());
}
const show = (who, d) => `${who.padEnd(10)} dérive ${d.drift.map(mm).join(' / ')} (1 / 5 / 10 s) ; plus bas sommet ${mm(d.late)} de 1 à 10 s (sous-pas ${d.lateAt}), ${mm(d.low)} sur tout l'essai (sous-pas ${d.lowAt})`;

console.log(`FPhysics ${F.VERSION}, src/physics.js ${Buffer.byteLength(source())} octets ; Node ${process.version} ; ${STEPS} sous-pas de 1/120 s par essai.\n`);
console.log('1. Identité bit à bit avec le prototype sur la dalle (P, Q et V de chaque caisse, après chaque sous-pas, comparés par ===).');
for (const name of ['stack10', 'pyramid55']) for (const sleep of [false, true]) {
  const scene = SCENES[name](F, sleep ? {} : NOSLEEP), {w, ids, ideal} = scene, {p, ids: pids} = twin(scene, w.config.capacity, sleep);
  const dm = track(), dp = track();
  let first = null, compared = 0, sleepM = -1, sleepP = -1, awakeZero = -1;
  for (let i = 1; i <= STEPS; i++) {
    w.step(1 / 120); p.step(1 / 120, 1);
    for (let k = 0; k < ids.length && !first; k++) {
      const b = w.body(ids[k]), j = pids[k];
      const mine = [...b.pos, ...b.quat, ...b.vel, ...b.ang];
      const theirs = [...p.P.subarray(j * 3, j * 3 + 3), ...p.Q.subarray(j * 4, j * 4 + 4), ...p.V.subarray(j * 6, j * 6 + 6)];
      for (let c = 0; c < 13; c++) { compared++; if (mine[c] !== theirs[c]) { first = `sous-pas ${i}, caisse ${k}, composante ${c} : ${mine[c]} contre ${theirs[c]}`; break; } }
    }
    if (!sleep) { note(dm, i, lowest(w, ids), () => drift(w, ids, ideal)); note(dp, i, protoLowest(p, pids), () => protoDrift(p, pids, ideal)); }
    if (sleepM < 0 && ids.every(h => w.isAsleep(h))) sleepM = i;
    if (sleepP < 0 && pids.every(j => (p.FL[j] & 2) !== 0)) sleepP = i;
    if (awakeZero < 0 && i > 5 && p.stats.awake === 0) awakeZero = i;
  }
  console.log(`- ${name.padEnd(9)} ${sleep ? 'par défaut' : 'NOSLEEP   '} : ${first ? 'ÉCART au ' + first : `identique sur ${STEPS} sous-pas (${compared} valeurs)`} ; hachage du module ${w.hash()}`);
  if (sleep) console.log(`  sommeil : toutes les caisses dorment à la fin du sous-pas ${sleepM} (${(sleepM / 120).toFixed(3)} s) dans le module, ${sleepP} dans le prototype ; le prototype lit stats.awake = 0 au début de l'appel suivant, d'où ${awakeZero} (${(awakeZero / 120).toFixed(3)} s) dans run08.`);
  else {
    console.log('  ' + show('module', dm));
    console.log('  ' + show('prototype', dp));
    if (name === 'stack10') console.log(`  tassement du sommet à 10 s : module ${mm(ideal[9][1] - w.body(ids[9]).pos[1])}, prototype ${mm(ideal[9][1] - p.P[pids[9] * 3 + 1])} (attendu ≈ 85 mm)`);
  }
}

// 2. The literal reading of the brief (§5.2 last line, §5.6: separation cS + cSl in every pass, relaxation included).
const LINE = 's=useBias?cS[c]+cSl[c]:cSR[c]';
if (!source().includes(LINE)) throw new Error('relaxation separation line not found in src/physics.js');
const L = {}; new Function('window', source().replace(LINE, 's=cS[c]+cSl[c]'))(L);
console.log('\n2. Variante « sans D » (lecture littérale du §5.2 et du §5.6 : séparation cS + cSl aussi pendant la relaxation), même module, ligne remplacée au chargement :');
for (const name of ['stack10', 'pyramid55']) {
  const {w, ids, ideal} = SCENES[name](L.FPhysics, NOSLEEP), d = track();
  for (let i = 1; i <= STEPS; i++) { w.step(1 / 120); note(d, i, lowest(w, ids), () => drift(w, ids, ideal)); }
  const s = SCENES[name](L.FPhysics); let at = -1;
  for (let i = 1; i <= STEPS && at < 0; i++) { s.w.step(1 / 120); if (s.ids.every(h => s.w.isAsleep(h))) at = i; }
  console.log(`- ${name.padEnd(9)} ${show('sans D', d)} ; endormie au sous-pas ${at} (${(at / 120).toFixed(3)} s)`);
}
console.log('  Seuils de P11 et P12 : dérive < 30 mm (pile) et < 20 mm (pyramide) à 10 s, plus bas sommet ≥ -12 mm.');
