// Lot 11/T2 : coût JS par image de l'audio (séquence de game.js:813-817), A contre B, domaine principal de Node,
// rondes alternées dans un même processus, médianes. Web Audio factice qui compte (appels bon marché : sous-estime
// le coût réel d'un appel AudioParam du navigateur). usage : node pair.mjs <racine A> <racine B> [rondes] [images]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const [rootA, rootB, roundsArg = '9', framesArg = '3600'] = process.argv.slice(2), ROUNDS = +roundsArg, N = +framesArg;
function instance(root) {
  const C = {param: 0}; let clock = 0;
  class Param { constructor() { this.value = 0; } setTargetAtTime() { C.param++; return this; } setValueAtTime() { C.param++; return this; } linearRampToValueAtTime() { C.param++; return this; } exponentialRampToValueAtTime() { C.param++; return this; } cancelScheduledValues() { C.param++; return this; } }
  class Node { constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.pan = new Param(); this.playbackRate = new Param(); this.delayTime = new Param(); this.threshold = new Param(); this.knee = new Param(); this.ratio = new Param(); this.attack = new Param(); this.release = new Param(); this.onended = null; this.buffer = null; this.loop = false; } connect() { return this; } disconnect() {} start() {} stop() {} }
  class Ctx { constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = new Node(); } get currentTime() { return clock; }
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); } createStereoPanner() { return new Node(); } createDynamicsCompressor() { return new Node(); } createWaveShaper() { return new Node(); } createDelay() { return new Node(); } createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
    createBuffer(ch, len, sr) { const d = Array.from({length: ch}, () => new Float32Array(len)); return {length: len, duration: len / sr, sampleRate: sr, numberOfChannels: ch, getChannelData: i => d[i], copyToChannel(s, i) { d[i].set(s); }}; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  const win = {AudioContext: Ctx, setTimeout: f => { f(); return 0; }, clearTimeout() {}};
  for (const n of ['music', 'audio']) vm.runInThisContext('(function(window,globalThis,setTimeout,clearTimeout,FMusic){' + readFileSync(root + '/src/' + n + '.js', 'utf8') + '\n})', {filename: root + '/' + n + '.js'})(win, win, win.setTimeout, win.clearTimeout, win.FMusic);
  const audio = win.FAudio.create(); audio.start(); audio.setMuted(false); audio.setPlaying(true); audio.setMix({master: 1, music: .45, effects: 1, ambience: 1}); audio.setStage(1); audio.setPlaying(true);
  let i = 0;
  const frame = () => { clock += 1 / 60; i++; audio.setEnvironment({biome: 'woodland', wind: 1}, .6); audio.setMachinery(.5 + .2 * Math.sin(i / 90), -.3 + .3 * Math.sin(i / 70), 'fan', .2); audio.setSteam(.3 + .2 * Math.sin(i / 50), .2, 0); audio.setThreat(.3 + .3 * Math.sin(i / 200)); audio.setPressure(.4); audio.tick(1 / 60); };
  return {C, frame};
}
const X = {A: instance(rootA), B: instance(rootB)}, times = {A: [], B: []}, calls = {A: [], B: []};
for (const k of ['A', 'B']) for (let j = 0; j < 600; j++) X[k].frame();
for (let r = 0; r < ROUNDS; r++) for (const k of (r % 2 ? ['B', 'A'] : ['A', 'B'])) {
  const p0 = X[k].C.param, t0 = performance.now(); for (let j = 0; j < N; j++) X[k].frame(); const dt = performance.now() - t0;
  times[k].push(dt / N * 1000); calls[k].push((X[k].C.param - p0) / N);
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
console.log(JSON.stringify({rounds: ROUNDS, framesPerRound: N, usPerFrame: {A: +med(times.A).toFixed(3), B: +med(times.B).toFixed(3)}, callsPerFrame: {A: +med(calls.A).toFixed(2), B: +med(calls.B).toFixed(2)}, rawUs: {A: times.A.map(v => +v.toFixed(3)), B: times.B.map(v => +v.toFixed(3))}}));
