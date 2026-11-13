// Lot 02 / T5 (LOAD-06) : gain de FWorld.create entre deux arbres de sources, alternés dans le même
// processus. Chaque monde est créé trois fois dans chaque variante (ordre AB/BA alterné) ; on garde
// la médiane par monde, puis la somme. L'identité est revérifiée au passage.
// usage : node gain.mjs <racine-avant> <racine-après> [sortie.json]
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const [rootA, rootB] = process.argv.slice(2, 4).map(p => resolve(p));
if (!rootA || !rootB) throw new Error('usage: node gain.mjs <racine-avant> <racine-après> [sortie.json]');
const A = loadRealm({root: rootA}), B = loadRealm({root: rootB});
const fnv = s => { let f = 2166136261; for (let i = 0; i < s.length; i++) f = Math.imul(f ^ s.charCodeAt(i), 16777619); return (f >>> 0).toString(36); };
const cases = [];
for (const seed of [96, 424242]) {
  for (let i = 0; i < 18; i++) cases.push([seed, i, {campaign: true, campaignVersion: 2}]);
  for (let i = 0; i < 3; i++) cases.push([seed, i, undefined]);
}
for (let i = 0; i < 18; i += 5) cases.push([96, i, {campaign: true}]);
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const worlds = [];
let same = 0;
for (const [seed, i, o] of cases) {
  const ta = [], tb = []; let ha = '', hb = '';
  for (let rep = 0; rep < 3; rep++) {
    let t = performance.now();
    const a = JSON.stringify(A.window.FWorld.create(seed, i, o)); ta.push(performance.now() - t);
    t = performance.now();
    const b = JSON.stringify(B.window.FWorld.create(seed, i, o)); tb.push(performance.now() - t);
    if (!rep) { ha = fnv(a); hb = fnv(b); }
  }
  if (ha === hb) same++;
  worlds.push({ id: `${seed}/${i}/${o ? (o.campaignVersion === 2 ? 'v2' : 'v1') : 'legacy'}`, originalMs: +med(ta).toFixed(1), patchedMs: +med(tb).toFixed(1), gain: +(1 - med(tb) / med(ta)).toFixed(3) });
}
const ta = worlds.reduce((n, w) => n + w.originalMs, 0), tb = worlds.reduce((n, w) => n + w.patchedMs, 0);
const report = {
  schema: 'lot02-t5-gain-v1', cases: cases.length, identical: same,
  totalMs: {original: +ta.toFixed(1), patched: +tb.toFixed(1), gain: +(1 - tb / ta).toFixed(3)},
  perWorldMs: {originalMedian: +med(worlds.map(w => w.originalMs)).toFixed(1), patchedMedian: +med(worlds.map(w => w.patchedMs)).toFixed(1)},
  gainMedian: +med(worlds.map(w => w.gain)).toFixed(3),
  sourceSha256: { original: A.sourceSha256.world, patched: B.sourceSha256.world },
  worlds,
};
const text = JSON.stringify(report, null, 1) + '\n';
if (process.argv[4]) { writeFileSync(process.argv[4], text); console.log(JSON.stringify({out: process.argv[4], identical: same, cases: cases.length, totalGain: report.totalMs.gain})); }
else process.stdout.write(text);
