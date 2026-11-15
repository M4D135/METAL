// MUS-01 — coût processeur de la musique : séquenceur adaptatif, ordonnancement
// des notes et synthèse du module. Mesures dans le domaine principal de Node
// (jamais en node:vm), en comparaison appariée et alternée A,B,A,B…
//
// Lancer avec : node tools/music-cost.mjs [<racineA>] [<racineB>] [--reps 7] [--out fichier.json]
// Sans seconde racine, l'outil mesure la racine courante seule (chiffre de départ).
// Trois mesures par passage et par morceau :
//   tickUs   — microsecondes par image pour music.tick() (ordonnancement des notes) ;
//   barUs    — microsecondes par mesure pour le séquenceur adaptatif (FImuse.nextBar) ;
//   synthMs  — millisecondes de synthèse d'un module, et plus grosse tranche entre
//              deux rendus (le budget des tâches de préparation du lot 11 est de 8 ms).
import {writeFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {loadRealm} from './realm-loader.mjs';

const args = process.argv.slice(2), roots = [], opt = {reps: 7, out: null, seconds: 60, frame: 1 / 60};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--reps') opt.reps = +args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--seconds') opt.seconds = +args[++i];
  else roots.push(resolve(a));
}
if (!roots.length) roots.push(process.cwd());
const STAGES = [0, 1, 2, 'title'];

class Param {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  cancelScheduledValues() {}
}
function node(kind) { return {kind, connect() {}, disconnect() {}, start() {}, stop() {}}; }
// Les sources actives sont tenues dans un Set : une liste qui ne fait que
// croître transformerait la mesure en mesure du banc lui-même.
class Context {
  constructor() { this.currentTime = 0; this.state = 'running'; this.created = 0; this.live = new Set(); }
  createGain() { const n = node('gain'); n.gain = new Param(1); return n; }
  createStereoPanner() { const n = node('pan'); n.pan = new Param(); return n; }
  createBuffer(ch, length, rate) { const data = new Float32Array(length); return {duration: length / rate, sampleRate: rate, length, getChannelData: () => data}; }
  createBufferSource() {
    const n = node('source'); n.playbackRate = new Param(1); n.startTime = Infinity; n.stopTime = Infinity; n.ended = false;
    n.start = t => { n.startTime = t; }; n.stop = t => { n.stopTime = t; }; this.created++; this.live.add(n); return n;
  }
  advance(s) {
    this.currentTime += s;
    for (const n of this.live) if (Math.min(n.stopTime, n.startTime + (n.buffer?.duration || 0) / n.playbackRate.value) <= this.currentTime) { n.ended = true; this.live.delete(n); n.onended?.(); }
  }
  close() {}
}

function realm(root, globals = {}) {
  const modules = ['music'];
  if (existsSync(join(root, 'src', 'imuse.js'))) modules.push('imuse');
  const v = loadRealm({root, modules, globals});
  return v.window;
}

// Le séquenceur est mesuré seul : même scénario de demandes, même nombre de
// mesures, aucun nœud audio. C'est le coût pur du décideur iMUSE.
function directorCost(W) {
  if (!W.FImuse) return {barUs: null, bars: 0, switches: 0, transitions: 0, absent: true};
  const cues = {
    calm: {bpm: 76, layerMin: {drums: 0, bass: 0, rhythm: .2, lead: .55, announce: .8}, entry: 'a', order: ['a', 'b'],
      segments: {a: {bars: 4, layers: ['bass', 'rhythm', 'lead', 'announce']}, b: {bars: 4, layers: ['bass', 'rhythm', 'lead', 'announce']}, t: {bars: 1, layers: ['drums']}, r: {bars: 2, layers: ['drums', 'announce']}},
      transitions: [{from: '*', to: 'combat', kind: 'roll', segment: 'r', bars: 2}, {from: '*', to: '*', kind: 'fill', segment: 't', bars: 1}]},
    combat: {bpm: 208, layerMin: {drums: 0, bass: 0, rhythm: .2, lead: .55, announce: .8}, entry: 'a', order: ['a', 'b', 'c'],
      segments: {a: {bars: 4, layers: ['drums', 'bass', 'rhythm', 'lead']}, b: {bars: 4, layers: ['drums', 'bass', 'rhythm']}, c: {bars: 2, layers: ['drums', 'bass', 'rhythm', 'lead', 'announce']}, t: {bars: 1, layers: ['drums']}, r: {bars: 2, layers: ['drums', 'announce']}},
      transitions: [{from: '*', to: 'boss', kind: 'roll', segment: 'r', bars: 2}, {from: '*', to: '*', kind: 'fill', segment: 't', bars: 1}]},
    boss: {bpm: 150, layerMin: {drums: 0, bass: 0, rhythm: .2, lead: .55, announce: .8}, entry: 'a', order: ['a', 'b'],
      segments: {a: {bars: 4, layers: ['drums', 'bass', 'rhythm', 'lead', 'announce']}, b: {bars: 4, layers: ['drums', 'bass', 'rhythm']}, t: {bars: 1, layers: ['drums']}, r: {bars: 2, layers: ['drums', 'announce']}},
      transitions: [{from: '*', to: '*', kind: 'fill', segment: 't', bars: 1}]}
  };
  const d = W.FImuse.create({cues, cue: 'calm'});
  const bars = Math.round(opt.seconds * 2);           // deux mesures par seconde en moyenne
  let t0 = performance.now();
  for (let i = 0; i < bars; i++) {
    if (i % 97 === 0) d.setIntensity((i % 7) / 6);
    if (i % 61 === 0) d.request(['calm', 'combat', 'boss'][i % 3], {key: 'e' + (i % 61)});
    d.nextBar();
  }
  const us = (performance.now() - t0) * 1000 / bars;
  return {barUs: +us.toFixed(4), bars, switches: d.stats.switches, transitions: d.stats.transitions};
}

