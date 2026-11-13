import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/schedule.js', import.meta.url), 'utf8');
// Un exemplaire neuf du module dans son propre contexte, comme checks/options.test.mjs.
function load() { const context = {window: {}}; vm.runInContext(source, vm.createContext(context)); return context.window.FSchedule; }
const S = load();
// Erreurs d'un autre domaine : compare le nom, jamais instanceof.
const isTypeError = e => e?.name === 'TypeError';
// Horloge factice : une tâche « dure » d ms si elle fait c.t += d.
const clock = (t = 0) => { const c = {t, now: () => c.t}; return c; };
// Horloge interdite : la lire fait échouer le test.
const bannedClock = () => { throw new Error('horloge interdite'); };
// Tâche « sim » de `total` unités, qui prend au plus `cap` unités par appel et pose done à la fin.
// `log` reçoit clé + unités offertes + ':' + unités prises.
function simTask(sc, key, priority, total, cap = Infinity, log = null) {
  let left = total;
  return sc.add({lane: 'sim', key, priority, run: (u, t) => {
    const used = Math.min(u, left, cap); left -= used; if (!left) t.done = true;
    if (log) log.push(key + u + ':' + used);
    return used;
  }});
}

test('S01 ordre', () => {
  const c = clock(), sc = S.create({now: c.now}), order = [];
  const mk = (key, priority) => sc.add({key, priority, cost: 1, run: () => { order.push(key); c.t += 1; }});
  mk('A', 5); mk('B', 1); mk('C', 5); mk('D', 1);
  assert.equal(sc.pump(10), 4);
  assert.equal(order.join(''), 'BDAC');
  assert.equal(sc.count(), 0);
  assert.equal(sc.stats.ran, 4);
});

test('S02 budget', () => {
  const c = clock(), sc = S.create({now: c.now}), order = [];
  for (let i = 0; i < 10; i++) sc.add({key: 't' + i, cost: 1.5, run: () => { order.push('t' + i); c.t += 1.5; }});
  assert.equal(sc.pump(4), 3);
  assert.deepEqual(order, ['t0', 't1'], '2 tâches ont tourné, dans l\'ordre');
  assert.equal(sc.count('frame'), 8);
  assert.equal(sc.stats.ran, 2);
  assert.equal(sc.stats.skipped, 8);
  let pumps = 1;
  while (sc.count('frame') && pumps < 100) { sc.pump(4); pumps++; }
  assert.equal(pumps, 5);
  assert.equal(sc.count(), 0);
  assert.equal(sc.stats.ran, 10);
  assert.equal(sc.stats.overrunMs, 0);
});

test('S03 tâche longue seule', () => {
  const c = clock(), sc = S.create({now: c.now});
  sc.add({key: 'long', cost: 10, run: () => { c.t += 10; }});
  assert.equal(sc.pump(4), 10);
  assert.equal(sc.stats.overrunMs, 6);
  assert.equal(sc.count(), 0);
  assert.equal(sc.stats.maxSliceMs, 10);
  assert.equal(sc.stats.ran, 1);
});

// S (prio 0, rappelée sans fin) passe toujours avant L (prio 5, coût 10, plus que le budget de 4 ms),
// jusqu'à ce que le vieillissement fasse passer L devant : pompe 181 (âge 180, 5 − 6 = −1 < 0) avec 30.
function agingRun(opts) {
  const c = clock(), sc = S.create({now: c.now, ...opts});
  const s = sc.add({key: 'S', priority: 0, cost: 1, run: () => { c.t += 1; return false; }});
  const L = sc.add({key: 'L', priority: 5, cost: 10, run: () => { c.t += 10; }});
  let pumps = 0;
  while (L.runs === 0 && pumps < 500) { sc.pump(4); pumps++; }
  return {pumps, L, s};
}

test('S04 vieillissement', () => {
  for (const [opts, want, label] of [[{}, 181, 'agingFrames par défaut'], [{agingFrames: 30}, 181, 'agingFrames 30'], [{agingFrames: 10}, 61, 'agingFrames 10']]) {
    const {pumps, L, s} = agingRun(opts);
    assert.equal(pumps, want, label + ' : pompe où L tourne');
    assert.equal(L.runs, 1, label);
    assert.equal(L.done, true, label);
    assert.equal(L.removed, true, label);
    assert.equal(s.runs, want - 1, label + ' : S a tourné à chaque pompe d\'avant, pas à celle de L');
  }
});

