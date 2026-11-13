import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pattern, FRAMES, REFERENCE, runPattern, compare} from '../tools/boucle-motifs.mjs';

const source = readFileSync(new URL('../src/loop.js', import.meta.url), 'utf8');
// Un exemplaire neuf du module dans son propre contexte, comme checks/options.test.mjs.
function load() { const context = {window: {}}; vm.runInContext(source, vm.createContext(context)); return context.window.FLoop; }
const F = load(), P = 1000 / 60, H = P;
// Erreurs d'un autre domaine : compare le nom, jamais instanceof.
const isTypeError = e => e?.name === 'TypeError';
// Objets d'un autre domaine : compare des scalaires, ou passe par JSON.
const plain = o => JSON.parse(JSON.stringify(o));
// Rejoue un motif et copie, image par image, ce que rend advance (frame est réutilisé).
function runStamps(name, n = FRAMES[name], opts) {
  const L = F.create(opts), next = pattern(name), rows = [];
  for (let i = 1; i <= n; i++) { const f = L.advance(next(i).stamp, () => {}); rows.push({s: f.steps, a: f.alpha, l: f.locked, d: f.dropped, r: f.raw}); }
  return {L, rows};
}
// Écart à l'invariant de conservation (§4.6), en ms.
const invariant = L => { const s = L.stats; return s.steps * L.stepMs + (L.acc - .999 * L.stepMs) - (s.realMs - L.debt - s.droppedMs - s.abortedMs + s.dilationMs); };
// Images à plus d'un pas : [[numéro d'image, pas], …].
const multi = rows => rows.map((r, i) => [i + 1, r.s]).filter(([, s]) => s > 1);
// Numéro de la première image verrouillée (0 si jamais).
const firstLock = rows => { const i = rows.findIndex(r => r.l); return i + 1; };
const near = (a, b, eps) => Math.abs(a - b) <= eps;
// Bornes (§4.6, invariant 4), image par image : 0 ≤ steps ≤ maxSteps, 0 ≤ alpha ≤ 1, verrouillé ⇒ alpha = fill.
// Rend le numéro de la première image fautive, 0 si aucune.
function firstOutOfBounds(name) {
  const L = F.create(), next = pattern(name);
  for (let i = 1; i <= FRAMES[name]; i++) {
    const f = L.advance(next(i).stamp, () => {});
    if (!(f.steps >= 0 && f.steps <= 5 && f.alpha >= 0 && f.alpha <= 1)) return i;
    if (f.locked && !(Math.abs(f.alpha - .999) < 1e-12)) return i;
  }
  return 0;
}

test('T-F01 exports et forme', () => {
  for (const key of ['create', 'aim', 'track']) assert.equal(typeof F[key], 'function', key);
  const ctx = vm.createContext({});
  vm.runInContext(source, ctx);
  assert.equal(vm.runInContext('typeof FLoop', ctx), 'object');
  assert.equal(vm.runInContext('typeof FLoop.create', ctx), 'function');
  assert.ok(source.includes('G.FLoop='));
  assert.ok(source.includes("(typeof window!=='undefined'?window:globalThis)"));
});

test('T-F02 validation', () => {
  for (const opts of [{hz: 0}, {hz: 1001}, {hz: NaN}, {hz: Infinity}, {hz: '60'}, {maxSteps: 0}, {maxSteps: 1.5}, {maxSteps: 61}, {maxSteps: '5'}])
    assert.throws(() => F.create(opts), isTypeError, JSON.stringify(opts));
  for (const opts of [undefined, {hz: 1}, {hz: 1000, maxSteps: 60}]) assert.doesNotThrow(() => F.create(opts), JSON.stringify(opts));
  const L = F.create();
  assert.throws(() => L.advance(1000, 42), isTypeError);
  assert.equal(L.advance(1000, null).steps, 1);
});

