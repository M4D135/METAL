// FPhysics tests (lot 17, module side). Run: node --test checks/fphysics.test.mjs
// Not in npm test until the module is wired into the game (see docs/chantier-moteur/modules/physique.md, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import {source, load, loadVm, lcg, B64, NOSLEEP, SCENES, runChain, crate, drift, lowest} from './fphysics-scenes.mjs';

const SMALL = Object.freeze({capacity: 8, maxContacts: 256, maxStatics: 16, maxJoints: 4});

// Settings after bounds, in the order of the module brief (§4.4), with their defaults.
const ORDER = [
  ['cell', 2], ['gravity', -12], ['ground', null], ['floorThickness', 0.5], ['minY', -60], ['tick', 1 / 120],
  ['maxSubsteps', 8], ['capacity', 384], ['maxStatics', 4096], ['maxContacts', 16384], ['maxJoints', 128],
  ['iterations', 2], ['relaxIterations', 1], ['hardIterations', 4], ['hardRelaxIterations', 2], ['hardRatio', 8],
  ['contactHertz', 30], ['dampingRatio', 10], ['pushout', 3], ['restitutionThreshold', 1], ['jointHertz', 60],
  ['jointDampingRatio', 2], ['linearDamping', 0.02], ['angularDamping', 0.06], ['rollingDamping', 2],
  ['maxLinear', 40], ['maxAngular', 30], ['margin', 0.02], ['slop', 0.005], ['slopRatio', 0.12], ['minHalf', 0.02],
  ['sleepLinear', 0.08], ['sleepAngular', 0.12], ['sleepTime', 0.5], ['splitTime', 1], ['fallbackTime', 6],
  ['fallbackDistance', 0.002], ['wakeSpeed', 0.25], ['supportSpeed', 0.08], ['massMin', 3], ['massMax', 120],
  ['maxAwake', 160], ['spawnBudget', 24], ['eventSpeed', 1.2], ['maxEvents', 16],
];

// FNV-1a 32 bits over character codes, written from the brief (§5.11), independent of the module.
function fnvText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
function expectedFingerprint(options) {
  const b = options.bounds, values = [b.minX, b.maxX, b.minZ, b.maxZ];
  for (const [name, def] of ORDER) { const v = options[name] === undefined ? def : options[name]; values.push(v === null ? 'none' : v); }
  return fnvText('FPhysics2|' + values.join('|'));
}

// Game rotation matrix of [rx, ry, rz], M = Rz*Ry*Rx, row by row (brief §4.2).
function gameMatrix(rx, ry, rz) {
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  return [e * c, e * d * b - f * a, e * d * a + f * b, f * c, f * d * b + e * a, f * d * a - e * b, -d, c * b, c * a];
}
// Rotation of a unit quaternion, formula of derive() in the prototype (R[3*row+col]).
function quatMatrix(x, y, z, w) {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)];
}
const gap = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

// ---- Shape and guards ----

test('P01 Chargement : un seul global FPhysics, matières gelées, chargement vm', () => {
  const w0 = {};
  new Function('window', source())(w0);
  assert.deepEqual(Object.keys(w0), ['FPhysics']);
  assert.equal(globalThis.FPhysics, undefined, 'the host global object is left untouched');
  const F = w0.FPhysics;
  assert.equal(F.VERSION, 2);
  assert.deepEqual(Object.keys(F), ['VERSION', 'MATERIALS', 'create', 'eulerToQuat', 'quatToEuler']);
  for (const name of ['create', 'eulerToQuat', 'quatToEuler']) assert.equal(typeof F[name], 'function', name);
  assert.ok(Object.isFrozen(F.MATERIALS));
  const table = [['metal', 0.45, 0.24, 65], ['stone', 0.70, 0.16, 28], ['wood', 0.55, 0.22, 8], ['glass', 0.35, 0.16, 25], ['dirt', 0.80, 0.05, 12]];
  assert.equal(F.MATERIALS.length, table.length);
  table.forEach(([name, friction, restitution, density], i) => {
    const m = F.MATERIALS[i];
    assert.ok(Object.isFrozen(m), name + ' is frozen');
    assert.deepEqual({...m}, {name, friction, restitution, density});
  });
  assert.throws(() => { F.MATERIALS[0].friction = 1; }, TypeError, 'a module is strict: writing a frozen material throws');
  const L = load(), V = loadVm();
  for (const X of [L, V]) {
    assert.equal(X.VERSION, 2);
    assert.equal(JSON.stringify(X.MATERIALS), JSON.stringify(F.MATERIALS));
    assert.equal(X.create({bounds: B64}).fingerprint, F.create({bounds: B64}).fingerprint);
  }
  assert.notEqual(L, F, 'every load gives a fresh module');
});

