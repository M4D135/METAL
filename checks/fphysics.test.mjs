// FPhysics tests (lot 17, module side). Run: node --test checks/fphysics.test.mjs
// Not in npm test until the module is wired into the game (see docs/chantier-moteur/modules/physique.md, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import {source, load, loadVm, lcg, B64, NOSLEEP} from './fphysics-scenes.mjs';

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
