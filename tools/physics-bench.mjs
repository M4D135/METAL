// FPhysics bench (lot 17, module side; module brief §8.2): cost per sub-step of the module scenes, in the main realm of
// Node only (tools/realm-loader.mjs; never node:vm, which is 4.5 to 9 times slower). The bench times with
// performance.now(); the module never reads a clock. The machine may be shared: the repeats are alternated in one
// process, the minimum of each sub-step over the repeats is kept, and the load average is reported.
//
//   node tools/physics-bench.mjs [--reps 5] [--scenes a,b] [--out FILE]
//       stack10 (1 200 sub-steps), pyramid55 (1 200), rubble300 (1 800) and blast200 (1 500, blast before sub-step 240),
//       each paired with the prototype docs/chantier-moteur/bancs/phys/fphys.mjs on its own scene (ground plane, raw
//       masses, island wake): costs are compared, not hashes.
//   node tools/physics-bench.mjs --compare ROOT [--reps 5] [--scenes a,b] [--out FILE]
//       the same scenes, the current module against ROOT/src/physics.js (for instance a copy of
//       git show HEAD:src/physics.js), alternated in the same process; says whether the final hashes are identical.
//   node tools/physics-bench.mjs --hashes [--pas N]
//       one JSON line: hashes(F, N) of checks/fphysics-scenes.mjs, N = 600 by default.
//
// Reported per scene and per variant, over the active sub-steps (the solver ran) from sub-step 20 on, as in
// bancs/phys/bench.mjs: median, mean, p95 and max in µs per sub-step; the total of the whole run (sum of the minima);
// µs per awake body and sub-step; peaks of awake bodies, contact points, pairs and narrow-phase tests; the sub-step at
// whose end every body sleeps (after the blast for blast200); the final hash, the same at every repeat or
// NON DÉTERMINISTE. The pair: ratios of the mean and of the median, and the median of the per-repeat total ratios.
import {writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {loadRealm, DEFAULT_ROOT} from './realm-loader.mjs';
import {environment, summarize} from './proof/common.mjs';
import {SCENES, hashes} from '../checks/fphysics-scenes.mjs';

const PLAN = Object.freeze({stack10: 1200, pyramid55: 1200, rubble300: 1800, blast200: 1500});
const BLAST_AT = 240, WARM = 20, HZ = 120;

function parse(argv) {
  const o = {reps: 5, scenes: Object.keys(PLAN), out: null, compare: null, hashes: false, pas: 600, help: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], value = () => { if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error('missing value after ' + a); return argv[++i]; };
    if (a === '--reps') o.reps = Number(value());
    else if (a === '--scenes') o.scenes = value().split(',');
    else if (a === '--out') o.out = resolve(value());
    else if (a === '--compare') o.compare = resolve(value());
    else if (a === '--hashes') o.hashes = true;
    else if (a === '--pas') o.pas = Number(value());
    else if (a === '--help') o.help = true;
    else throw new Error('unknown argument ' + a + ' (see --help)');
  }
  if (!Number.isSafeInteger(o.reps) || o.reps < 1) throw new Error('--reps must be a positive integer');
  if (!Number.isSafeInteger(o.pas) || o.pas < 1) throw new Error('--pas must be a positive integer');
  for (const s of o.scenes) if (!(s in PLAN)) throw new Error('unknown scene ' + s + ' (' + Object.keys(PLAN).join(', ') + ')');
  if (o.compare && !existsSync(join(o.compare, 'src', 'physics.js'))) throw new Error('--compare: ' + join(o.compare, 'src', 'physics.js') + ' not found');
  return o;
}

const physics = root => loadRealm({root, modules: ['physics']}).window.FPhysics;

