// Audio preparation cost (pure PCM/score work, no device): FMusic.warmup slices per stage and FAudio FX bank batches.
// Each "slice" is the synchronous work between two setTimeout(0) yields, i.e. what blocks one browser task.
// usage: node music.mjs <ferroRoot>
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root = process.argv[2];
const now = () => performance.now();
let sliceStart = 0; const slices = [];
const ctx = {window: {}, performance, console, Math, Date};
ctx.window.setTimeout = (fn, ms) => { slices.push(now() - sliceStart); return setTimeout(() => { sliceStart = now(); fn(); }, ms || 0); };
vm.createContext(ctx);
for (const n of ['music', 'audio']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
const W = ctx.window, out = {};
for (const stage of [0, 1, 2]) {
  slices.length = 0; sliceStart = now(); const t0 = now();
  const info = await W.FMusic.warmup(stage); slices.push(now() - sliceStart);
  out['warmup' + stage] = {totalMs: +(now() - t0).toFixed(1), slices: slices.length, maxSliceMs: +Math.max(...slices).toFixed(1), lastSliceMs: +slices.at(-1).toFixed(1), slicesMs: slices.map(v => +v.toFixed(1)), moduleBytes: info.bytes};
}
let t = now(); W.FMusic.getModule(0); out.getModuleMs = +(now() - t).toFixed(2);
// FX bank: warmBank builds 2 effect names per task, 1 or 2 variants each, 22050 Hz.
const names = W.FAudio.effectNames, perName = [];
for (const name of names) { t = now(); let bytes = 0; const variants = name.indexOf('motor:') === 0 ? 1 : 2; for (let v = 0; v < variants; v++) bytes += W.FAudio.synthesize(name, v, 22050).byteLength; perName.push({name, ms: +(now() - t).toFixed(1), kb: Math.round(bytes / 1024)}); }
const batches = []; for (let i = 0; i < perName.length; i += 2) batches.push(+(perName[i].ms + (perName[i + 1]?.ms || 0)).toFixed(1));
out.fxBank = {names: names.length, totalMs: +perName.reduce((n, q) => n + q.ms, 0).toFixed(1), maxBatchMs: Math.max(...batches), batchesMs: batches, totalKB: perName.reduce((n, q) => n + q.kb, 0), perName};
console.log(JSON.stringify(out));