// Lexical rules of the module source (brief §2, rules 3 to 5; test P02). Returns the list of problems.
const BANNED = [
  /Math\.random/, /\bDate\b/, /\bperformance\b/, /\*\*/,
  /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, /\bprocess\b/,
  /^\s*(import|export)\b/m, /\brequire\s*\(/,
  /fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\(|@import/, /<\/script/i,
  /\bMETAL\b/,
  /rubble|debris|gravat|grenade|rocket|roquette|enemy|ennemi|player|joueur|weapon|FSimulation|FWorld|walkable/i,
];
const MATH_BASE = new Set(['sqrt', 'abs', 'floor', 'imul', 'min', 'max', 'PI']);
const MATH_TRIG = new Set([...MATH_BASE, 'sin', 'cos', 'atan2', 'asin']);
function sourceProblems(text, counts = {blocks: 0, members: 0}) {
  const problems = [];
  for (const pattern of BANNED) {
    const found = text.match(pattern);
    if (found) problems.push(`motif interdit ${pattern} : « ${found[0]} »`);
  }
  let inside = false;
  text.split('\n').forEach((line, n) => {
    const marker = /^\s*\/\/ TRIG-(BEGIN|END)\b/.exec(line);
    if (marker) {
      if (marker[1] === 'BEGIN') { if (inside) problems.push(`TRIG-BEGIN imbriqué, ligne ${n + 1}`); inside = true; counts.blocks++; }
      else { if (!inside) problems.push(`TRIG-END sans TRIG-BEGIN, ligne ${n + 1}`); inside = false; }
      return;
    }
    for (const [, name] of line.matchAll(/\bMath\.([A-Za-z_$][\w$]*)/g)) {
      counts.members++;
      if (!(inside ? MATH_TRIG : MATH_BASE).has(name)) problems.push(`Math.${name} interdit ${inside ? 'même en bloc TRIG' : 'hors bloc TRIG'}, ligne ${n + 1}`);
    }
  });
  if (inside) problems.push('bloc TRIG non fermé');
  if (!text.startsWith('/* FERRO — FPhysics')) problems.push('en-tête autre que « /* FERRO — FPhysics »');
  if (!text.includes("'use strict'")) problems.push("'use strict' absent");
  return problems;
}

test('P02 Source : taille, motifs interdits, membres de Math, blocs TRIG', t => {
  const text = source(), bytes = Buffer.byteLength(text, 'utf8'), counts = {blocks: 0, members: 0};
  t.diagnostic(`src/physics.js : ${bytes} octets`);
  assert.ok(bytes <= 80000, `src/physics.js fait ${bytes} octets (plafond 80 000)`);
  if (bytes > 60000) t.diagnostic(`au-dessus de la cible de 60 000 octets : ${bytes}`);
  assert.deepEqual(sourceProblems(text, counts), []);
  assert.ok(counts.blocks >= 1, 'au moins un bloc TRIG (conversions d\'angles)');
  t.diagnostic(`${counts.blocks} bloc(s) TRIG, ${counts.members} appels à Math vérifiés`);
  // The guard itself: each of these alterations of the real source must be caught.
  const trigEnd = '  // TRIG-END\n';
  assert.ok(text.includes(trigEnd), 'TRIG-END marker found');
  const altered = [
    text + '\nMath.random();', text + '\nconst t0 = Date.now();', text + '\nperformance.now();', text + '\nconst p = 2 ** 3;',
    text + '\n/** doc */', text + '\nsetTimeout(f);', text + '\nprocess.exit();', text + '\n/*\nexport x\n*/',
    text + '\nrequire ("fs");', text + '\nfetch(u);', text + '\nimport("x");', text + '\n// </script>',
    text + '\n// METAL', text + '\n// multiplayer', text + '\n// Debris', text + '\n// walkable floors',
    text + '\nMath.sin(1);', text + '\nMath.round(1);', text.replace(trigEnd, '  Math.hypot(1, 2);\n' + trigEnd),
    text + '\n  // TRIG-BEGIN\n', text.replace(trigEnd, ''), text + '\n  // TRIG-END\n',
    text.replace("'use strict'", "'use sloppy'"), text.slice(text.indexOf('\n') + 1),
  ];
  altered.forEach((bad, k) => assert.ok(sourceProblems(bad).length > 0, `altération n° ${k + 1} non détectée`));
});

test('P03 Angles : quaternions unitaires, matrice du jeu, aller-retour, blocage de cardan', t => {
  const F = load(), r = lcg(31);
  let norm = 0, matrix = 0, back = 0;
  for (let k = 0; k < 1000; k++) {
    const rx = (r() - 0.5) * 6, ry = (r() - 0.5) * 3, rz = (r() - 0.5) * 6;
    const q = F.eulerToQuat(rx, ry, rz), m = gameMatrix(rx, ry, rz);
    norm = Math.max(norm, Math.abs(Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) - 1));
    matrix = Math.max(matrix, gap(quatMatrix(...q), m));
    back = Math.max(back, gap(gameMatrix(...F.quatToEuler(...q)), m));
  }
  t.diagnostic(`1 000 triplets : |q| - 1 ≤ ${norm.toExponential(2)}, matrice ≤ ${matrix.toExponential(2)}, aller-retour ≤ ${back.toExponential(2)}`);
  assert.ok(norm <= 1e-12, 'unit quaternions');
  assert.ok(matrix <= 1e-12, 'quaternion matrix equals the game matrix');
  assert.ok(back <= 1e-9, 'quatToEuler gives back the same matrix');
  for (const ry of [Math.PI / 2, -Math.PI / 2]) {
    const q = F.eulerToQuat(0.3, ry, -0.4), e = F.quatToEuler(...q), m = gameMatrix(0.3, ry, -0.4);
    assert.equal(e[0], 0, 'gimbal lock: rx = 0');
    const g1 = gap(quatMatrix(...q), m), g2 = gap(gameMatrix(...e), m);
    t.diagnostic(`blocage de cardan ry = ${ry.toFixed(4)} : matrice ${g1.toExponential(2)}, aller-retour ${g2.toExponential(2)}`);
    assert.ok(g1 <= 1e-12 && g2 <= 1e-6);
  }
  assert.deepEqual(F.eulerToQuat(0, 0, 0), [0, 0, 0, 1]);
  const out4 = [9, 9, 9, 9], out3 = [9, 9, 9];
  assert.equal(F.eulerToQuat(0.1, 0.2, 0.3, out4), out4, 'eulerToQuat fills and returns out');
  assert.equal(F.quatToEuler(...out4, out3), out3, 'quatToEuler fills and returns out');
  assert.ok(gap(out3, [0.1, 0.2, 0.3]) <= 1e-12, 'regular case gives the same angles back');
  assert.equal(F.quatToEuler(0, 0, 0, 1).length, 3);
});

test('P04 Création : validation, réglages par défaut, empreinte', t => {
  const F = load();
  const bad = [
    undefined, null, 42, {}, {bounds: null}, {bounds: {minX: -1, maxX: 1, minZ: -1}},
    {bounds: {minX: 1, maxX: 1, minZ: -1, maxZ: 1}}, {bounds: {minX: 2, maxX: 1, minZ: -1, maxZ: 1}},
    {bounds: {minX: -1, maxX: 1, minZ: 1, maxZ: 1}}, {bounds: {minX: NaN, maxX: 1, minZ: -1, maxZ: 1}},
    {bounds: {minX: '-1', maxX: 1, minZ: -1, maxZ: 1}},
  ];
  const badSettings = [
    ['capacity', 5000], ['capacity', 0], ['capacity', 4096], ['capacity', 2.5], ['capacity', '384'], ['capacity', NaN],
    ['maxStatics', 0], ['maxStatics', 65536], ['maxContacts', 0], ['maxContacts', 1048577], ['maxJoints', -1], ['maxJoints', 4096],
    ['maxSubsteps', 0], ['iterations', 0], ['iterations', 1.5], ['relaxIterations', -1], ['hardIterations', -1],
    ['hardRelaxIterations', -1], ['maxAwake', -1], ['spawnBudget', 0], ['maxEvents', -1],
    ['cell', 0], ['cell', -2], ['cell', Infinity], ['tick', 0], ['tick', NaN], ['floorThickness', 0], ['contactHertz', 0],
    ['jointHertz', 0], ['maxLinear', 0], ['maxAngular', 0], ['massMin', 0], ['massMax', -1], ['massMin', 200],
    ['linearDamping', -0.01], ['slop', -1], ['sleepTime', -1], ['hardRatio', -1], ['margin', -0.02],
    ['gravity', NaN], ['gravity', '12'], ['minY', Infinity], ['ground', NaN], ['ground', 'none'], ['ground', false],
    ['clock', 5], ['clock', 'now'],
  ];
  for (const [name, value] of badSettings) bad.push({bounds: B64, ...SMALL, [name]: value});
  for (const options of bad) assert.throws(() => F.create(options), {name: 'TypeError', message: /^FPhysics\.create: /}, JSON.stringify(options));
  t.diagnostic(`${bad.length} jeux d'options invalides refusés par TypeError`);
  const good = [
    {bounds: B64, ...SMALL, ground: 0}, {bounds: B64, ...SMALL, ground: -3.2}, {bounds: B64, ...SMALL, gravity: 0},
    {bounds: B64, ...SMALL, sleepLinear: 0}, {bounds: B64, ...SMALL, capacity: 1}, {bounds: B64, ...SMALL, capacity: 4095},
    {bounds: B64, ...SMALL, maxJoints: 0}, {bounds: B64, ...SMALL, maxStatics: 65535}, {bounds: B64, ...SMALL, clock: () => 0},
    {bounds: B64, ...SMALL, clock: null}, {bounds: B64, ...SMALL, massMin: 120, massMax: 120}, {bounds: B64, ...SMALL, ...NOSLEEP},
  ];
  for (const options of good) assert.doesNotThrow(() => F.create(options), Object.keys(options).join(','));

  const w = F.create({bounds: B64}), c = w.config;
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.bounds), 'config is frozen');
  assert.equal(c.tick, 1 / 120);
  assert.equal(c.capacity, 384);
  for (const [name, def] of ORDER) assert.equal(c[name], def, name);
  assert.deepEqual({...c.bounds}, {...B64});
  assert.ok(!('clock' in c), 'clock is never part of config');
  // Durations in whole sub-steps: Math.floor(duration / tick + 0.5).
  assert.deepEqual([c.sleepSteps, c.splitSteps, c.fallbackSteps, c.windowSteps], [60, 120, 720, 120]);
  const odd = F.create({bounds: B64, ...SMALL, tick: 0.007}).config;
  assert.deepEqual([odd.sleepSteps, odd.splitSteps, odd.fallbackSteps, odd.windowSteps], [71, 143, 857, 143]);
  assert.equal(F.create({bounds: B64, ...SMALL, ...NOSLEEP}).config.sleepSteps, 120000000000);
  for (const x of [c, odd]) for (const k of ['sleepSteps', 'splitSteps', 'fallbackSteps', 'windowSteps']) assert.ok(Number.isInteger(x[k]), k);

  // Fingerprint: 8 hex digits, the FNV-1a of the brief, same settings same value, any setting changes it.
  assert.match(w.fingerprint, /^[0-9a-f]{8}$/);
  assert.equal(w.fingerprint, expectedFingerprint({bounds: B64}));
  assert.equal(F.create({bounds: {...B64}}).fingerprint, w.fingerprint);
  assert.notEqual(F.create({bounds: B64, iterations: 3}).fingerprint, w.fingerprint);
  assert.equal(F.create({bounds: B64, unknownKey: 1, clock: () => 0}).fingerprint, w.fingerprint, 'unknown keys and clock are ignored');
  const again = F.create(c);
  assert.equal(again.fingerprint, w.fingerprint, 'config can be fed back to create');
  assert.deepEqual({...again.config}, {...c});
  const small = F.create({bounds: B64, ...SMALL});
  assert.equal(small.fingerprint, expectedFingerprint({bounds: B64, ...SMALL}));
  const seen = new Map([[small.fingerprint, 'base']]);
  const variants = [['bounds.minX', {bounds: {...B64, minX: -63}}], ['bounds.maxX', {bounds: {...B64, maxX: 63}}],
    ['bounds.minZ', {bounds: {...B64, minZ: -63}}], ['bounds.maxZ', {bounds: {...B64, maxZ: 63}}]];
  for (const [name] of ORDER) {
    const v = small.config[name];
    variants.push([name, {[name]: v === null ? 0 : Number.isInteger(v) ? v + 1 : v * 1.5}]);
  }
  for (const [name, change] of variants) {
    const options = {bounds: B64, ...SMALL, ...change}, fp = F.create(options).fingerprint;
    assert.equal(fp, expectedFingerprint(options), name);
    assert.ok(!seen.has(fp), `${name} gives a new fingerprint (same as ${seen.get(fp)})`);
    seen.set(fp, name);
  }
  // -0 is normalised in config and does not change the fingerprint.
  const z = F.create({bounds: {...B64, minZ: -0}, ...SMALL, ground: -0, gravity: -0}).config;
  assert.ok(Object.is(z.ground, 0) && Object.is(z.gravity, 0) && Object.is(z.bounds.minZ, 0));
  t.diagnostic(`empreinte par défaut sur B64 : ${w.fingerprint} ; ${variants.length} réglages, chacun change l'empreinte`);
});