test('T-F03 état initial', () => {
  const L = F.create();
  assert.equal(L.step, 1 / 60);
  assert.equal(L.stepMs, 1000 / 60);
  assert.equal(L.hz, 60);
  assert.equal(L.period, 0);
  assert.equal(L.locked, false);
  assert.equal(L.acc, .999 * (1000 / 60));
  assert.equal(L.debt, 0);
  assert.equal(L.frame.alpha, .999);
  assert.equal(L.frame.steps, 0);
  assert.deepEqual(plain(L.stats), {frames: 0, steps: 0, zeroStepFrames: 0, multiStepFrames: 0, realMs: 0, droppedMs: 0, clampedMs: 0, abortedMs: 0, dilationMs: 0, maxDebtMs: 0, lockChanges: 0});
  assert.equal(F.create({hz: 120}).step, 1 / 120);
});

test('T-F04 première image', () => {
  const L = F.create(), seen = [];
  const f = L.advance(1000, (h, i) => { seen.push([h, i]); });
  assert.equal(f, L.frame);
  assert.equal(f.steps, 1);
  assert.deepEqual(seen, [[1 / 60, 0]]);
  assert.equal(f.raw, 0);
  assert.equal(f.dt, 1000 / 60);
  assert.equal(L.stats.frames, 1);
  assert.equal(L.stats.steps, 1);
  assert.equal(L.stats.dilationMs, 1000 / 60);
  assert.equal(L.stats.realMs, 0);
  assert.ok(Math.abs(f.alpha - .999) < 1e-12);
});

test('T-F05 60 Hz exact : un pas par image, verrouillage à l image 9', () => {
  const {L, rows} = runStamps('60', 600);
  assert.ok(rows.every(r => r.s === 1));
  assert.equal(firstLock(rows), 9);
  for (let i = 8; i < 600; i++) {
    assert.equal(rows[i].l, true, 'image ' + (i + 1));
    assert.ok(Math.abs(rows[i].a - .999) < 1e-12, 'alpha image ' + (i + 1));
  }
  assert.equal(L.stats.zeroStepFrames, 0);
  assert.equal(L.stats.multiStepFrames, 0);
});

test('T-F06 horodatages 60 Hz grossiers', () => {
  for (const name of ['60@1e6', 'q60', 'ms60']) {
    const {rows} = runStamps(name, 3600);
    assert.ok(rows.every(r => r.s === 1), name);
    assert.equal(firstLock(rows), 9, name);
  }
});

test('T-F07 59,94 Hz : une seule image à 2 pas, dilatation voulue', () => {
  const {L, rows} = runStamps('59.94');
  assert.deepEqual(multi(rows), [[2, 2]]);
  assert.ok(rows.every(r => r.s >= 1));
  assert.equal(L.locked, true);
  const pct = 100 * L.stats.dilationMs / L.stats.realMs;
  assert.ok(pct <= -.09 && pct >= -.10, String(pct));
});

test('T-F08 écrans rapides, 10 minutes', () => {
  const want = {'75': 8999, '90': 17999, '120': 35999, '144': 50399, '165': 62999, '240': 107999};
  for (const [hz, zeros] of Object.entries(want)) {
    const {L} = runStamps(hz);
    assert.equal(L.stats.zeroStepFrames, zeros, hz + ' Hz');
    assert.equal(L.stats.multiStepFrames, 0, hz + ' Hz');
    assert.equal(L.stats.steps, 36001, hz + ' Hz');
    assert.equal(L.stats.lockChanges, 0, hz + ' Hz');
  }
});

test('T-F09 30 Hz', () => {
  const {L, rows} = runStamps('30');
  assert.equal(rows[0].s, 1);
  assert.ok(rows.slice(1).every(r => r.s === 2));
  assert.equal(firstLock(rows), 9);
  assert.equal(L.locked, true);
});

test('T-F10 50 Hz', () => {
  const {L, rows} = runStamps('50');
  const hist = {};
  for (const r of rows) hist[r.s] = (hist[r.s] || 0) + 1;
  assert.deepEqual(hist, {1: 24000, 2: 6000});
  assert.equal(L.stats.lockChanges, 0);
});