test('S05 rappel', () => {
  const c = clock(), sc = S.create({now: c.now});
  let calls = 0;
  const t = sc.add({key: 'r', cost: 1, run: () => { c.t += 1; return ++calls <= 3 ? false : undefined; }});
  for (let i = 0; i < 10; i++) sc.pump(4);
  assert.equal(calls, 4);
  assert.equal(t.runs, 4);
  assert.equal(sc.has('r'), false);
  assert.equal(t.spentMs, 4);
});

test('S06 remplacement', () => {
  const c = clock(), sc = S.create({now: c.now}), seen = [];
  const a = sc.add({key: 'save', run: () => { seen.push('a'); c.t += 1; }});
  const b = sc.add({key: 'save', run: () => { seen.push('b'); c.t += 1; }});
  assert.equal(sc.count('frame'), 1);
  assert.equal(a.removed, true);
  assert.equal(b.removed, false);
  assert.ok(b.seq > a.seq);
  sc.pump(4);
  assert.deepEqual(seen, ['b']);
  assert.equal(a.runs, 0);
  assert.equal(b.runs, 1);
  sc.add({key: 'k', lane: 'frame', run() {}});
  sc.add({key: 'k', lane: 'sim', run() {}});
  assert.equal(sc.count(), 2);
  assert.equal(sc.count('frame'), 1);
  assert.equal(sc.count('sim'), 1);
});

test('S07 cancel', () => {
  const sc = S.create({now: () => 0});
  const f = sc.add({key: 'x', lane: 'frame', run() {}});
  const s = sc.add({key: 'x', lane: 'sim', run() {}});
  assert.equal(sc.cancel('x'), true);
  assert.equal(f.removed, true);
  assert.equal(s.removed, true);
  assert.equal(sc.cancel('x'), false);
  assert.equal(sc.count(), 0);
  assert.equal(sc.has('x'), false);
});

test('S08 flush, file image', () => {
  // Horloge interdite : flush ne la lit jamais.
  const sc = S.create({now: bannedClock}), deadlines = [];
  let calls = 0;
  const t = sc.add({key: 'f', run: d => { deadlines.push(d); return ++calls <= 5 ? false : true; }});
  assert.equal(sc.flush('f'), true);
  assert.equal(calls, 6);
  assert.equal(deadlines.length, 6);
  assert.ok(deadlines.every(d => d === Infinity));
  assert.equal(t.runs, 6);
  assert.equal(t.done, true);
  assert.equal(sc.has('f'), false);
  assert.equal(sc.stats.flushes, 1);
  assert.equal(sc.flush('zzz'), false);
  assert.equal(sc.stats.flushes, 1);
});

test('S09 budget nul', () => {
  const c = clock(), sc = S.create({now: c.now});
  let ran = false;
  const rec = sc.add({key: 't', run: () => { ran = true; }});
  assert.equal(sc.pump(0), 0);
  assert.equal(sc.pump(-1), 0);
  assert.equal(sc.pump(NaN), 0);
  assert.equal(ran, false);
  assert.equal(sc.stats.ran, 0);
  assert.equal(sc.count(), 1);
  // Une image sans budget (image en retard) ne fait vieillir personne.
  assert.equal(rec.age, 0);
  sc.cancel('t');
  assert.equal(sc.pump(4), 0);
});