// ---- One body (module step 2a) ----

test('P05 Chute libre exacte', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, linearDamping: 0, angularDamping: 0});
  const h = w.addBody({size: [1, 1, 1], pos: [0, 10, 0], mass: 10});
  for (let i = 0; i < 120; i++) w.step(1 / 120);
  const b = w.body(h);
  t.diagnostic(`après 120 sous-pas : y = ${b.pos[1]}, vy = ${b.vel[1]} (attendu 3,95 et -12, Euler semi-implicite)`);
  assert.ok(Math.abs(b.pos[1] - 3.95) <= 1e-9, 'y = 3.95');
  assert.ok(Math.abs(b.vel[1] + 12) <= 1e-9, 'vy = -12');
  assert.deepEqual([b.pos[0], b.pos[2], ...b.ang, b.vel[0], b.vel[2]], [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(b.quat, [0, 0, 0, 1]);
  const w2 = F.create({bounds: B64, ...SMALL});
  w2.addBody({size: [1, 1, 1], pos: [0, 10, 0], mass: 10});
  assert.equal(w2.step(1 / 240), 0, 'half a tick: no sub-step');
  assert.equal(w2.step(1 / 240), 1, 'second half: one sub-step');
});

test('P06 Repos', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0}), h = crate(w, 0, 0.401, 0);
  let asleepAt = -1;
  for (let i = 1; i <= 240; i++) { w.step(1 / 120); if (asleepAt < 0 && w.isAsleep(h)) asleepAt = i; }
  const b = w.body(h), y = b.pos[1], sl = Math.min(w.config.slop, w.config.slopRatio * 0.4);
  t.diagnostic(`au bout de 2 s : y = ${y.toFixed(6)} (enfoncement ${((0.4 - y) * 1000).toFixed(2)} mm), endormie au sous-pas ${asleepAt}`);
  assert.ok(y >= 0.393 && y <= 0.401, `y = ${y}`);
  assert.ok(w.isAsleep(h) && b.asleep, 'asleep');
  assert.deepEqual([...b.vel, ...b.ang], [0, 0, 0, 0, 0, 0], 'zero velocities');
  assert.ok(Math.abs(w.pose(h, 1)[1] - (y + sl / 2)) <= 1e-12, 'pose raised by SL/2');
});