// One run of a module scene: time of each sub-step (ms), counters after it, active flag, end of the full sleep.
function moduleRun(F, name) {
  const steps = PLAN[name], sc = SCENES[name](F), w = sc.w, t = new Float64Array(steps), c = new Int32Array(steps * 4), act = new Uint8Array(steps);
  let asleepAt = 0;
  for (let i = 0; i < steps; i++) {
    if (sc.tick) sc.tick(i);
    const t0 = performance.now(); w.step(1 / HZ); t[i] = performance.now() - t0;
    const s = w.stats, k = i * 4;
    c[k] = s.awake; c[k + 1] = s.contacts; c[k + 2] = s.manifolds; c[k + 3] = s.tests;
    // stats.awake is counted after the sleep test: the sub-step that puts the last bodies to sleep still has its tests.
    act[i] = s.awake > 0 || s.tests > 0 ? 1 : 0;
    if (!asleepAt && s.sleeping === s.bodies && (name !== 'blast200' || i >= BLAST_AT)) asleepAt = i + 1;
  }
  return {t, c, act, asleepAt, hash: w.hash()};
}
// The same for the prototype, with its own scenes and API: step(1/120, 1), explode(0, .5, 0, 14, 900) before sub-step 240.
function prototypeRun(P, name) {
  const steps = PLAN[name], sc = P.SCENES[name]({}), w = sc.w, t = new Float64Array(steps), c = new Int32Array(steps * 4), act = new Uint8Array(steps);
  let asleepAt = 0;
  for (let i = 0; i < steps; i++) {
    if (name === 'blast200' && i === BLAST_AT) w.explode(0, 0.5, 0, 14, 900);
    const t0 = performance.now(); w.step(1 / HZ, 1); t[i] = performance.now() - t0;
    const s = w.stats, k = i * 4;
    c[k] = s.awake; c[k + 1] = s.contacts; c[k + 2] = s.manifolds; c[k + 3] = s.tests;
    act[i] = s.awake > 0 ? 1 : 0;   // counted before its sleep test
    if (!asleepAt && (name !== 'blast200' || i >= BLAST_AT) && sc.ids.every(j => (w.FL[j] & 2) !== 0)) asleepAt = i + 1;
  }
  return {t, c, act, asleepAt, hash: w.hash()};
}

