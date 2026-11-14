// Lot 11/T2 — LOOP-14 / MIX-08 : preuve par journal des automatisations, domaine principal de Node (jamais node:vm
// en contexte séparé : vm.runInThisContext évalue dans le domaine courant, comme bancs/reste/audio-root.mjs).
// usage : node journal.mjs <racine A> <racine B> <scenes.js> [a,b,c,d,t]
//
// Rejoue les scènes du banc MIX dans l'ordre exact de bancs/mix/mix.js (render) : 120 images de tick, puis par image
// les appels enregistrés, setEnvironment, setMachinery, setSteam, setThreat, setPressure, tick, step ; scène t :
// setMuted(true), start, prepareTitle, setTitlePlaying(true), setMuted(false), puis tick. Les src/audio.js et
// src/music.js de A et de B tournent sur un Web Audio factice qui journalise chaque automatisation : paramètre
// (ordre de création du nœud), type, valeur, instant, constante de temps ; les écritures directes de .value aussi.
//
// Critère, paramètre par paramètre :
//   - « identique » : journal de B = journal de A ;
//   - « dédoublonné » : journal de B = journal de A privé des setTargetAtTime dont la cible et la constante sont
//     celles de l'événement précédent du même paramètre, lui-même un setTargetAtTime. Relancer la même exponentielle
//     ne change pas la courbe (approche sans mémoire), donc ces événements sont les seuls retirables à l'identique ;
//   - sinon : écart, et la preuve échoue.
// A est aussi rejoué deux fois (A = A') pour montrer que le journal est déterministe.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const [rootA, rootB, scenesPath, list = 'a,b,c,d,t'] = process.argv.slice(2);
if (!rootA || !rootB || !scenesPath) throw new Error('usage : node journal.mjs <racine A> <racine B> <scenes.js> [a,b,c,d,t]');
const SR = 48000, HZ = 60, K0 = 120, sha = t => createHash('sha256').update(t).digest('hex');
const holder = {}; vm.runInNewContext(readFileSync(scenesPath, 'utf8'), {window: holder}); // données seulement
const SCENES = {...holder.SCENES, t: {name: 't', stage: 0, env: {}, frames: Array.from({length: 30 * HZ}, () => ({c: [], s: null, f: null})), title: true}};
const read = root => ({audio: readFileSync(root + '/src/audio.js', 'utf8'), music: readFileSync(root + '/src/music.js', 'utf8')});