test('T-F11 gigue de ±2 ms à 60 Hz', () => {
  const {L, rows} = runStamps('jit60');
  assert.deepEqual(multi(rows), [[2, 2]]);
  assert.ok(rows.every(r => r.s >= 1));
  assert.equal(firstLock(rows), 10);
  assert.equal(L.stats.lockChanges, 1);
  assert.equal(L.locked, true);
});

test('T-F12 conservation sur les 21 motifs', () => {
  for (const name of Object.keys(FRAMES)) {
    const r = runPattern(F, name);
    assert.ok(r.maxInvariantErr < 1e-6, name + ' invariant ' + r.maxInvariantErr);
    assert.equal(r.dilationBoundOk, true, name + ' dilatation');
    assert.ok(r.maxStepsPerFrame <= 5, name + ' pas max ' + r.maxStepsPerFrame);
    assert.equal(firstOutOfBounds(name), 0, name + ' bornes de steps et d alpha');
  }
});

test('T-F13 écart borné', () => {
  for (const name of Object.keys(FRAMES)) {
    const r = runPattern(F, name);
    assert.ok(r.maxEcartMs <= H, name + ' écart ' + r.maxEcartMs);
    assert.ok(r.maxDebtMs <= H, name + ' dette ' + r.maxDebtMs);
  }
  assert.ok(near(runPattern(F, 'bimodal').maxDebtMs, 6.26, .01), 'bimodal');
  assert.ok(near(runPattern(F, 'jit144').maxDebtMs, .383, .002), 'jit144');
});

test('T-F14 images longues', () => {
  const {L, rows} = runStamps('long60');
  const f300 = rows[299], f1000 = rows[999], f5000 = rows[4999];
  assert.equal(f300.s, 3);
  assert.ok(near(f300.r, 50, 1e-9), 'raw 300 : ' + f300.r);
  assert.equal(f300.d, 0);
  assert.equal(f1000.s, 5);
  assert.ok(near(f1000.d, 2 * H, 1e-9), 'dropped 1000 : ' + f1000.d);
  assert.equal(f5000.s, 5);
  assert.equal(f5000.r, 250);
  assert.ok(near(f5000.d, 10 * H, 1e-9), 'dropped 5000 : ' + f5000.d);
  assert.ok(near(L.stats.droppedMs, 80 * H, 1e-6), 'droppedMs : ' + L.stats.droppedMs);
  assert.ok(near(L.stats.clampedMs, 250, 1e-6), 'clampedMs : ' + L.stats.clampedMs);
  const hist = {};
  for (const r of rows) { hist[r.s] = (hist[r.s] || 0) + 1; assert.ok(r.s <= 5); }
  assert.deepEqual(hist, {1: 35856, 3: 108, 5: 36});
});

test('T-F15 arrêt anticipé', () => {
  const L = F.create(), seen = [];
  L.advance(1000, () => {});
  const f = L.advance(1050, (h, i) => { seen.push(i); return i < 1; });
  assert.deepEqual(seen, [0, 1]);
  assert.equal(f.steps, 2);
  assert.ok(near(L.stats.abortedMs, H, 1e-9), 'abortedMs : ' + L.stats.abortedMs);
  assert.ok(near(L.acc, .999 * H, 1e-9), 'acc : ' + L.acc);
  assert.equal(L.stats.steps, 3);
  assert.equal(L.stats.multiStepFrames, 1);
  assert.ok(Math.abs(invariant(L)) < 1e-9);
});