// ---- Stacks (module step 2a: no internal faces yet) ----

// Runs a scene for `steps` sub-steps: drift at the given sub-steps, lowest vertex over the whole run and from `from` on.
function settleRun(scene, steps, marks, from) {
  const {w, ids, ideal} = scene, out = {drift: {}, low: Infinity, lowAt: 0, lowLate: Infinity, lowLateAt: 0};
  for (let i = 1; i <= steps; i++) {
    w.step(1 / 120);
    const y = lowest(w, ids);
    if (y < out.low) { out.low = y; out.lowAt = i; }
    if (i >= from && y < out.lowLate) { out.lowLate = y; out.lowLateAt = i; }
    if (marks.includes(i)) out.drift[i] = drift(w, ids, ideal);
  }
  return out;
}
// Sub-step at which every body of the scene is asleep, or -1 within `steps`.
function sleepRun(scene, steps) {
  const {w, ids} = scene;
  for (let i = 1; i <= steps; i++) { w.step(1 / 120); if (ids.every(h => w.isAsleep(h))) return i; }
  return -1;
}
const mm = v => (v * 1000).toFixed(2) + ' mm';

test('P11 Pile de 10 (stack10)', t => {
  const F = load(), scene = SCENES.stack10(F, NOSLEEP), r = settleRun(scene, 1200, [120, 600, 1200], 120);
  const settle = scene.ideal[9][1] - scene.w.body(scene.ids[9]).pos[1];
  t.diagnostic(`NOSLEEP : dérive ${mm(r.drift[120])} à 1 s, ${mm(r.drift[600])} à 5 s, ${mm(r.drift[1200])} à 10 s (seuil 30 mm ; prototype sur dalle 30,7 / 16,8 / 23,4)`);
  t.diagnostic(`tassement du sommet à 10 s : ${mm(settle)} (attendu ≈ 85 mm)`);
  t.diagnostic(`plus bas sommet : ${mm(r.lowLate)} de 1 s à 10 s (sous-pas ${r.lowLateAt}) ; ${mm(r.low)} sur tout l'essai (sous-pas ${r.lowAt}, chute initiale)`);
  assert.ok(r.drift[1200] < 0.030, `drift ${r.drift[1200]}`);
  assert.ok(r.lowLate >= -0.012, `lowest vertex ${r.lowLate} from 1 s`);
  const at = sleepRun(SCENES.stack10(F), 480);
  t.diagnostic(`réglages par défaut : toute la pile dort au sous-pas ${at} (${(at / 120).toFixed(3)} s)`);
  assert.ok(at > 0 && at < 480, 'asleep before 4 s');
});