test('S10 échéance', () => {
  const c = clock(100), sc = S.create({now: c.now}), got = [];
  const rec = sc.add({key: 't', run: (deadline, task) => { got.push([deadline, task]); }});
  sc.pump(4);
  assert.equal(got.length, 1);
  assert.equal(got[0][0], 104);
  // La tâche reçue est l'enregistrement rendu par add, pas une copie.
  assert.equal(got[0][1], rec);
  // Échéance = now() + budget restant : après une première tâche de 1 ms, la seconde reçoit 101 + 3.
  const c2 = clock(100), sc2 = S.create({now: c2.now}), got2 = [];
  const r1 = sc2.add({key: 'u', run: (deadline, task) => { got2.push([deadline, task]); c2.t += 1; }});
  const r2 = sc2.add({key: 'v', run: (deadline, task) => { got2.push([deadline, task]); }});
  sc2.pump(4);
  assert.equal(got2.length, 2);
  assert.equal(got2[0][0], 104);
  assert.equal(got2[0][1], r1);
  assert.equal(got2[1][0], 104);
  assert.equal(got2[1][1], r2);
});

test('S11 découpage déterministe', () => {
  const run = now => {
    const sc = S.create(now === undefined ? undefined : {now});
    simTask(sc, 'nav', undefined, 40000);
    const usedList = [];
    while (sc.count('sim') > 0 && usedList.length < 1000) usedList.push(sc.pumpSim(768));
    return {usedList, sc};
  };
  const {usedList, sc} = run();
  assert.equal(usedList.length, 53);
  assert.ok(usedList.slice(0, 52).every(u => u === 768));
  assert.equal(usedList[52], 64);
  assert.equal(sc.stats.simUnits, 40000);
  // Avec l'horloge interdite, pumpSim marche aussi, et découpe de la même façon.
  const banned = run(bannedClock);
  assert.deepEqual(banned.usedList, usedList);
  assert.equal(banned.sc.stats.simUnits, 40000);
});

test('S12 priorités sim', () => {
  const sc = S.create(), log = [];
  simTask(sc, 'A', 1, 100, Infinity, log); simTask(sc, 'B', 0, 50, Infinity, log);
  assert.equal(sc.pumpSim(120), 120);
  assert.equal(sc.pumpSim(120), 30);
  assert.equal(log.join(' '), 'B120:50 A70:70 A120:30');
  assert.equal(sc.count('sim'), 0);
  assert.equal(sc.pumpSim(120), 0);
  assert.equal(sc.pumpSim(0), 0);
  assert.equal(log.length, 3);
});

test('S13 tâche sans travail', () => {
  const sc = S.create(), log = [];
  const z = sc.add({lane: 'sim', key: 'Z', priority: 0, run: u => { log.push('Z' + u); return 0; }});
  let left = 10;
  sc.add({lane: 'sim', key: 'Y', priority: 1, run: (u, t) => { const used = Math.min(u, left); left -= used; if (!left) t.done = true; log.push('Y' + u); return used; }});
  assert.equal(sc.pumpSim(5), 5);
  assert.equal(log.join(' '), 'Z5 Y5');
  assert.equal(sc.has('Z'), true);
  assert.equal(z.removed, false);
  assert.equal(sc.count('sim'), 2);
});

test('S14 déterminisme de la file sim', () => {
  const runSim = now => {
    const sc = S.create({now}), trace = [];
    simTask(sc, 'a', 0, 500, 37, trace); simTask(sc, 'b', 1, 300, 38, trace); simTask(sc, 'c', 0, 900, 39, trace);
    for (let f = 0; f < 200; f++) {
      sc.add({key: 'img' + (f % 7), run() {}});
      sc.pump(4);
      sc.pumpSim(60);
    }
    return {trace, stats: sc.stats};
  };
  let k = 7, t = 0;
  const A = runSim(() => 0);
  const B = runSim(() => { k = (Math.imul(k, 1103515245) + 12345) >>> 0; t += (k % 50) / 10; return t; });
  assert.equal(A.trace.length, 59);
  assert.deepEqual(B.trace, A.trace);
  assert.equal(A.stats.simUnits, 1700);
  assert.equal(B.stats.simUnits, 1700);
  // L'horloge a bien changé la file « image » (tranches mesurées), sans rien changer à la file « sim ».
  assert.equal(A.stats.maxSliceMs, 0);
  assert.ok(B.stats.maxSliceMs > 0);
});