test('T-F16 mode plan', () => {
  const A = F.create(), B = F.create(), next = pattern('jit144');
  for (let i = 1; i <= 3000; i++) {
    const t = next(i).stamp;
    const fa = A.advance(t), fb = B.advance(t, () => {});
    assert.equal(fa.steps, fb.steps, 'image ' + i);
  }
  assert.equal(A.stats.steps, B.stats.steps);
  assert.ok(Object.is(A.acc, B.acc));
  const L = F.create();
  assert.equal(L.advance(1000).steps, 1);
  assert.equal(L.advance(1050).steps, 3);
  assert.throws(() => L.abort(4), isTypeError);
  assert.throws(() => L.abort(1.5), isTypeError);
  assert.throws(() => L.abort(-1), isTypeError);
  const f = L.abort(1);
  assert.equal(f, L.frame);
  assert.equal(f.steps, 1);
  assert.ok(near(L.stats.abortedMs, 2 * H, 1e-9), 'abortedMs : ' + L.stats.abortedMs);
  assert.equal(L.stats.steps, 2);
  assert.equal(L.stats.multiStepFrames, 0);
  assert.equal(L.stats.zeroStepFrames, 0);
  L.abort(0);
  assert.equal(L.stats.zeroStepFrames, 1);
  assert.equal(L.stats.steps, 1);
  assert.ok(near(L.stats.abortedMs, 3 * H, 1e-9), 'abortedMs : ' + L.stats.abortedMs);
  const C = F.create(), D = F.create();
  C.advance(1000, () => {});
  D.advance(1000, () => {});
  C.advance(1050, (h, i) => i < 0);
  D.advance(1050);
  D.abort(1);
  assert.deepEqual(plain(C.stats), plain(D.stats));
  assert.ok(Object.is(C.acc, D.acc));
});

test('T-F17 exception dans le rappel', () => {
  const L = F.create();
  L.advance(1000, () => {});
  assert.throws(() => L.advance(1050, (h, i) => { if (i === 1) throw new Error('panne'); }), e => e.message === 'panne');
  assert.equal(L.frame.steps, 2);
  assert.ok(near(L.stats.abortedMs, H, 1e-9), 'abortedMs : ' + L.stats.abortedMs);
  assert.equal(L.stats.frames, 2);
  assert.equal(L.stats.steps, 3);
  assert.ok(Math.abs(invariant(L)) < 1e-9);
  assert.equal(L.advance(1050 + P, () => {}).steps, 1);
});

test('T-F18 observe', () => {
  const L = F.create();
  L.advance(5000, () => {});
  let t = 5000;
  for (let k = 1; k <= 59; k++) { t = 5000 + k * P; L.observe(t); }
  assert.equal(L.locked, true);
  assert.equal(L.stats.frames, 1);
  assert.equal(L.stats.steps, 1);
  assert.ok(Math.abs(L.period - P) < 1e-9, 'period : ' + L.period);
  const f = L.advance(t + 4 * P, () => {});
  assert.equal(f.steps, 4);
  assert.equal(f.locked, true);
  assert.ok(Math.abs(f.alpha - .999) < 1e-12);
  const state = () => ({stats: plain(L.stats), period: L.period, locked: L.locked, acc: L.acc, debt: L.debt});
  const before = state();
  assert.equal(L.observe(NaN).steps, 0);
  assert.deepEqual(state(), before);
  // La référence d'horodatage est gardée : l'image suivante mesure un intervalle d'une période.
  const g = L.advance(t + 5 * P, () => {});
  assert.equal(g.steps, 1);
  assert.ok(near(g.raw, P, 1e-9), 'raw : ' + g.raw);
});

test('T-F19 reset', () => {
  const L = F.create(), next = pattern('60');
  for (let i = 1; i <= 100; i++) L.advance(next(i).stamp, () => {});
  assert.equal(L.locked, true);
  const period = L.period;
  const f = L.reset();
  assert.equal(f.steps, 0);
  assert.ok(Math.abs(f.alpha - .999) < 1e-12);
  assert.equal(L.locked, true);
  assert.equal(L.period, period);
  assert.equal(L.advance(100 * P + 10000, () => {}).steps, 1);
  assert.equal(L.advance(100 * P + 10000 + P, () => {}).steps, 1);
  assert.ok(Math.abs(invariant(L)) < 1e-9);
});

