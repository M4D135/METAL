// LOAD-13 / MIX-09 — préparation audio mesurée dans le domaine principal de Node (pas de node:vm).
// Tranches réelles de FAudio.prepare(stage) et FMusic.warmup('title') : chaque tâche du minuteur et toutes
// ses microtâches forment une tranche (ce qu'un navigateur exécute d'un bloc). Contexte Web Audio factice.
// Empreintes sha256 des 64 tampons d'effets et des modules : identité avant/après, ordre direct/inverse,
// et identité du chemin découpé (tampons et module construits par prepare/warmup) avec la construction directe.
// usage : node tools/audio-prep-profile.mjs <racineA> [racineB] [--reps 5] [--stage 0] [--out f.json]
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadRealm} from './realm-loader.mjs';

const args = process.argv.slice(2), opt = {reps: 5, stage: 0, out: null}, roots = [];
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a === '--reps') opt.reps = +args[++i]; else if (a === '--stage') opt.stage = +args[++i]; else if (a === '--out') opt.out = args[++i]; else roots.push(resolve(a)); }
if (!roots.length) roots.push(process.cwd());
if (!(opt.reps >= 1) || ![0, 1, 2].includes(opt.stage)) throw new Error('--reps >= 1 et --stage 0, 1 ou 2');
const BANK_RATE = 22050;
const now = () => performance.now(), sha = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const shaText = t => createHash('sha256').update(t).digest('hex'), multiset = list => shaText([...list].sort().join(''));
const idle = () => new Promise(r => setImmediate(r));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