test('P12 Pyramide de 55 (pyramid55)', t => {
  const F = load(), scene = SCENES.pyramid55(F, NOSLEEP), r = settleRun(scene, 1200, [120, 600, 1200], 120);
  t.diagnostic(`NOSLEEP : dérive ${mm(r.drift[120])} à 1 s, ${mm(r.drift[600])} à 5 s, ${mm(r.drift[1200])} à 10 s (seuil 20 mm ; prototype sur dalle 9,6 / 16,4 / 19,4)`);
  t.diagnostic(`plus bas sommet : ${mm(r.lowLate)} de 1 s à 10 s (sous-pas ${r.lowLateAt}) ; ${mm(r.low)} sur tout l'essai (sous-pas ${r.lowAt}, chute initiale)`);
  assert.ok(r.drift[1200] < 0.020, `drift ${r.drift[1200]}`);
  assert.ok(r.lowLate >= -0.012, `lowest vertex ${r.lowLate} from 1 s`);
  const at = sleepRun(SCENES.pyramid55(F), 1200);
  t.diagnostic(`réglages par défaut : tout dort au sous-pas ${at} (${(at / 120).toFixed(3)} s)`);
  assert.ok(at > 0 && at < 1200, 'asleep before 10 s');
});

// ---- Determinism and saving (module step 2a: bodies and cache) ----

test('P45 Aller-retour JSON', t => {
  const F = load();
  for (const [name, steps] of [['stack10', 100], ['pyramid55', 1200]]) {
    const {w, ids} = SCENES[name](F);
    for (let i = 0; i < steps; i++) w.step(1 / 120);
    if (name === 'pyramid55') {
      assert.ok(ids.every(h => w.isAsleep(h)), 'pyramid55 is asleep at 1 200');
      assert.ok(w.snapshot().c.n > 0, 'the impulse cache is kept while everything sleeps');
    }
    const text = JSON.stringify(w.snapshot()), snap = JSON.parse(text);
    const w2 = F.create(w.config);
    assert.equal(w2.staticsHash, w.staticsHash, 'same statics');
    assert.notEqual(w2.hash(), w.hash());
    w2.restore(snap);
    assert.equal(w2.hash(), w.hash(), name + ': same hash after restore');
    assert.deepStrictEqual(w2.snapshot(), snap, name + ': same snapshot after restore');
    const before = w.hash();
    for (let i = 0; i < 300; i++) { w.step(1 / 120); w2.step(1 / 120); }
    assert.equal(w2.hash(), w.hash(), name + ': same hash 300 sub-steps later');
    if (name === 'pyramid55') assert.equal(w.hash(), before, 'a sleeping pyramid does not change');
    t.diagnostic(`${name} à ${steps} sous-pas : ${before}, puis ${w.hash()} des deux côtés 300 sous-pas plus tard ; instantané de ${text.length} caractères, cache de ${snap.c.n} entrées`);
  }
});

test('P46 snapshot ne modifie rien', t => {
  const F = load();
  for (const name of ['stack10', 'pyramid55']) {
    const a = SCENES[name](F).w, b = SCENES[name](F).w;
    for (let i = 1; i <= 300; i++) {
      a.step(1 / 120); b.step(1 / 120);
      if (i % 10 === 0) { const h = b.hash(); b.snapshot(); assert.equal(b.hash(), h, 'snapshot() leaves the hash'); }
    }
    assert.equal(b.hash(), a.hash(), name + ': a snapshot every 10 sub-steps changes nothing');
    t.diagnostic(`${name} : ${a.hash()} après 300 sous-pas, avec ou sans instantanés ; chaîne ${runChain(F, name, 300)}`);
  }
});

// ---- Module step 2a: guards of the box core ----