function fakeAudio(log) {
  const state = {time: 0, nodes: 0, sources: [], starting: false, persistent: new Set()};
  class Param {
    constructor(id, value) { this.id = id; this.v = value; }
    get value() { return this.v; }
    set value(v) { log.push([this.id, 'value', v, state.time]); this.v = v; }
    setValueAtTime(v, t) { log.push([this.id, 'set', v, t]); this.v = v; return this; }
    linearRampToValueAtTime(v, t) { log.push([this.id, 'linear', v, t]); this.v = v; return this; }
    exponentialRampToValueAtTime(v, t) { log.push([this.id, 'exponential', v, t]); this.v = v; return this; }
    setTargetAtTime(v, t, c) { log.push([this.id, 'target', v, t, c]); this.v = v; return this; }
    cancelScheduledValues(t) { log.push([this.id, 'cancel', t]); return this; }
    cancelAndHoldAtTime(t) { log.push([this.id, 'hold', t]); return this; }
  }
  const PARAMS = {gain: {gain: 1}, filter: {frequency: 350, Q: 1, gain: 0, detune: 0}, panner: {pan: 0}, compressor: {threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25},
    shaper: {}, delay: {delayTime: 0}, oscillator: {frequency: 440, detune: 0}, source: {playbackRate: 1, detune: 0}, destination: {}};
  function node(kind) {
    const index = state.nodes++, n = {kind, index, persistent: state.starting, connections: [], connect(t) { n.connections.push(t); return t; }, disconnect() {}, reduction: 0};
    for (const [p, v] of Object.entries(PARAMS[kind])) { n[p] = new Param(index + ':' + kind + '.' + p, v); if (state.starting) state.persistent.add(n[p].id); }
    if (kind === 'source' || kind === 'oscillator') {
      n.startAt = Infinity; n.stopAt = Infinity; n.ended = false; n.buffer = null; n.loop = false; n.onended = null;
      n.start = (t = state.time) => { n.startAt = t; }; n.stop = (t = state.time) => { n.stopAt = Math.min(n.stopAt, t); };
      state.sources.push(n);
    }
    return n;
  }
  class Context {
    constructor() { this.sampleRate = SR; this.state = 'running'; this.destination = node('destination'); }
    get currentTime() { return state.time; }
    createGain() { return node('gain'); } createBiquadFilter() { return node('filter'); } createStereoPanner() { return node('panner'); }
    createDynamicsCompressor() { return node('compressor'); } createWaveShaper() { return node('shaper'); } createDelay() { return node('delay'); }
    createOscillator() { return node('oscillator'); } createBufferSource() { return node('source'); }
    createBuffer(ch, len, sr) { const data = Array.from({length: ch}, () => new Float32Array(len)); return {length: len, duration: len / sr, sampleRate: sr, numberOfChannels: ch, getChannelData: i => data[i], copyToChannel(src, i) { data[i].set(src); }}; }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); }
  }
  // Fin des sources : arrêt demandé ou fin naturelle du tampon (non bouclé), dans l'ordre des instants de fin.
  function advance(time) {
    state.time = time;
    const due = [];
    for (const n of state.sources) {
      if (n.ended || n.startAt === Infinity) continue;
      const natural = n.kind === 'source' && !n.loop && n.buffer ? n.startAt + n.buffer.duration / n.playbackRate.v : Infinity, end = Math.min(n.stopAt, natural);
      if (end <= time) due.push([end, n]);
    }
    due.sort((x, y) => x[0] - y[0] || x[1].index - y[1].index);
    for (const [, n] of due) { n.ended = true; if (typeof n.onended === 'function') n.onended(); }
    state.sources = state.sources.filter(n => !n.ended);
  }
  return {Context, state, advance};
}

function load(src, fake) {
  const timers = [];
  const win = {AudioContext: fake.Context, setTimeout: f => { timers.push(f); return timers.length; }, clearTimeout() {}};
  const wrap = name => vm.runInThisContext('(function(window,globalThis,setTimeout,clearTimeout,FMusic){' + src[name] + '\n})', {filename: name + '.js'});
  wrap('music')(win, win, win.setTimeout, win.clearTimeout, undefined);
  wrap('audio')(win, win, win.setTimeout, win.clearTimeout, win.FMusic);
  // Attend une promesse en exécutant les minuteurs un par un ; setImmediate vide les microtâches entre deux.
  const settle = async promise => {
    let done = false, value; promise.then(v => { done = true; value = v; });
    for (let i = 0; i < 100000 && !done; i++) { await new Promise(r => setImmediate(r)); if (!done && timers.length) timers.shift()(); }
    if (!done) throw new Error('promesse non résolue'); return value;
  };
  return {win, settle};
}

async function replay(src, scene) {
  const log = [], fake = fakeAudio(log), {win, settle} = load(src, fake), N = scene.frames.length, biome = scene.env && scene.env.biome;
  const audio = win.FAudio.create(); if (scene.title) audio.setMuted(true);
  fake.state.starting = true; await settle(audio.start()); fake.state.starting = false;
  audio.setMix({master: 1, music: .45, effects: 1, ambience: 1});
  let titlePrepared = null;
  if (scene.title) { titlePrepared = await settle(audio.prepareTitle()); audio.setTitlePlaying(true); audio.setMuted(false); }
  else { audio.setStage(scene.stage); audio.setEnvironment(scene.env || {}, 0); audio.setMuted(false); audio.setPlaying(true); }
  for (let k = 1; k < K0 + N; k++) {
    fake.advance(Math.ceil(k / HZ * SR / 128) * 128 / SR); // instant de suspend(k / HZ), arrondi au quantum de 128
    const f = k - K0;
    if (f >= 0 && !scene.title) {
      const fr = scene.frames[f];
      for (const [name, o] of fr.c) audio[name](Object.assign({}, o));
      const s = fr.s; audio.setEnvironment(scene.env || {}, s[0]); audio.setMachinery(s[1], s[2], s[3], s[4]); audio.setSteam(s[5], s[6], s[7]); audio.setThreat(s[8]); audio.setPressure(s[9]); audio.tick(1 / HZ);
      if (fr.f) audio.step(fr.f[0], {outdoor: !!fr.f[1], biome});
    } else audio.tick(1 / HZ);
  }
  const stats = {...audio.stats}; audio.dispose();
  return {log, stats, titlePrepared, persistent: fake.state.persistent, automations: log.filter(e => e[1] !== 'value').length};
}