function tickCost(W, stage) {
  const ctx = new Context(), music = W.FMusic.create(ctx, ctx.createGain());
  music.setStage(stage); music.setVolume(1); music.setPlaying(true);
  const frames = Math.round(opt.seconds / opt.frame);
  for (let f = 0; f < frames / 4; f++) { music.tick(); ctx.advance(opt.frame); }   // chauffe
  const before = music.stats.scheduledNotes;
  let elapsed = 0;
  for (let f = 0; f < frames; f++) { const t0 = performance.now(); music.tick(); elapsed += performance.now() - t0; ctx.advance(opt.frame); }
  const us = elapsed * 1000 / frames;
  const s = music.stats;
  const out = {tickUs: +us.toFixed(3), frames, notes: s.scheduledNotes - before, rows: s.scheduledRows, peakVoices: s.peakVoices, resyncs: s.resyncs};
  music.dispose();
  return out;
}

// Synthèse : le coût d'un module complet et la plus grosse tranche synchrone.
// warmup() rend la main entre les instruments ; on chronomètre ses tranches.
async function synthCost(root, stage) {
  const slices = [];
  let mark = performance.now();
  const W = realm(root, {setTimeout: fn => { slices.push(performance.now() - mark); mark = performance.now(); return globalThis.setTimeout(fn, 0); }});
  const t0 = performance.now();
  const info = await W.FMusic.warmup(stage);
  const total = performance.now() - t0;
  slices.push(performance.now() - mark);
  return {synthMs: +total.toFixed(2), slices: slices.length, maxSliceMs: +Math.max(...slices).toFixed(2), over8: slices.filter(v => v > 8).length, moduleBytes: info?.bytes || 0};
}

async function pass(root) {
  const W = realm(root);
  const out = {director: directorCost(W)};
  for (const stage of STAGES) out['stage' + stage] = tickCost(realm(root), stage);
  for (const stage of STAGES) out['synth' + stage] = await synthCost(root, stage);
  return out;
}

const runs = {};
for (const root of roots) runs[root] = [];
for (let r = 0; r < opt.reps; r++) {
  const order = r % 2 ? roots.slice().reverse() : roots;
  for (const root of order) runs[root].push(await pass(root));
}
const median = list => { const s = [...list].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = {};
for (const root of roots) {
  summary[root] = {barUs: median(runs[root].map(x => x.director.barUs))};
  for (const stage of STAGES) {
    const key = 'stage' + stage, synth = 'synth' + stage;
    summary[root]['tickUs_' + key] = median(runs[root].map(x => x[key].tickUs));
    summary[root]['synth_' + key] = {
      ms: median(runs[root].map(x => x[synth].synthMs)),
      maxSlice: median(runs[root].map(x => x[synth].maxSliceMs)),
      over8: median(runs[root].map(x => x[synth].over8)),
      moduleBytes: runs[root][0][synth].moduleBytes
    };
  }
  summary[root].notesStage1 = runs[root][0].stage1.notes;
  summary[root].peakVoicesStage1 = runs[root][0].stage1.peakVoices;
}
const report = {schema: 'metal-music-cost-v1', node: process.version, reps: opt.reps, seconds: opt.seconds, frameMs: +(opt.frame * 1000).toFixed(4), runs, summary};
if (opt.out) writeFileSync(opt.out, JSON.stringify(report, null, 1));
console.log(JSON.stringify({reps: opt.reps, summary}, null, 1));