test('T-F20 resetPeriod', () => {
  const L = F.create(), next = pattern('60');
  for (let i = 1; i <= 100; i++) L.advance(next(i).stamp, () => {});
  const changes = L.stats.lockChanges;
  L.resetPeriod();
  assert.equal(L.locked, false);
  assert.equal(L.period, 0);
  assert.equal(L.stats.lockChanges, changes + 1);
  let lock = 0;
  for (let i = 101; i <= 130 && !lock; i++) { if (L.advance(next(i).stamp, () => {}).locked) lock = i; }
  assert.equal(lock, 108);
});

test('T-F21 horodatages invalides', () => {
  const L = F.create(), next = pattern('60');
  for (let i = 1; i <= 20; i++) L.advance(next(i).stamp, () => {});
  const frames = L.stats.frames;
  assert.equal(L.advance(NaN, () => {}).steps, 0);
  assert.equal(L.advance(Infinity, () => {}).steps, 0);
  assert.equal(L.stats.frames, frames);
  const dup = L.advance(20 * P, () => {});
  assert.equal(dup.steps, 0);
  assert.equal(dup.raw, 0);
  assert.equal(L.stats.frames, frames + 1);
  assert.equal(L.advance(5, () => {}).steps, 0);
  assert.equal(L.stats.frames, frames + 1);
  assert.equal(L.advance(5 + P, () => {}).steps, 1);
});

test('T-F22 changement d écran', () => {
  const {L, rows} = runStamps('switch', 1200);
  let unlock = 0;
  for (let i = 300; i < 1200 && !unlock; i++) if (!rows[i].l) unlock = i + 1;
  assert.equal(unlock, 308);
  assert.equal(L.stats.lockChanges, 2);
  let run0 = 0, max0 = 0;
  for (const r of rows) { run0 = r.s === 0 ? run0 + 1 : 0; if (run0 > max0) max0 = run0; }
  assert.ok(max0 <= 7, 'suite de 0 pas : ' + max0);
  const r = runPattern(F, 'switch');
  assert.ok(Math.abs(r.marks.periodAt330 - 1000 / 144) < 1e-6, 'periodAt330 : ' + r.marks.periodAt330);
  const L2 = F.create();
  let t = 0;
  for (let i = 1; i <= 300; i++) { t += 1000 / 144; L2.advance(t, () => {}); }
  // frame est réutilisé : on copie steps et locked image par image.
  const rows2 = [];
  for (let i = 1; i <= 1700; i++) { t += 1000 / 60; const f = L2.advance(t, () => {}); rows2.push({s: f.steps, l: f.locked}); }
  assert.ok(rows2.every(r => r.s === 1), 'un pas par image après la descente');
  assert.ok(rows2.every(r => !r.l), 'jamais verrouillé après la descente');
  assert.ok(near(L2.period, 8.3333, .001), 'période sous-multiple : ' + L2.period);
  L2.resetPeriod();
  for (let i = 1; i <= 20; i++) { t += 1000 / 60; L2.advance(t, () => {}); }
  assert.equal(L2.locked, true);
  assert.ok(near(L2.period, 16.6667, .001), 'période : ' + L2.period);
});

test('T-F23 hz:120 sur un écran à 60 Hz', () => {
  const L = F.create({hz: 120}), next = pattern('60'), hs = [];
  for (let i = 1; i <= 300; i++) {
    const f = L.advance(next(i).stamp, h => { hs.push(h); });
    if (i > 20) assert.equal(f.steps, 2, 'image ' + i);
  }
  assert.equal(L.locked, true);
  assert.ok(hs.every(h => h === 1 / 120));
});