const byParam = log => { const m = new Map(); for (const e of log) { if (!m.has(e[0])) m.set(e[0], []); m.get(e[0]).push(e); } return m; };
const same = (x, y) => x.length === y.length && x.every((e, i) => e.length === y[i].length && e.every((v, j) => Object.is(v, y[i][j])));
function dedup(events) { // retire les setTargetAtTime qui relancent la cible et la constante de l'événement précédent
  const out = []; let prev = null;
  for (const e of events) { if (!(e[1] === 'target' && prev && prev[1] === 'target' && Object.is(prev[2], e[2]) && Object.is(prev[4], e[4]))) out.push(e); prev = e; }
  return out;
}
function compare(A, B) {
  const a = byParam(A.log), b = byParam(B.log), ids = new Set([...a.keys(), ...b.keys()]), deduplicated = [], mismatches = [];
  let identical = 0, removed = 0;
  for (const id of ids) {
    const x = a.get(id) || [], y = b.get(id) || [];
    if (same(x, y)) { identical++; continue; }
    const z = dedup(x);
    const init = (x.find(e => e[1] === 'value') || [])[2];
    if (same(z, y)) { deduplicated.push({param: id, init, persistent: B.persistent.has(id), events: {A: x.length, B: y.length}}); removed += x.length - y.length; }
    else mismatches.push({param: id, A: x.length, B: y.length, Adedup: z.length, firstA: z.find((e, i) => !y[i] || !same([e], [y[i]])), firstB: y.find((e, i) => !z[i] || !same([e], [z[i]]))});
  }
  // Paramètres qui reçoivent cancelScheduledValues (maître, bus musique, voix de la musique) : jamais dédoublonnés.
  const cancelled = [...a.keys()].filter(id => a.get(id).some(e => e[1] === 'cancel')), cancelledIdentical = cancelled.every(id => same(a.get(id), b.get(id) || []));
  return {params: ids.size, identical, deduplicated, removed, mismatches, cancelled: cancelled.length, cancelledIdentical};
}

const srcA = read(rootA), srcB = read(rootB), out = {sources: {A: {root: rootA, audioSha256: sha(srcA.audio), musicSha256: sha(srcA.music)}, B: {root: rootB, audioSha256: sha(srcB.audio), musicSha256: sha(srcB.music)}}, criterion: 'B = A, ou B = A privé des setTargetAtTime répétant cible et constante de l’événement précédent du même paramètre', scenes: []};
let pass = true;
for (const name of list.split(',')) {
  const scene = SCENES[name]; if (!scene) throw new Error('scène inconnue : ' + name);
  const A = await replay(srcA, scene), A2 = await replay(srcA, scene), B = await replay(srcB, scene);
  const det = compare(A, A2), cmp = compare(A, B), ok = !det.mismatches.length && !det.deduplicated.length && !cmp.mismatches.length && cmp.cancelledIdentical && cmp.deduplicated.every(d => d.persistent);
  pass &&= ok;
  out.scenes.push({scene: name, frames: K0 + scene.frames.length - 1, deterministic: !det.mismatches.length && !det.deduplicated.length, automations: {A: A.automations, B: B.automations, removed: cmp.removed, perFrameA: +(A.automations / (K0 + scene.frames.length - 1)).toFixed(2), perFrameB: +(B.automations / (K0 + scene.frames.length - 1)).toFixed(2)},
    params: cmp.params, identicalParams: cmp.identical, cancelledParams: cmp.cancelled, cancelledIdentical: cmp.cancelledIdentical, deduplicatedParams: cmp.deduplicated, mismatches: cmp.mismatches.slice(0, 5), mismatchCount: cmp.mismatches.length,
    statsEqual: JSON.stringify(A.stats) === JSON.stringify(B.stats), titlePrepared: B.titlePrepared, pass: ok});
}
out.pass = pass;
console.log(JSON.stringify(out, null, 1));
process.exit(pass ? 0 : 1);