test('S15 retours invalides', () => {
  for (const bad of [1.5, -1, 6, NaN, undefined, '3']) {
    const sc = S.create();
    const t = sc.add({lane: 'sim', key: 'x', run: () => bad});
    assert.throws(() => sc.pumpSim(5), isTypeError, String(bad));
    assert.equal(sc.has('x'), false, String(bad));
    assert.equal(t.removed, true, String(bad));
    assert.equal(sc.stats.errors, 1, String(bad));
    assert.equal(sc.stats.simUnits, 0, String(bad));
  }
  const sc = S.create();
  let called = 0;
  sc.add({lane: 'sim', key: 'y', run: () => { called++; return 0; }});
  for (const bad of [1.5, -1, NaN, '5']) assert.throws(() => sc.pumpSim(bad), isTypeError, String(bad));
  assert.throws(() => sc.pumpSim(), isTypeError, 'pumpSim()');
  // Un argument refusé n'est pas une erreur de tâche : rien ne tourne, rien n'est retiré.
  assert.equal(called, 0);
  assert.equal(sc.has('y'), true);
  assert.equal(sc.stats.errors, 0);
});

test('S16 exception', () => {
  const c = clock(), sc = S.create({now: c.now}), boom = new Error('kaboom');
  let okRuns = 0;
  sc.add({key: 'boom', priority: 0, run: () => { throw boom; }});
  sc.add({key: 'ok', priority: 1, run: () => { okRuns++; c.t += 1; }});
  assert.throws(() => sc.pump(4), e => e === boom);
  assert.equal(sc.has('boom'), false);
  assert.equal(sc.has('ok'), true);
  assert.equal(okRuns, 0);
  assert.equal(sc.stats.errors, 1);
  sc.pump(4);
  assert.equal(okRuns, 1);
  assert.equal(sc.has('ok'), false);
  // File « sim » : même chose.
  const sc2 = S.create(), boom2 = new Error('sim'), log = [];
  sc2.add({lane: 'sim', key: 'boom', priority: 0, run: () => { throw boom2; }});
  simTask(sc2, 'ok', 1, 3, Infinity, log);
  assert.throws(() => sc2.pumpSim(5), e => e === boom2);
  assert.equal(sc2.has('boom'), false);
  assert.equal(sc2.has('ok'), true);
  assert.equal(log.length, 0);
  assert.equal(sc2.stats.errors, 1);
  assert.equal(sc2.pumpSim(5), 3);
  assert.deepEqual(log, ['ok5:3']);
  assert.equal(sc2.has('ok'), false);
});

test('S17 budget', () => {
  assert.equal(S.budget(1000 / 60, 5), 4);
  assert.ok(Math.abs(S.budget(1000 / 60, 13) - 1.1666666666666679) <= 1e-9, String(S.budget(1000 / 60, 13)));
  assert.equal(S.budget(1000 / 60, 15), 0);
  assert.ok(Math.abs(S.budget(1000 / 144, 3) - 2.9027777777777777) <= 1e-9, String(S.budget(1000 / 144, 3)));
  for (const p of [0, NaN, -5]) assert.equal(S.budget(p, 5), 4, String(p));
  assert.equal(S.budget(1000 / 60, NaN), 0);
  assert.equal(S.budget(1000 / 30, 1, 8), 8);
  assert.equal(S.budget(1000 / 60, 0, 2), 2);
});

test('S18 flush sim et garde', () => {
  const sc = S.create(), args = [];
  let left = 40000;
  const rec = sc.add({lane: 'sim', key: 'nav', run: (u, t) => { args.push(u); const used = Math.min(u, left, 1000); left -= used; if (!left) t.done = true; return used; }});
  assert.equal(sc.flush('nav'), true);
  assert.equal(args.length, 40);
  // Chacun des 40 appels reçoit Number.MAX_SAFE_INTEGER, pas seulement le dernier.
  args.forEach((u, i) => assert.equal(u, Number.MAX_SAFE_INTEGER, 'appel ' + (i + 1)));
  assert.equal(rec.runs, 40);
  assert.equal(sc.stats.simUnits, 40000);
  assert.equal(sc.has('nav'), false);
  assert.equal(sc.stats.flushes, 1);
  // Garde : une tâche « image » qui ne finit jamais.
  const sc2 = S.create({now: bannedClock});
  let n = 0;
  const never = sc2.add({key: 'never', run: () => { n++; return false; }});
  assert.throws(() => sc2.flush('never'), e => e.name === 'Error' && e.message.includes('never finished'));
  assert.equal(n, 1e6);
  assert.equal(sc2.has('never'), true);
  assert.equal(never.removed, false);
  const sc3 = S.create();
  sc3.add({lane: 'sim', key: 'bad', run: () => -2});
  assert.throws(() => sc3.flush('bad'), isTypeError);
  assert.equal(sc3.has('bad'), false);
  assert.equal(sc3.stats.errors, 1);
});

