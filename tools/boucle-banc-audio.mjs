// Banc audio de la voie « boucle » (§7.8 de la mission, étape 8, facultative) : STAB-07 et LOAD-13 sur la vraie
// pré-synthèse des tampons PCM de FAudio (34 noms, variantes 0 et 1, une seule pour motor:*). A, aujourd'hui : lots
// de 2 noms comme warmBank (audio.js:311), une tranche par lot. B, FSchedule : une tâche « image » par tampon
// (priorité 6, coût 2), pump(4) jusqu'à file vide. Domaine principal de Node (jamais node:vm, MASTER-PROMPT §4),
// temps CPU du fil (process.threadCpuUsage), qui sert aussi d'horloge now à FSchedule. Machine partagée : 5
// répétitions, A et B alternés, médianes. Classe : état identique (même PCM au bit près dans chaque construction),
// mesures pour information. N'écrit que banc-audio.json ; code 1 si un critère tombe.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRealm} from './realm-loader.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'docs', 'chantier-moteur', 'preuves', 'module-boucle');
const FAudio = loadRealm({root, modules: ['music', 'audio'], realm: 'main'}).window.FAudio;
const FSchedule = loadRealm({root, modules: ['schedule'], realm: 'main'}).window.FSchedule;
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const loadavg = os.loadavg(), started = process.hrtime.bigint();

const RATE = 22050, BUDGET = 4, PRIORITY = 6, COST = 2, REPS = 5, LIMIT_MS = 32;
const names = FAudio.effectNames, variants = n => n.startsWith('motor:') ? 1 : 2;
const jobs = [];                                // ordre canonique : celui de effectNames, variante 0 puis 1
for (const n of names) for (let v = 0; v < variants(n); v++) jobs.push([n, v]);
const digest = list => { const h = createHash('sha256'); for (const a of list) h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); return h.digest('hex'); };

// Chauffe : chaque tampon une fois (compilation à chaud) ; ce PCM est la référence des constructions suivantes.
const w0 = cpu(), warm = jobs.map(([n, v]) => FAudio.synthesize(n, v, RATE)), warmupMs = cpu() - w0;
const pcmSha256 = digest(warm), pcmBytes = warm.reduce((s, a) => s + a.byteLength, 0), samples = warm.reduce((s, a) => s + a.length, 0);

function current() {                            // A : lots de 2 noms (avec toutes leurs variantes), une tranche par lot
  const slices = [], pcm = [];
  for (let i = 0; i < names.length; i += 2) {
    const t0 = cpu();
    for (const n of names.slice(i, i + 2)) for (let v = 0; v < variants(n); v++) pcm.push(FAudio.synthesize(n, v, RATE));
    slices.push(cpu() - t0);
  }
  return {slices, pcm};
}
function scheduled() {                          // B : une tâche « image » par tampon, une tranche par pump(4)
  const S = FSchedule.create({now: cpu}), pcm = new Array(jobs.length), slices = [];
  const tasks = jobs.map(([n, v], k) => S.add({key: 'pcm:' + n + ':' + v, priority: PRIORITY, cost: COST, run() { pcm[k] = FAudio.synthesize(n, v, RATE); }}));
  while (S.count('frame')) {
    if (slices.length > 4 * jobs.length) throw new Error('FSchedule ne vide pas sa file');
    slices.push(S.pump(BUDGET));
  }
  return {slices, pcm, stats: {...S.stats}, tasks: tasks.map(t => ({runs: t.runs, done: t.done, ms: t.spentMs}))};
}

const runs = {A: [], B: []};
for (let r = 0; r < REPS; r++) for (const kind of r % 2 ? ['B', 'A'] : ['A', 'B']) runs[kind].push(kind === 'A' ? current() : scheduled());