test('Étape 2a — corps : description, poignées, body()', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, capacity: 4, ground: 0});
  const base = {size: [0.8, 0.8, 0.8], pos: [0, 1, 0], mass: 30};
  const bad = [undefined, null, 5, {}, {...base, size: [1, 1]}, {...base, size: [0, 1, 1]}, {...base, pos: undefined},
    {...base, pos: [0, NaN, 0]}, {...base, quat: [0, 0, 0, 0]}, {...base, quat: [0, 0, 0, 1], rot: [0, 0, 0]},
    {...base, mass: 0}, {...base, mass: -1}, {...base, mass: '30'}, {...base, mass: undefined}, {...base, material: 'gold'},
    {...base, material: 5}, {...base, friction: 3}, {...base, restitution: -0.1}, {...base, group: 70000}, {...base, mask: 1.5},
    {...base, kinematic: true}, {...base, kinematic: 'yes'}, {...base, asleep: 1}, {...base, shape: 'sphere'},
    {...base, shape: 'cylinder'}, {...base, vel: [0, 0]}];
  for (const d of bad) assert.throws(() => w.addBody(d), {name: 'TypeError', message: /^FPhysics\.addBody: /}, JSON.stringify(d));
  assert.equal(w.stats.bodies, 0, 'nothing added by an invalid description');
  const h1 = w.addBody({...base, quat: [0, 0, 0, 2], vel: [100, 0, 0], mass: 1});
  const h2 = w.addBody({size: [0.5, 0.4, 0.2], pos: [2, 1, 0], material: 'wood', rot: [0, Math.PI / 2, 0], group: 6, mask: 3});
  const h3 = w.addBody({size: [0.8, 0.01, 0.8], pos: [-2, 1, 0], mass: 500, asleep: true});
  const h4 = w.addBody(base);
  assert.deepEqual([h1, h2, h3, h4], [1, 2, 3, 4], 'handles gen*4096 + index, lowest free index');
  assert.equal(w.addBody(base), -1, 'full: -1');
  assert.equal(w.stats.refused, 1);
  assert.deepEqual([w.stats.bodies, w.stats.pending, w.stats.sleeping], [4, 3, 1]);
  for (const h of [0, -1, 5, 4096 + 1, 1.5, '1', null]) {
    assert.equal(w.valid(h), false, String(h));
    assert.equal(w.body(h), null);
    assert.equal(w.pose(h, 1), null);
    assert.equal(w.matrix(h), null);
    assert.equal(w.isAsleep(h), false);
    assert.equal(w.isLost(h), false);
  }
  const b1 = w.body(h1);
  assert.deepEqual(Object.keys(b1), ['handle', 'shape', 'size', 'radius', 'height', 'realSize', 'pos', 'quat', 'vel', 'ang', 'mass',
    'originalMass', 'material', 'friction', 'restitution', 'group', 'mask', 'kinematic', 'asleep', 'pending', 'lost', 'hard']);
  assert.deepEqual(b1.quat, [0, 0, 0, 1], 'quat normalised');
  assert.deepEqual(b1.vel, [40, 0, 0], 'speed capped at maxLinear');
  assert.deepEqual([b1.mass, b1.originalMass, b1.friction, b1.restitution, b1.material, b1.group, b1.mask], [3, 1, 0.6, 0.1, -1, 2, 65535]);
  assert.deepEqual([b1.pending, b1.asleep, b1.kinematic, b1.lost, b1.hard, b1.shape], [true, false, false, false, false, 'box']);
  const b2 = w.body(h2), wood = F.MATERIALS[2];
  assert.deepEqual([b2.material, b2.friction, b2.restitution, b2.group, b2.mask], [2, wood.friction, wood.restitution, 6, 3]);
  assert.equal(b2.originalMass, wood.density * 0.5 * 0.4 * 0.2, 'mass = density x volume');
  assert.equal(b2.mass, 3, 'physical mass at least massMin');
  assert.deepEqual(b2.quat, F.eulerToQuat(0, Math.PI / 2, 0), 'rot goes through eulerToQuat');
  const b3 = w.body(h3);
  assert.deepEqual([b3.mass, b3.originalMass, b3.asleep, b3.pending], [120, 500, true, false]);
  assert.deepEqual([b3.size[1], b3.realSize[1]], [2 * w.config.minHalf, 0.01], 'collision size at least 2 minHalf');
});

test('Étape 2a — attente, création endormie, réveil différé', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const sleeper = w.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, asleep: true});
  const falling = crate(w, 0.2, 1.6, 0);
  assert.equal(w.step(0), 0);
  assert.ok(w.body(falling).pending, 'still pending without a sub-step');
  w.step(1 / 120);
  assert.ok(!w.body(falling).pending && w.body(falling).pos[1] < 1.6, 'activated by the next sub-step, then falls');
  assert.deepEqual(w.body(sleeper).pos, [0, 0.4, 0], 'a body created asleep does not move');
  let wokenAt = -1;
  for (let i = 2; i <= 600; i++) { w.step(1 / 120); if (wokenAt < 0 && !w.isAsleep(sleeper)) wokenAt = i; }
  t.diagnostic(`le dormeur est réveillé au sous-pas ${wokenAt} par la caisse qui tombe ; réveils : ${w.stats.wakes}`);
  assert.ok(wokenAt > 1 && w.stats.wakes >= 1, 'woken by the contact, at the end of the sub-step');
  assert.ok(w.isAsleep(sleeper) && w.isAsleep(falling), 'both asleep again within 5 s');
  const y = w.body(sleeper).pos[1];
  assert.ok(y > 0.39 && y < 0.4, `resting again on the ground: y = ${y}`);
});