test('S19 ajout pendant pump', () => {
  const c = clock(), sc = S.create({now: c.now}), seen = [];
  let q;
  sc.add({key: 'p', run: () => { seen.push('p'); if (!q) q = sc.add({key: 'q', run: () => { seen.push('q'); }}); }});
  sc.pump(10);
  assert.deepEqual(seen, ['p']);
  assert.equal(sc.has('q'), true);
  assert.equal(q.age, 0);
  assert.equal(q.runs, 0);
  sc.pump(10);
  assert.equal(seen.join(''), 'pq');
  assert.equal(sc.has('q'), false);
});

test('S20 sans horloge et validation', () => {
  const s0 = S.create();
  assert.throws(() => s0.pump(4), isTypeError, 'file vide');
  assert.throws(() => s0.pump(0), isTypeError, 'file vide, budget nul');
  s0.add({key: 'x', run() {}});
  assert.throws(() => s0.pump(4), isTypeError, 'file non vide');
  const sc = S.create();
  sc.add({key: 'f', run: () => true});
  assert.equal(sc.flush('f'), true);
  assert.throws(() => S.create({now: 5}), isTypeError);
  assert.throws(() => S.create({agingFrames: 0}), isTypeError);
  assert.throws(() => S.create({agingFrames: 1.5}), isTypeError);
  assert.throws(() => sc.add({}), isTypeError);
  assert.throws(() => sc.add(null), isTypeError);
  assert.throws(() => sc.add({lane: 'gpu', run() {}}), isTypeError);
  const t = sc.add({run() {}, priority: 'x', cost: -1});
  assert.equal(t.priority, 5);
  assert.equal(t.cost, 1);
  assert.equal(t.lane, 'frame');
  assert.equal(t.age, 0);
  assert.equal(t.runs, 0);
  // Les champs de l'enregistrement (§4.9).
  assert.deepEqual(Object.keys(t).sort(), ['age', 'cost', 'done', 'key', 'lane', 'lastPump', 'priority', 'removed', 'run', 'runs', 'seq', 'spentMs']);
  assert.deepEqual(Object.keys(sc.stats).sort(), ['errors', 'flushes', 'maxSliceMs', 'overrunMs', 'ran', 'simUnits', 'skipped']);
  // Un ordonnanceur neuf : les 7 statistiques à 0.
  const fresh = S.create().stats;
  assert.ok(Object.keys(fresh).length === 7 && Object.values(fresh).every(v => v === 0), JSON.stringify(fresh));
});

test('S21 coût lissé et vieillissement des sautées', () => {
  const c = clock(), sc = S.create({now: c.now});
  const a = sc.add({key: 'a', cost: 4, run: () => { c.t += 2; return false; }});
  sc.pump(10);
  assert.equal(a.cost, 3);
  sc.pump(10);
  assert.equal(a.cost, 2.5);
  assert.equal(a.spentMs, 4);
  assert.equal(a.runs, 2);
  const b = sc.add({key: 'b', priority: 9, cost: 50, run() {}});
  sc.pump(3);
  assert.equal(b.age, 1);
  assert.equal(sc.stats.skipped, 1);
  sc.pump(3);
  assert.equal(b.age, 2);
  assert.equal(sc.stats.skipped, 2);
  assert.equal(b.runs, 0);
});

test('S22 source', () => {
  for (const banned of ['Math.random', 'performance', 'Date', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'import', 'export', 'require(', '</script', '@import'])
    assert.ok(!source.includes(banned), banned);
  assert.ok(!/\b(?:player|enem|weapon|projectile|metal|audio|nav)/i.test(source));
});