const median = v => { const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const spread = v => ({median: median(v), min: Math.min(...v), max: Math.max(...v)});
const over = (v, x) => v.filter(y => y > x).length;
const summary = v => ({slices: v.length, longestMs: Math.max(...v), medianMs: median(v), totalMs: v.reduce((s, x) => s + x, 0),
  over4: over(v, 4), over8: over(v, 8), over16_7: over(v, 16.7), over32: over(v, LIMIT_MS)});
const repetitions = runs.A.map((a, r) => {
  const b = runs.B[r], A = summary(a.slices), B = summary(b.slices);
  let heavy = 0;
  b.tasks.forEach((t, k) => { if (t.ms > b.tasks[heavy].ms) heavy = k; });
  return {rep: r + 1, order: r % 2 ? 'B puis A' : 'A puis B', A,
    B: {...B, longestTaskMs: b.stats.maxSliceMs, longestTask: {name: jobs[heavy][0], variant: jobs[heavy][1]},
      ran: b.stats.ran, skipped: b.stats.skipped, overrunMs: b.stats.overrunMs, errors: b.stats.errors},
    longestRatio: B.longestMs / A.longestMs, totalRatio: B.totalMs / A.totalMs,
    pcmIdentical: digest(a.pcm) === pcmSha256 && digest(b.pcm) === pcmSha256};
});
const col = (kind, key) => repetitions.map(r => r[kind][key]);
const ratios = key => repetitions.map(r => r[key]);
const top = (list, n = 3) => list.sort((x, y) => y.medianMs - x.medianMs).slice(0, n);
const heaviest = {
  batchesA: top(runs.A[0].slices.map((_, i) => ({names: names.slice(2 * i, 2 * i + 2), medianMs: median(runs.A.map(a => a.slices[i]))}))),
  buffersB: top(jobs.map(([name, variant], k) => ({name, variant, medianMs: median(runs.B.map(b => b.tasks[k].ms))}))),
};
const checks = {
  pcmIdentical: repetitions.every(r => r.pcmIdentical),
  allTasksRanOnce: runs.B.every(b => b.stats.ran === jobs.length && b.stats.errors === 0 && b.tasks.every(t => t.runs === 1 && t.done)),
  aOneSlicePerPair: runs.A.every(a => a.slices.length === Math.ceil(names.length / 2)),
  bLongestSliceWithinLimit: repetitions.every(r => r.B.longestMs <= LIMIT_MS),
  bLongestTaskWithinLimit: repetitions.every(r => r.B.longestTaskMs <= LIMIT_MS),
};
const source = name => { const b = fs.readFileSync(path.join(root, 'src', name)); return {bytes: b.length, sha256: createHash('sha256').update(b).digest('hex')}; };
const medianLongestRatio = median(ratios('longestRatio'));

const report = {
  schema: 'boucle-banc-audio-v1',
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0].model,
  loadavg,
  loadavgEnd: os.loadavg(),
  cores: os.cpus().length,
  seconds: Number(process.hrtime.bigint() - started) / 1e9,
  realm: 'main',
  clock: 'process.threadCpuUsage(), user + system, en ms (temps CPU du fil) ; aussi l\'horloge now de FSchedule',
  repetitions: REPS,
  order: 'A puis B aux répétitions 1, 3 et 5 ; B puis A aux répétitions 2 et 4',
  sources: {audio: source('audio.js'), music: source('music.js'), schedule: source('schedule.js')},
  bank: {names: names.length, buffers: jobs.length, motorNames: names.filter(n => n.startsWith('motor:')).length, sampleRate: RATE,
    samples, pcmBytes, pcmSha256, warmupMs, constructions: 1 + 2 * REPS},
  protocol: {
    warmup: 'FAudio.synthesize(nom, variante, 22050) sur chacun des tampons, une fois ; ce PCM sert de référence',
    A: 'lots de 2 noms de FAudio.effectNames, avec toutes leurs variantes (comme warmBank) ; une tranche chronométrée par lot',
    B: "FSchedule.create({now}) ; une tâche « image » par tampon (clé 'pcm:'+nom+':'+variante, priorité 6, coût 2) ; while (S.count('frame')) tranches.push(S.pump(4))",
    pcm: 'sha256 des Float32Array des tampons, dans l\'ordre canonique, comparé à celui de la chauffe pour chaque construction',
  },
  limitMs: LIMIT_MS,
  runs: repetitions,
  medians: {
    A: {slices: spread(col('A', 'slices')), longestMs: spread(col('A', 'longestMs')), totalMs: spread(col('A', 'totalMs'))},
    B: {slices: spread(col('B', 'slices')), longestMs: spread(col('B', 'longestMs')), longestTaskMs: spread(col('B', 'longestTaskMs')),
      totalMs: spread(col('B', 'totalMs')), skipped: spread(col('B', 'skipped'))},
    longestRatio: spread(ratios('longestRatio')),
    longestChangePct: (medianLongestRatio - 1) * 100,
    totalRatio: spread(ratios('totalRatio')),
  },
  heaviest,
  checks,
};
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'banc-audio.json'), JSON.stringify(report, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v, 2) + '\n');

const m = report.medians, f = x => x.toFixed(1), range = (s, g = f) => s.min === s.max ? g(s.min) : g(s.min) + ' à ' + g(s.max);
const hb = heaviest.buffersB[0];
console.log('A (lots de 2 noms) : ' + range(m.A.slices, String) + ' tranches ; plus longue ' + f(m.A.longestMs.median) + ' ms (' + range(m.A.longestMs) + ') ; total ' + f(m.A.totalMs.median) + ' ms');
console.log('B (FSchedule, pump(' + BUDGET + ')) : ' + range(m.B.slices, String) + ' tranches ; plus longue ' + f(m.B.longestMs.median) + ' ms (' + range(m.B.longestMs) +
  ') ; tâche la plus longue ' + f(m.B.longestTaskMs.median) + ' ms (' + hb.name + ', variante ' + hb.variant + ') ; total ' + f(m.B.totalMs.median) + ' ms');
console.log('PCM : ' + jobs.length + ' tampons (' + names.length + ' noms), ' + pcmBytes + ' octets, sha256 ' + pcmSha256.slice(0, 8) + '… ; ' +
  (checks.pcmIdentical ? 'identique' : 'DIFFÉRENT') + ' dans les ' + report.bank.constructions + ' constructions');
const ok = Object.values(checks).every(Boolean);
console.log('bilan : ' + (ok ? 'ok' : 'ÉCART (' + Object.keys(checks).filter(k => !checks[k]).join(', ') + ')') + ' — plus longue tranche ' +
  (report.medians.longestChangePct).toFixed(0) + ' % (médiane de ' + REPS + ' rapports appariés), total x' + m.totalRatio.median.toFixed(2) +
  ' ; seuil ' + LIMIT_MS + ' ms ; charge ' + loadavg.map(x => x.toFixed(2)).join(' / ') + ' ; ' + report.seconds.toFixed(1) + ' s');
if (!ok) process.exit(1);
