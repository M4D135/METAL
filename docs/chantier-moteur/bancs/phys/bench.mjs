// Main bench of the FPhys prototype. The machine is heavily loaded by other agents, so every step of a
// deterministic scene is timed in REPS alternated repeats and the per-step MINIMUM is kept (same workload each time).
// usage: node bench.mjs [reps] [hz] [substeps] [extra-json-options]
import { SCENES } from './scenes.mjs';
const REPS = +(process.argv[2] || 7), HZ = +(process.argv[3] || 120), SUB = +(process.argv[4] || 1), EXTRA = process.argv[5] ? JSON.parse(process.argv[5]) : {};
const PLAN = { stack10: 1200, pyramid55: 1200, rubble300: 1800, blast200: 1500 };
const scale = HZ / 120, q = (a, p) => { const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }, mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const out = {};
function run(name, opts) {
  const steps = Math.round(PLAN[name] * scale), sc = SCENES[name]({ ...EXTRA, ...opts }), w = sc.w, t = new Float64Array(steps), rows = [];
  let sleepAt = -1;
  for (let i = 0; i < steps; i++) {
    if (name === 'blast200' && i === Math.round(240 * scale)) w.explode(0, 0.5, 0, 14, 900);
    const t0 = performance.now(); w.step(1 / HZ, SUB); t[i] = performance.now() - t0;
    rows.push([w.stats.awake, w.stats.contacts, w.stats.tests, w.stats.manifolds]);
    if (w.stats.awake === 0 && sleepAt < 0 && i > 5 && !(name === 'blast200' && i < 240 * scale)) sleepAt = i;
  }
  return { t, rows, hash: w.hash(), sc, sleepAt };
}
for (const name of Object.keys(PLAN)) out[name] = { best: null, hashes: new Set(), rows: null, last: null };
for (let rep = 0; rep < REPS; rep++)for (const name of Object.keys(PLAN)) {
  const r = run(name, {}), o = out[name]; o.hashes.add(r.hash); o.rows = r.rows; o.last = r;
  if (!o.best) o.best = r.t; else for (let i = 0; i < r.t.length; i++)if (r.t[i] < o.best[i]) o.best[i] = r.t[i];
}
const fit = [];
for (const name of Object.keys(PLAN)) {
  const o = out[name], idx = []; for (let i = 0; i < o.best.length; i++)if (o.rows[i][0] > 0) idx.push(i);
  const warm = idx.filter(i => i >= 20), ts = warm.map(i => o.best[i] * 1000), aw = warm.map(i => o.rows[i][0]), co = warm.map(i => o.rows[i][1]), te = warm.map(i => o.rows[i][2]);
  for (const i of warm) fit.push([o.rows[i][0], o.rows[i][1], o.rows[i][2], o.best[i] * 1000]);
  const sumT = ts.reduce((a, b) => a + b, 0), sumA = aw.reduce((a, b) => a + b, 0), sumC = co.reduce((a, b) => a + b, 0);
  console.log(`${name}: ${HZ} Hz x${SUB} | awake steps ${idx.length}/${o.best.length} | us/step mean ${mean(ts).toFixed(1)} p50 ${q(ts, .5).toFixed(1)} p95 ${q(ts, .95).toFixed(1)} max ${Math.max(...ts).toFixed(1)} | awake mean ${mean(aw).toFixed(0)} max ${Math.max(...aw)} | contact pts mean ${mean(co).toFixed(0)} max ${Math.max(...co)} | SAT tests mean ${mean(te).toFixed(0)} | us per awake body-step ${(sumT / sumA).toFixed(3)} | us per contact pt ${(sumT / Math.max(1, sumC)).toFixed(3)} | all asleep at step ${o.last.sleepAt} (${(o.last.sleepAt / HZ).toFixed(2)} s) | hashes ${[...o.hashes].join(',')} ${o.hashes.size === 1 ? 'DETERMINISTIC' : 'DIVERGED'}`);
  const sc = o.last.sc, w = sc.w;
  if (sc.ideal) { let h = 0, v = 0, tilt = 0; for (let k = 0; k < sc.ids.length; k++) { const i = sc.ids[k], id = sc.ideal(k); h = Math.max(h, Math.hypot(w.P[i * 3] - id[0], w.P[i * 3 + 2] - id[2])); v = Math.max(v, Math.abs(w.P[i * 3 + 1] - id[1])); tilt = Math.max(tilt, 1 - Math.abs(w.R[i * 9 + 4])); } console.log(`   final pose error: horizontal max ${(h * 1000).toFixed(2)} mm, vertical max ${(v * 1000).toFixed(2)} mm, max tilt ${(Math.acos(1 - tilt) * 180 / Math.PI).toFixed(3)} deg`); }
  else { let minY = 1e9, maxY = -1e9, out2 = 0, speed = 0; for (const i of sc.ids) { minY = Math.min(minY, w.P[i * 3 + 1] - Math.max(w.H[i * 3], w.H[i * 3 + 1], w.H[i * 3 + 2]) * 0); maxY = Math.max(maxY, w.P[i * 3 + 1]); if (Math.abs(w.P[i * 3]) > 13 || Math.abs(w.P[i * 3 + 2]) > 13 || w.P[i * 3 + 1] < -0.05) out2++; } console.log(`   final: centre y min ${minY.toFixed(3)} max ${maxY.toFixed(3)}, bodies escaped or under ground ${out2}`); }
}
// least squares: us = a*awake + b*contactPts + c*satTests (no intercept)
{ const n = 3, A = Array.from({ length: n }, () => new Float64Array(n + 1)); for (const r of fit) { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++)A[i][j] += r[i] * r[j]; A[i][n] += r[i] * r[3]; } }
  for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++)if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;[A[i], A[p]] = [A[p], A[i]]; for (let k = 0; k < n; k++)if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++)A[k][j] -= f * A[i][j]; } }
  const c = A.map((r, i) => r[n] / r[i]); let err = 0, tot = 0; for (const r of fit) { err += Math.abs(c[0] * r[0] + c[1] * r[1] + c[2] * r[2] - r[3]); tot += r[3]; }
  console.log(`fit (min-filtered, ${fit.length} steps): us/step = ${c[0].toFixed(3)}*awake + ${c[1].toFixed(3)}*contactPts + ${c[2].toFixed(3)}*satTests ; mean abs error ${(100 * err / tot).toFixed(1)} %`); }