test('Étape 2a — setStatics : boîtes, dalle, empreinte, réveil', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  assert.equal(w.stats.statics, 1, 'the ground slab');
  assert.match(w.staticsHash, /^[0-9a-f]{8}$/);
  const bare = F.create({bounds: B64, ...SMALL});
  assert.equal(bare.stats.statics, 0);
  assert.notEqual(bare.staticsHash, w.staticsHash);
  const table = [{minX: -1, maxX: 1, minY: 0, maxY: 1, minZ: -1, maxZ: 1}, {minX: 4, maxX: 5, minY: 0, maxY: 2, minZ: 4, maxZ: 5, material: 'stone'}];
  const first = w.staticsHash, r = w.setStatics(table, []);
  assert.deepEqual(r, {statics: 3, merged: 0, masked: 0, woken: 0});
  assert.notEqual(w.staticsHash, first);
  const again = w.staticsHash;
  assert.deepEqual(w.updateStatics(table.map(b => ({...b}))), {statics: 3, merged: 0, masked: 0, woken: 0}, 'same decor');
  assert.equal(w.staticsHash, again, 'same decor, same hash');
  const bad = [[5], [{minX: 1, maxX: 0, minY: 0, maxY: 1, minZ: 0, maxZ: 1}], [{minX: 0, maxX: 1, minY: NaN, maxY: 1, minZ: 0, maxZ: 1}],
    [{minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, friction: 3}], [{minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, material: 'x'}]];
  for (const boxes of bad) assert.throws(() => w.setStatics(boxes, []), {name: 'TypeError', message: /^FPhysics\.setStatics: /});
  assert.throws(() => w.setStatics([], [{x: 0, z: 0, w: 1, d: 1, y: 0}]), /floors are not available yet/);
  assert.throws(() => w.setStatics(new Array(16).fill(table[0]), []), /exceed maxStatics/);
  assert.throws(() => w.setStatics('x', []), TypeError);
  assert.equal(w.staticsHash, again, 'a refused decor changes nothing');
  // A crate lands on the static box (top at y = 1), another one with mask 0xfffe falls through the decor.
  const on = crate(w, 0, 1.45, 0), through = w.addBody({size: [0.8, 0.8, 0.8], pos: [-4, 1, -4], mass: 30, mask: 0xfffe});
  for (let i = 0; i < 240; i++) w.step(1 / 120);
  const y = w.body(on).pos[1];
  t.diagnostic(`caisse posée sur la boîte statique : y = ${y.toFixed(5)} ; sans le bit 1 du masque : y = ${w.body(through).pos[1].toFixed(2)}`);
  assert.ok(y > 1.39 && y < 1.4 && w.isAsleep(on), 'rests on the static box');
  assert.ok(w.body(through).pos[1] < -10, 'mask without bit 1 ignores the decor');
  // A changed decor wakes the sleepers (module step 2a: all of them; the exact difference comes with step 10).
  const w2 = F.create({bounds: B64, ...SMALL, ground: 0}), h = w2.addBody({size: [0.8, 0.8, 0.8], pos: [0, 0.4, 0], mass: 30, asleep: true});
  assert.equal(w2.setStatics([], []).woken, 0, 'same decor: nobody woken');
  assert.equal(w2.setStatics(table, []).woken, 1);
  assert.ok(!w2.isAsleep(h));
});

test('Étape 2a — pas de temps : erreurs, accumulateur, découpage', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL});
  for (const dt of [NaN, -1, Infinity, '1', undefined, null]) assert.throws(() => w.step(dt), {name: 'TypeError', message: /^FPhysics\.step: /});
  assert.equal(w.step(1 / 30), 4, 'tolerance: 1/30 gives 4 sub-steps');
  assert.equal(w.stats.substeps, 4);
  assert.equal(w.step(0.2), 8, 'at most maxSubsteps');
  t.diagnostic(`step(0.2) : 8 sous-pas, ${w.stats.droppedSteps} sous-pas jetés`);
  assert.ok(w.stats.droppedSteps >= 15);
  assert.equal(w.snapshot().acc, 0, 'whole sub-steps leave no residue');
  // stack10: the same sub-steps give the same bits whatever the slicing of the time.
  const hashes = [[1 / 60, 150], [1 / 120, 300], [1 / 30, 75]].map(([dt, n]) => { const s = SCENES.stack10(F); for (let i = 0; i < n; i++) s.w.step(dt); return s.w.hash(); });
  t.diagnostic(`stack10, 300 sous-pas par 1/60, 1/120 et 1/30 : ${hashes.join(', ')}`);
  assert.equal(new Set(hashes).size, 1);
  assert.equal(runChain(loadVm(), 'stack10', 300), runChain(F, 'stack10', 300), 'same chain in a vm realm');
  assert.throws(() => F.create({bounds: {minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4}, ...SMALL}), /grid cells/);
});