test('T-F24 déterminisme et source', () => {
  const LA = load().create(), LB = load().create(), next = pattern('jit144');
  for (let i = 1; i <= 10000; i++) {
    const t = next(i).stamp;
    const fa = LA.advance(t), fb = LB.advance(t);
    assert.equal(fa.steps, fb.steps, 'image ' + i);
    assert.ok(Object.is(fa.alpha, fb.alpha), 'alpha image ' + i);
  }
  for (const banned of ['Math.random', 'performance', 'Date', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'import', 'export', 'require(', '</script', '@import'])
    assert.ok(!source.includes(banned), banned);
  assert.ok(!/\b(?:player|enem|weapon|projectile|metal|audio|nav)/i.test(source));
});

test('T-F25 régularité', () => {
  const L = F.create(), next = pattern('144');
  let S = 0, lastShown = null;
  const count = () => { S++; };
  for (let i = 1; i <= 2000; i++) {
    const f = L.advance(next(i).stamp, count);
    const shown = S - 1 + f.alpha;
    if (lastShown !== null && i >= 41) assert.ok(Math.abs((shown - lastShown) - 60 / 144) < 1e-9, 'incrément image ' + i + ' : ' + (shown - lastShown));
    lastShown = shown;
  }
  for (const [name, want] of Object.entries({jit144: .535, q144: .062, ms144: .606, bimodal: .035}))
    assert.ok(near(runPattern(F, name).cvPct, want, .002), name + ' cvPct');
  for (const name of ['60', 'q60', 'ms60', 'jit60', '59.94', 'drop60', 'long60'])
    assert.ok(runPattern(F, name).cvPct < .001, name + ' cvPct');
});

test('T-F26 aim : mêmes opérations que le pas de simulation', () => {
  // Calcul du pas de src/simulation.js, transcrit (§6.2) : p.yaw+=…lookX…; p.pitch=clamp(p.pitch+…lookY…,-1.2,1.2).
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const written = (p, input) => {
    p.yaw += Number.isFinite(input.lookX) ? input.lookX : 0;
    p.pitch = clamp(p.pitch + (Number.isFinite(input.lookY) ? input.lookY : 0), -1.2, 1.2);
  };
  // Contrat avec le jeu (PARA-05) : la même opération, relue dans src/simulation.js et exécutée telle quelle
  // (sa définition de clamp, puis l'unique ligne qui écrit le lacet et le tangage à partir du regard).
  // Si ce test casse, la simulation consomme le regard autrement : revoir l'usage de FLoop.aim au raccord.
  const lines = readFileSync(new URL('../src/simulation.js', import.meta.url), 'utf8').split('\n');
  const look = lines.filter(l => /input\.look[XY]/.test(l) && /\.(?:yaw|pitch)\s*[-+]?=(?!=)/.test(l)), clampDef = lines.filter(l => /\bconst clamp=/.test(l));
  assert.equal(look.length, 1, 'src/simulation.js : une seule ligne écrit le lacet et le tangage à partir de input.lookX et input.lookY');
  assert.equal(clampDef.length, 1, 'src/simulation.js : une seule définition de clamp');
  const real = new Function('p', 'input', "'use strict';" + clampDef[0] + '\n' + look[0]);
  const same = (yaw, pitch, lookX, lookY, label) => {
    const out = {}, a = {yaw, pitch}, b = {yaw, pitch};
    assert.equal(F.aim(yaw, pitch, lookX, lookY, -1.2, 1.2, out), out, label + ' : aim rend out');
    written(a, {lookX, lookY});
    real(b, {lookX, lookY});
    assert.ok(Object.is(out.yaw, a.yaw) && Object.is(out.pitch, a.pitch), label + ' : ' + JSON.stringify({out, a}));
    assert.ok(Object.is(out.yaw, b.yaw) && Object.is(out.pitch, b.pitch), label + ', src/simulation.js : ' + JSON.stringify({out, b}));
    return out;
  };
  let k = 7, low = 0, high = 0, wide = 0;
  const r = () => (k = (Math.imul(k, 1103515245) + 12345) >>> 0) / 4294967296 * 8 - 4;
  for (let n = 0; n < 1000; n++) {
    const yaw = r(), pitch = r() * .3, lookX = r() * .1, lookY = r() * .1, out = same(yaw, pitch, lookX, lookY, 'tuple ' + n);
    if (pitch + lookY < -1.2) low++;
    if (pitch + lookY > 1.2) high++;
    if (Math.abs(out.yaw) > Math.PI) wide++;
  }
  // Les tuples touchent les deux bornes du tangage et sortent de [-π, π] en lacet (le lacet n'est jamais replié).
  assert.ok(low > 0 && high > 0 && wide > 0, JSON.stringify({low, high, wide}));
  const a = F.aim(1, .5, NaN, undefined, -1.2, 1.2);
  assert.equal(a.yaw, 1);
  assert.equal(a.pitch, .5);
  // Tout regard non fini ou non numérique compte pour 0, comme Number.isFinite dans le pas ; tangage hors bornes ramené.
  for (const bad of [NaN, undefined, Infinity, -Infinity, null, '0.1']) same(1, .5, bad, bad, String(bad));
  assert.equal(same(0, 2, 0, NaN, 'tangage hors bornes').pitch, 1.2);
  assert.equal(same(1000.5, 0, .25, 0, 'lacet après de nombreux tours').yaw, 1000.75);
  assert.equal(F.aim(0, 1, 0, 5).pitch, 6);
  assert.equal(F.aim(0, 1, 0, 5, -1.2, 1.2).pitch, 1.2);
  assert.equal(F.aim(0, -1, 0, -5, -1.2, 1.2).pitch, -1.2);
  assert.equal(F.aim(3, 0, 1, 0).yaw, 4);
});

