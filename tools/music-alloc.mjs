// RESTE-09 — allocations de FMusic.tick, mesurées dans le domaine principal de Node.
// Lancer avec : node --expose-gc --max-semi-space-size=128 tools/music-alloc.mjs <racine> [reps] [--cur-only]
// Deux racines en argument = comparaison appariée alternée A,B,A,B… dans le même processus.
// Une minute de musique à 25 images/s est rejouée par passage ; le tas est vidé avant, puis
// relevé sans ramasse-miettes après : ce qui reste compte les objets produits par tick().
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadRealm} from './realm-loader.mjs';

const args = process.argv.slice(2), roots = [], opt = {reps: 5, out: null, curOnly: false};
for (let i = 0; i < args.length; i++) { const a = args[i];
  if (a === '--reps') opt.reps = +args[++i]; else if (a === '--out') opt.out = args[++i]; else if (a === '--cur-only') opt.curOnly = true; else roots.push(resolve(a)); }
if (!roots.length) roots.push(process.cwd());
if (typeof globalThis.gc !== 'function') throw new Error('lancer avec --expose-gc');

const FRAME = .04, SECONDS = 60;
class Param { constructor(v = 0) { this.value = v; } setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } exponentialRampToValueAtTime(v) { this.value = v; } setTargetAtTime(v) { this.value = v; } cancelScheduledValues() {} }
function node(kind) { return {kind, connections: [], connect() {}, disconnect() {}, start() {}, stop() {}}; }
class Context {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sources = []; }
  createGain() { const n = node('gain'); n.gain = new Param(1); return n; }
  createStereoPanner() { const n = node('pan'); n.pan = new Param(); return n; }
  createBuffer(ch, length, rate) { const data = new Float32Array(length); return {duration: length / rate, sampleRate: rate, length, getChannelData: () => data}; }
  createBufferSource() { const n = node('source'); n.playbackRate = new Param(1); n.startTime = Infinity; n.stopTime = Infinity; n.ended = false;
    n.start = t => { n.startTime = t; }; n.stop = t => { n.stopTime = t; }; this.sources.push(n); return n; }
  advance(s) { this.currentTime += s; for (const n of this.sources) if (!n.ended && Math.min(n.stopTime, n.startTime + (n.buffer?.duration || 0) / n.playbackRate.value) <= this.currentTime) { n.ended = true; n.onended?.(); } }
  close() {}
}
function realm(root) {
  const v = loadRealm({root, modules: ['music'], globals: {}});
  return v.window.FMusic;
}
function sessionOf(FMusic, stage) {
  const ctx = new Context(), output = ctx.createGain(), music = FMusic.create(ctx, output);
  music.setStage(stage); music.setVolume(1); music.setPlaying(true);
  return {ctx, music};
}
function frames(session) { for (let f = 0; f < SECONDS / FRAME; f++) { session.music.tick(); session.ctx.advance(FRAME); } }
function measure(FMusic, stage) {
  // Une seule et même instance, chauffée avant la mesure : les tampons d'instruments
  // sont en cache, le tas ne compte plus que ce que produit tick() lui-même.
  const session = sessionOf(FMusic, stage);
  frames(session); frames(session);
  globalThis.gc(); globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  frames(session);
  const mo = (process.memoryUsage().heapUsed - before) / 1048576;
  const notes = session.music.stats.scheduledNotes, rows = session.music.stats.scheduledRows;
  session.music.dispose?.();
  return {notes, rows, moPerMinute: +mo.toFixed(3)};
}
const report = {schema: 'metal-music-alloc-v1', node: process.version, frameMs: FRAME * 1000, seconds: SECONDS, reps: opt.reps, runs: {}, summary: {}};
for (const root of roots) report.runs[root] = [];
for (let r = 0; r < opt.reps; r++) { const order = r % 2 ? roots.slice().reverse() : roots;
  for (const root of order) { const FM = realm(root); report.runs[root].push({stage0: measure(FM, 0), stage1: measure(FM, 1), title: measure(FM, 'title')}); } }
for (const root of roots) {
  const runs = report.runs[root], q = list => { const s = [...list].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(3); };
  report.summary[root] = {moPerMinuteStage0: q(runs.map(x => x.stage0.moPerMinute)), moPerMinuteStage1: q(runs.map(x => x.stage1.moPerMinute)),
    moPerMinuteTitle: q(runs.map(x => x.title.moPerMinute)), notesStage0: runs[0].stage0.notes, notesStage1: runs[0].stage1.notes,
    rowsStage0: runs[0].stage0.rows, rowsStage1: runs[0].stage1.rows};
}
const text = JSON.stringify(report, null, 1);
if (opt.out) writeFileSync(opt.out, text + '\n'); else console.log(text);
console.error(JSON.stringify(report.summary, null, 1));