test('Étape 2a — restore refusé sans rien changer, zéros négatifs', t => {
  const F = load(), {w} = SCENES.stack10(F);
  for (let i = 0; i < 100; i++) w.step(1 / 120);
  const good = JSON.stringify(w.snapshot()), hash = w.hash(), KM = w.config.capacity + 1 + w.config.maxStatics + 1;
  const cases = [
    ['v = 1', s => { s.v = 1; }], ['fp', s => { s.fp = '00000000'; }], ['statics', s => { s.statics = 'ffffffff'; }],
    ['NaN dans P', s => { s.b.P[4] = NaN; }], ['quaternion x 2', s => { for (let k = 4; k < 8; k++) s.b.Q[k] *= 2; }],
    ['vitesse de 100 m/s', s => { s.b.V[6] = 100; }], ['clé vers un index mort', s => { s.c.K[0] = 1 * KM + 20; }],
    ['tableau raccourci', s => { s.b.V.pop(); }], ['FL = 255', s => { s.b.FL[1] = 255; }],
    ['monde modifié', s => { s.b.IM[0] = 1; }], ['ligne libre non vide', s => { s.n = 12; for (const [k, a] of Object.entries(s.b)) { const wd = a.length / 11; for (let j = 0; j < wd; j++) a.push(a[wd + j]); } s.b.FL[11] = 8; }],
    ['acc hors de [0, tick)', s => { s.acc = 1; }], ['impulsion négative', s => { s.c.Jn[0] = -1; }],
  ];
  for (const [name, spoil] of cases) {
    const s = JSON.parse(good); spoil(s);
    assert.throws(() => w.restore(s), e => e instanceof Error && /^FPhysics\.restore: /.test(e.message), name);
    assert.equal(w.hash(), hash, name + ': nothing changed');
  }
  const s3 = JSON.parse(good); s3.statics = 'ffffffff';
  w.restore(s3, {ignoreStatics: true});
  assert.equal(w.hash(), hash, 'ignoreStatics accepts another decor hash');
  w.restore(JSON.parse(good));
  assert.equal(w.hash(), hash);
  t.diagnostic(`${cases.length} instantanés corrompus refusés, hachage inchangé (${hash})`);
  // -0: never in a snapshot; a hand-made -0 restores like +0.
  const z = F.create({bounds: B64, ...SMALL, ground: 0});
  z.addBody({size: [0.8, 0.8, 0.8], pos: [-0, 1, -0], vel: [-0, 0, -0], ang: [-0, -0, -0], quat: [-0, -0, -0, 1], mass: 30});
  z.step(1 / 120);
  const snap = z.snapshot(), all = [];
  JSON.stringify(snap, (k, v) => { if (typeof v === 'number') all.push(v); return v; });
  for (const a of [...Object.values(snap.b), ...Object.values(snap.c).filter(Array.isArray)]) all.push(...a);
  assert.ok(all.length > 100 && all.every(v => !Object.is(v, -0)), 'no -0 in a snapshot');
  const minus = JSON.parse(JSON.stringify(snap)), plus = JSON.parse(JSON.stringify(snap));
  minus.b.P[3] = -0; minus.b.V[8] = -0;
  const z2 = F.create(z.config), z3 = F.create(z.config);
  z2.restore(minus); z3.restore(plus);
  assert.equal(z2.hash(), z3.hash(), '-0 restores like +0');
});

test('Étape 2a — pose, matrix, chronométrage', t => {
  const F = load(), w = F.create({bounds: B64, ...SMALL, ground: 0});
  const h = w.addBody({size: [0.8, 0.8, 0.8], pos: [1, 3, 2], rot: [0.3, -0.5, 1.1], mass: 30});
  const sl = Math.min(w.config.slop, w.config.slopRatio * 0.4), start = w.pose(h, 0.5);
  assert.deepEqual(start.slice(0, 3), [1, 3 + sl / 2, 2], 'before any step, previous pose = pose');
  w.step(1 / 120); w.step(1 / 120);
  const b = w.body(h), p0 = w.pose(h, 0), p1 = w.pose(h, 1), half = w.pose(h, 0.5);
  assert.deepEqual(p1.slice(0, 3), [b.pos[0], b.pos[1] + sl / 2, b.pos[2]]);
  assert.deepEqual(p1.slice(3), b.quat);
  assert.ok(p0[1] > half[1] && half[1] > p1[1], 'falling: interpolated between the two poses');
  assert.deepEqual(w.pose(h, 2), p1, 'alpha capped at 1');
  assert.deepEqual(w.pose(h, -1), p0, 'alpha floored at 0');
  assert.deepEqual(w.pose(h, NaN), p0, 'NaN alpha reads as 0');
  const out = [0, 0, 0, 0, 0, 0, 0], m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(w.pose(h, 1, out), out);
  assert.equal(w.matrix(h, m), m);
  assert.ok(gap(m, quatMatrix(...b.quat)) <= 1e-12, 'matrix of the current quaternion');
  // Thin plate: the real plate sits on the bottom of its collision box, upright or upside down.
  for (const rot of [[0, 0, 0], [Math.PI, 0, 0]]) {
    const plate = w.addBody({size: [0.8, 0.01, 0.8], pos: [5, 2, 5], rot, mass: 10}), y = w.pose(plate, 1)[1];
    const H = w.config.minHalf, slp = Math.min(w.config.slop, w.config.slopRatio * H);
    assert.ok(Math.abs(y - (2 + slp / 2 - (H - 0.005))) <= 1e-12, `plate rot ${rot}: y = ${y}`);
  }
  // clock: phases timed only when given, and never part of the state.
  let tick = 0;
  const run = clock => { const s = SCENES.stack10(F, clock ? {clock: () => (tick += 0.25)} : {}); for (let i = 0; i < 60; i++) s.w.step(1 / 120); return s.w; };
  const timed = run(true), plain = run(false);
  assert.equal(timed.hash(), plain.hash(), 'the clock does not change the simulation');
  assert.ok(timed.phaseMs.every(v => v > 0) && plain.phaseMs.every(v => v === 0));
  t.diagnostic(`phaseMs avec une horloge factice : ${Array.from(timed.phaseMs).join(', ')}`);
  const st = plain.stats;
  t.diagnostic(`stack10 à 60 sous-pas : ${st.contacts} points, ${st.manifolds} paires, ${st.tests} tests, ${st.awake} éveillés`);
  assert.ok(st.contacts >= 4 * 10 && st.manifolds === 10 && st.awake === 10 && st.bodies === 10);
  for (const [k, v] of Object.entries(st)) assert.ok(Number.isInteger(v), k);
});