class Param { constructor(v = 0) { this.value = v; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} }
function node(kind) { return {kind, gain: new Param(1), frequency: new Param(), Q: new Param(), pan: new Param(), playbackRate: new Param(1), delayTime: new Param(), threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect() {}, disconnect() {}, start() {}, stop() {}}; }
class FakeContext {
  constructor() { this.state = 'running'; this.sampleRate = 48000; this.currentTime = 0; this.destination = node('destination'); this.created = []; }
  createGain() { return node('gain'); } createBiquadFilter() { return node('filter'); } createStereoPanner() { return node('pan'); }
  createDynamicsCompressor() { return node('limiter'); } createWaveShaper() { return node('guard'); } createDelay() { return node('delay'); }
  createOscillator() { return node('osc'); } createBufferSource() { return node('source'); }
  createBuffer(ch, len, sr) { const data = Array.from({length: ch}, () => new Float32Array(len)); this.created.push({sampleRate: sr, data}); return {length: len, duration: len / sr, sampleRate: sr, numberOfChannels: ch, getChannelData: i => data[i]}; }
  resume() { this.state = 'running'; return Promise.resolve(); } close() { return Promise.resolve(); }
}
// Minuteur factice : file FIFO pompée par le banc ; une tranche = rappel + microtâches.
function realm(root) {
  const queue = [], contexts = [];
  class Context extends FakeContext { constructor() { super(); contexts.push(this); } }
  const v = loadRealm({root, modules: ['music', 'audio'], globals: {setTimeout: fn => { queue.push(fn); return queue.length; }, clearTimeout: () => {}, AudioContext: Context, performance}});
  return {W: v.window, queue, contexts, sourceSha256: v.sourceSha256};
}
async function pump(R, first) {
  const slices = []; let t = now(); const p = first(); await idle(); slices.push(now() - t);
  while (R.queue.length) { const fn = R.queue.shift(); t = now(); fn(); await idle(); slices.push(now() - t); }
  const value = await p; return {slices, value};
}
async function prepareRun(root, stage) {
  const R = realm(root), audio = R.W.FAudio.create(); await audio.start();
  const t0 = now(), run = await pump(R, () => audio.prepare(stage)), total = now() - t0;
  const R2 = realm(root), t1 = now(), title = await pump(R2, () => R2.W.FMusic.warmup('title')), titleTotal = now() - t1;
  // Hors chronométrage : ce que le chemin découpé a réellement construit (tampons à 22 050 Hz, modules en cache).
  const bank = R.contexts.flatMap(c => c.created).filter(b => b.sampleRate === BANK_RATE).map(b => sha(b.data[0]));
  const prepared = {bankBuffers: bank.length, bankMultisetSha256: multiset(bank), moduleSha256: sha(R.W.FMusic.getModule(stage)), titleModuleSha256: sha(R2.W.FMusic.getModule('title'))};
  audio.dispose();
  return {ok: run.value === true, slices: run.slices.length, maxSliceMs: Math.max(...run.slices), totalMs: total, over8: run.slices.filter(s => s > 8).length,
    titleSlices: title.slices.length, titleMaxSliceMs: Math.max(...title.slices), titleTotalMs: titleTotal, sliceList: run.slices.map(s => +s.toFixed(2)), prepared};
}
function jobs(W) { const out = []; for (const n of W.FAudio.effectNames) for (let k = 0; k < (n.startsWith('motor:') ? 1 : 2); k++) out.push([n, k]); return out; }
function fingerprints(root) {
  // MIX-09 : deux constructions dans le même processus, ordre direct puis inverse (une variante par tâche).
  const A = realm(root).W, B = realm(root).W, list = jobs(A), fwd = new Map(), perJob = [];
  for (const [n, k] of list) { const t = now(), pcm = A.FAudio.synthesize(n, k, BANK_RATE); perJob.push({name: n, variant: k, ms: now() - t}); fwd.set(n + '#' + k, sha(pcm)); }
  let different = 0; for (const [n, k] of list.slice().reverse()) if (fwd.get(n + '#' + k) !== sha(B.FAudio.synthesize(n, k, BANK_RATE))) different++;
  const stages = [0, 1, 2, 'title'], modA = stages.map(s => sha(A.FMusic.getModule(s))), modB = stages.slice().reverse().map(s => [s, sha(B.FMusic.getModule(s))]).reverse().map(x => x[1]);
  return {buffers: list.length, buffersDifferent: different, modulesIdentical: modA.every((h, i) => h === modB[i]), bankSha256: shaText([...fwd.values()].join('')), bankMultisetSha256: multiset(fwd.values()), moduleSha256: Object.fromEntries(stages.map((s, i) => [s, modA[i]])), perJob};
}
const report = {schema: 'metal-audio-prep-v1', node: process.version, roots, reps: opt.reps, stage: opt.stage, runs: {}, summary: {}, identity: {}};
for (const root of roots) report.runs[root] = [];
for (let r = 0; r < opt.reps; r++) { const order = r % 2 ? roots.slice().reverse() : roots; for (const root of order) report.runs[root].push(await prepareRun(root, opt.stage)); }
for (const root of roots) {
  const runs = report.runs[root], f = fingerprints(root), heavy = [...f.perJob].sort((a, b) => b.ms - a.ms).slice(0, 6).map(j => j.name + '#' + j.variant + ' ' + j.ms.toFixed(1) + ' ms');
  const prepareMatchesDirect = {bank: runs.every(x => x.prepared.bankBuffers === f.buffers && x.prepared.bankMultisetSha256 === f.bankMultisetSha256),
    module: runs.every(x => x.prepared.moduleSha256 === f.moduleSha256[opt.stage]), titleModule: runs.every(x => x.prepared.titleModuleSha256 === f.moduleSha256.title)};
  report.identity[root] = {buffers: f.buffers, buffersDifferent: f.buffersDifferent, modulesIdentical: f.modulesIdentical, prepareMatchesDirect, bankSha256: f.bankSha256, moduleSha256: f.moduleSha256};
  report.summary[root] = {ok: runs.every(x => x.ok), medianMaxSliceMs: +q(runs.map(x => x.maxSliceMs), .5).toFixed(2), medianTotalMs: +q(runs.map(x => x.totalMs), .5).toFixed(1), medianSlices: q(runs.map(x => x.slices), .5), medianOver8: q(runs.map(x => x.over8), .5),
    medianTitleMaxSliceMs: +q(runs.map(x => x.titleMaxSliceMs), .5).toFixed(2), medianTitleTotalMs: +q(runs.map(x => x.titleTotalMs), .5).toFixed(1), synthTotalMs: +f.perJob.reduce((s, j) => s + j.ms, 0).toFixed(1), heaviestJobs: heavy};
}
if (roots.length === 2) { const [a, b] = roots; report.identity.sameBankAB = report.identity[a].bankSha256 === report.identity[b].bankSha256; report.identity.sameModulesAB = JSON.stringify(report.identity[a].moduleSha256) === JSON.stringify(report.identity[b].moduleSha256); }
const text = JSON.stringify(report, null, 1);
if (opt.out) writeFileSync(opt.out, text + '\n'); else console.log(text);
console.error(JSON.stringify({summary: report.summary, identity: Object.fromEntries(Object.entries(report.identity).map(([k, v]) => [k, typeof v === 'object' ? {buffersDifferent: v.buffersDifferent, modulesIdentical: v.modulesIdentical, prepareMatchesDirect: v.prepareMatchesDirect, bank: v.bankSha256?.slice(0, 12)} : v]))}, null, 1));
