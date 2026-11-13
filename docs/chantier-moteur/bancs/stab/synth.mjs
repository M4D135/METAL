// STAB — coût de synthèse PCM de chaque son (fil principal), domaine principal, temps CPU du fil.
// node synth.mjs <racine METAL>
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root = process.argv[2]; globalThis.window = globalThis;
for (const n of ['music', 'audio']) vm.runInThisContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), {filename: n + '.js'});
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const names = FAudio.effectNames, rows = [];
for (const name of names) { const variants = name.startsWith('motor:') ? 1 : 2; let first = 0, warm = 0, samples = 0;
  for (let v = 0; v < variants; v++) { let a = cpu(); const d = FAudio.synthesize(name, v, 22050); first += cpu() - a; samples += d.length; let best = Infinity; for (let r = 0; r < 3; r++) { a = cpu(); FAudio.synthesize(name, v, 22050); best = Math.min(best, cpu() - a); } warm += best; }
  rows.push({name, variants, first: +first.toFixed(2), warm: +warm.toFixed(2), kSamples: Math.round(samples / 1000)}); }
rows.sort((a, b) => b.warm - a.warm);
const total = rows.reduce((a, r) => a + r.warm, 0), totalFirst = rows.reduce((a, r) => a + r.first, 0);
// lots de warmBank : 2 noms par minuterie, dans l'ordre de effectNames
const byName = new Map(rows.map(r => [r.name, r])); const batches = []; for (let i = 0; i < names.length; i += 2) batches.push(+(byName.get(names[i]).warm + (names[i + 1] ? byName.get(names[i + 1]).warm : 0)).toFixed(1));
console.log(JSON.stringify({effects: names.length, buffers: rows.reduce((a, r) => a + r.variants, 0), totalWarmMs: +total.toFixed(0), totalFirstMs: +totalFirst.toFixed(0), maxEffectMs: rows[0].warm, maxBatchMs: Math.max(...batches), batchesOver8ms: batches.filter(v => v > 8).length, batchesOver16ms: batches.filter(v => v > 16.7).length, nBatches: batches.length, top: rows.slice(0, 8), smallest: rows.slice(-3)}));
// musique : étapes de FMusic.warmup (instrument i, tension, moduleFor) — durée de chaque tâche entre deux minuteries
const real = globalThis.setTimeout; const slices = []; let mark = cpu();
globalThis.setTimeout = (fn, ms) => real(() => { mark = cpu(); fn(); slices.push(cpu() - mark); }, ms);
for (const stage of [0, 1, 2]) { slices.length = 0; const a = cpu(); await FMusic.warmup(stage); await new Promise(r => real(r, 5)); console.log(JSON.stringify({musicStage: stage, tasks: slices.length, taskMs: slices.map(v => +v.toFixed(1)), maxTaskMs: +Math.max(0, ...slices).toFixed(1)})); }
process.exit(0);