const sum = a => { let s = 0; for (const v of a) s += v; return s; };
const median = a => { const s = Float64Array.from(a).sort(); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
// Repeats of one variant on one scene: minimum of each sub-step, statistics over the active sub-steps from WARM on.
function aggregate(runs) {
  const steps = runs[0].t.length, best = Float64Array.from(runs[0].t), last = runs[runs.length - 1];
  for (const r of runs) for (let i = 0; i < steps; i++) if (r.t[i] < best[i]) best[i] = r.t[i];
  const us = [], peaks = {awake: 0, contacts: 0, manifolds: 0, tests: 0};
  let awake = 0;
  for (let i = 0; i < steps; i++) {
    const k = i * 4;
    peaks.awake = Math.max(peaks.awake, last.c[k]); peaks.contacts = Math.max(peaks.contacts, last.c[k + 1]);
    peaks.manifolds = Math.max(peaks.manifolds, last.c[k + 2]); peaks.tests = Math.max(peaks.tests, last.c[k + 3]);
    if (i >= WARM && last.act[i]) { us.push(best[i] * 1000); awake += last.c[k]; }
  }
  const s = summarize(us), set = [...new Set(runs.map(r => r.hash))];
  return {activeSubSteps: us.length, medianUs: s.medianUs, meanUs: s.meanUs, p95Us: s.p95Us, maxUs: s.maxUs, totalMs: sum(best),
    usPerAwakeBody: awake ? s.totalUs / awake : null, peaks, asleepAt: last.asleepAt || null, asleepSeconds: last.asleepAt ? last.asleepAt / HZ : null,
    hash: set.length === 1 ? set[0] : 'NON DÉTERMINISTE', hashes: set, deterministic: set.length === 1, repTotalsMs: runs.map(r => sum(r.t))};
}

const f1 = v => v === null ? '—' : v.toFixed(1), f2 = v => v === null ? '—' : v.toFixed(2);
function line(label, a) {
  if (a.error) return `  ${label.padEnd(11)}: indisponible (${a.error})`;
  const sleep = a.asleepAt ? `tout dort à la fin du sous-pas ${a.asleepAt} (${a.asleepSeconds.toFixed(2)} s)` : 'ne dort pas entièrement';
  return `  ${label.padEnd(11)}: ${a.activeSubSteps} sous-pas actifs | µs/sous-pas médiane ${f1(a.medianUs)} moyenne ${f1(a.meanUs)} p95 ${f1(a.p95Us)} max ${f1(a.maxUs)}` +
    ` | total ${f1(a.totalMs)} ms | ${f2(a.usPerAwakeBody)} µs par corps éveillé | pics ${a.peaks.awake} éveillés, ${a.peaks.contacts} points, ${a.peaks.manifolds} paires,` +
    ` ${a.peaks.tests} tests | ${sleep} | hachage ${a.hash}${a.deterministic ? '' : ' (' + a.hashes.join(', ') + ')'}`;
}
function pair(a, b) {
  if (a.error || b.error) return null;
  const ratios = a.repTotalsMs.map((t, k) => t / b.repTotalsMs[k]);
  return {mean: a.meanUs / b.meanUs, median: a.medianUs / b.medianUs, total: a.totalMs / b.totalMs, pairedTotal: median(ratios), pairedTotals: ratios, sameHash: a.deterministic && a.hash === b.hash};
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (o.help) { console.log(process.argv[1] + '\n' + 'see the header of tools/physics-bench.mjs'); return; }
  const F = physics(DEFAULT_ROOT);
  if (o.hashes) { console.log(JSON.stringify(hashes(F, o.pas))); return; }
  const env = environment(), mode = o.compare ? 'compare' : 'prototype';
  const R = o.compare ? physics(o.compare) : null;
  const B = R ? {label: 'référence', run: name => moduleRun(R, name)}
    : await import(new URL('../docs/chantier-moteur/bancs/phys/scenes.mjs', import.meta.url).href).then(P => ({label: 'prototype', run: name => prototypeRun(P, name)}));
  const A = {label: 'module', run: name => moduleRun(F, name)}, runs = {};
  console.log(`FPhysics, banc du module (${mode === 'compare' ? 'contre ' + o.compare + '/src/physics.js' : 'contre le prototype bancs/phys/fphys.mjs'}) ; ${o.reps} répétitions alternées, minimum par sous-pas`);
  console.log(`Node ${env.node}, ${env.cpu}, ${env.logicalCpus} cœurs ; charge au départ ${env.loadAverage.map(v => v.toFixed(2)).join(' ')}`);
  if (mode === 'compare' && o.reps < 5) console.log('(moins de 5 répétitions : comparaison indicative)');
  for (const name of o.scenes) runs[name] = {[A.label]: [], [B.label]: [], errors: {}};
  for (let rep = 0; rep < o.reps; rep++) for (const name of o.scenes) for (const V of rep % 2 ? [B, A] : [A, B]) {
    const r = runs[name];
    if (r.errors[V.label]) continue;
    try { r[V.label].push(V.run(name)); } catch (e) { r.errors[V.label] = String(e && e.message || e); }
  }
  const results = [];
  for (const name of o.scenes) {
    const r = runs[name], out = {scene: name, subSteps: PLAN[name], reps: o.reps, blastAt: name === 'blast200' ? BLAST_AT : undefined};
    for (const V of [A, B]) out[V.label] = r.errors[V.label] ? {error: r.errors[V.label]} : aggregate(r[V.label]);
    out.ratio = pair(out[A.label], out[B.label]);
    results.push(out);
    console.log(`\n${name} (${PLAN[name]} sous-pas${name === 'blast200' ? ', souffle avant le sous-pas ' + BLAST_AT : ''})`);
    console.log(line(A.label, out[A.label]));
    console.log(line(B.label, out[B.label]));
    if (out.ratio) {
      const q = out.ratio, x = v => '×' + v.toFixed(2);
      console.log(`  ${A.label}/${B.label} : moyenne ${x(q.mean)}, médiane ${x(q.median)}, total ${x(q.total)} (médiane des ${q.pairedTotals.length} rapports appariés ${x(q.pairedTotal)})` +
        (mode === 'compare' ? ` ; hachages ${q.sameHash ? 'identiques' : 'différents'}` : ''));
    }
  }
  const after = environment().loadAverage;
  console.log(`\ncharge à la fin ${after.map(v => v.toFixed(2)).join(' ')}`);
  if (o.out) {
    mkdirSync(dirname(o.out), {recursive: true});
    writeFileSync(o.out, JSON.stringify({environment: env, loadAverageAfter: after, mode, reference: o.compare || 'docs/chantier-moteur/bancs/phys/fphys.mjs', results}, null, 2) + '\n');
    console.log('écrit : ' + o.out);
  }
}

main().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