test('T-F27 track : interpolation, chemin court, seuil de 2 m, taille', () => {
  const T = F.track({snap: 2}), o = {};
  T.begin();
  T.save(1, 0, 0, 0, 0);
  assert.equal(T.pose(1, 1, 1, -1, .4, .25, o), o);
  assert.ok(near(o.x, .25, 1e-15) && near(o.y, .25, 1e-15) && near(o.z, -.25, 1e-15) && near(o.a, .1, 1e-15), JSON.stringify(o));
  T.save(2, 0, 0, 0, 3.1);
  assert.ok(near(T.pose(2, 0, 0, 0, -3.1, .5).a, Math.PI, 1e-12), 'chemin court');
  const p5 = {};
  assert.equal(T.pose(1, 5, 0, 0, 0, .5, p5), p5);
  assert.deepEqual(p5, {x: 5, y: 0, z: 0, a: 0});
  assert.equal(T.pose(1, 2, 0, 0, 0, .5).x, 1);
  const p9 = {};
  assert.equal(T.pose(9, 3, 4, 5, 1, .5, p9), p9);
  assert.deepEqual(p9, {x: 3, y: 4, z: 5, a: 1});
  assert.equal(T.size, 2);
  T.begin();
  T.save(1, 0, 0, 0, 0);
  T.prune();
  assert.equal(T.size, 1);
  // C'est bien l'id 2, non sauvé depuis begin(), qui est oublié.
  assert.equal(T.pose(1, 1, 0, 0, 0, .5).x, .5);
  assert.equal(T.pose(2, 1, 0, 0, 0, .5).x, 1);
  T.clear();
  assert.equal(T.size, 0);
  // Au-delà du §6.2 : chemin court dans l'autre sens, angle rendu modulo 2π, distance en 3D (ascenseur : saut vertical).
  const U = F.track({snap: 2});
  U.begin();
  U.save(1, 0, 0, 0, -3.1);
  assert.ok(near(U.pose(1, 0, 0, 0, 3.1, .5).a, -Math.PI, 1e-12), 'chemin court, sens inverse');
  U.save(2, 0, 0, 0, 0);
  assert.ok(near(U.pose(2, 0, 0, 0, 2 * Math.PI + .4, 1).a, .4, 1e-12), 'tour complet : angle rendu modulo 2π');
  for (const [x, y, z] of [[0, 5, 0], [0, 0, -5], [1.2, 1.2, 1.2]]) {
    const q = plain(U.pose(2, x, y, z, 0, .5));
    assert.deepEqual(q, {x, y, z, a: 0}, 'saut de ' + Math.hypot(x, y, z).toFixed(3) + ' m');
  }
  // Valeurs par défaut (snap 2 m, a = 0 à la sauvegarde, alpha = 1) et option snap respectée.
  const D = F.track(), S = F.track({snap: .5});
  D.begin();
  S.begin();
  D.save(1, 0, 0, 0);
  S.save(1, 0, 0, 0);
  assert.equal(D.pose(1, 2, 0, 0, 0, .5).x, 1);
  assert.equal(D.pose(1, 2.01, 0, 0, 0, .5).x, 2.01);
  assert.deepEqual(plain(D.pose(1, 1, 0, 0, .3)), {x: 1, y: 0, z: 0, a: .3});
  assert.equal(S.pose(1, .5, 0, 0, 0, .5).x, .25);
  assert.equal(S.pose(1, 1, 0, 0, 0, .5).x, 1);
  // Un traqueur par type d'entité : deux traqueurs ne partagent pas leurs id.
  const E = F.track(), Q = F.track();
  E.begin();
  Q.begin();
  E.save(7, 0, 0, 0);
  Q.save(7, 10, 0, 0);
  assert.equal(E.pose(7, 1, 0, 0, 0, .5).x, .5);
  assert.equal(Q.pose(7, 11, 0, 0, 0, .5).x, 10.5);
  E.clear();
  assert.ok(E.size === 0 && Q.size === 1);
  // Boucle réelle. Un corps avance de 0,05 par pas ; begin() au premier pas de l'image, save avant chaque pas,
  // prune() après les pas si l'image en a eu ; rendu par pose(…, frame.alpha).
  const run = (name, frames, each) => {
    const L = F.create(), N = F.track({snap: 2}), next = pattern(name);
    let x = 0, before = 0;
    for (let i = 1; i <= frames; i++) {
      const f = L.advance(next(i).stamp, (h, idx) => { if (idx === 0) N.begin(); N.save(1, x, 0, 0, 0); before = x; x += .05; });
      if (f.steps) N.prune();
      each(i, N.pose(1, x, 0, 0, 0, f.alpha).x, f, before, x);
    }
  };
  // 144 Hz, 2 000 images : à partir de l'image 41, chaque incrément affiché vaut 0,05·60/144 à 1e-9 près,
  // y compris sur les images sans pas (58 %), où pose interpole entre les deux mêmes états avec l'alpha qui grandit.
  let lastShown = null;
  run('144', 2000, (i, shown) => {
    if (lastShown !== null && i >= 41) assert.ok(Math.abs((shown - lastShown) - .05 * 60 / 144) < 1e-9, 'incrément image ' + i + ' : ' + (shown - lastShown));
    lastShown = shown;
  });
  // Images à plusieurs pas (30 Hz : 2 pas ; 'long60' : 3 et 5 pas) : la dernière sauvegarde écrase les précédentes,
  // la pose part de l'état d'avant le dernier pas.
  for (const name of ['30', 'long60']) {
    let worst = 0, multi = 0;
    run(name, 6000, (i, shown, f, before, x) => {
      if (f.steps > 1) multi++;
      worst = Math.max(worst, Math.abs(shown - (before + (x - before) * f.alpha)));
    });
    assert.ok(multi > 0 && worst < 1e-12, name + ' : ' + JSON.stringify({multi, worst}));
  }
});

test('T-F28 table de référence', () => {
  for (const name of Object.keys(FRAMES)) assert.deepEqual(compare(runPattern(F, name), REFERENCE[name]), [], name);
});
