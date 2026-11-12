// STAB — gouverneur de qualité : le gouverneur ACTUEL (code extrait de renderer.js:746-764) contre un prototype piloté
// par le temps de travail mesuré (CPU + GPU), avec hystérésis prédictive et mise à l'échelle par viewport (sans réallocation).
// Modèle d'image : travail W = cpu + gpu·(a + b·s²) ; présentation au vsync : intervalle = ceil(W/P)·P.
// node governor.mjs <racine METAL>
import {readFileSync} from 'node:fs';
const root = process.argv[2], lines = readFileSync(root + '/src/renderer.js', 'utf8').split('\n');
if (!lines[745].includes('function resolutionGovernor(){')) throw new Error('renderer.js:746 a changé');
const currentGovernor = new Function(lines.slice(745, 764).join('\n') + '\nreturn resolutionGovernor;')();
function proposedGovernor() {
  // Entrée : temps de travail mesuré de l'image (ms) et période d'affichage détectée (ms). Sortie : échelle 0,6..1 par pas de 1/20.
  let scale = 1, ewma = 0, over = 0, under = 0, hold = 1, a = .3, b = .7; // modèle W(s) ≈ W1·(a + b·s²), b ajusté en ligne
  return {reset() { scale = 1; ewma = over = under = 0; hold = 1; },
    update(workMs, periodMs, dt) {
      ewma = ewma ? ewma + (workMs - ewma) * (1 - Math.exp(-dt / .25)) : workMs; hold = Math.max(0, hold - dt);
      const budget = .85 * periodMs; over = ewma > .95 * periodMs ? over + dt : 0; under = ewma < .72 * periodMs ? under + dt : 0;
      if (hold > 0) return scale;
      const at = s => a + b * s * s, predict = s => ewma * at(s) / at(scale);
      if (over > .3 && scale > .6) { let s = scale; while (s > .6 && predict(s) > budget) s = Math.round((s - .05) * 20) / 20; if (s !== scale) { scale = s; hold = 1; over = under = 0; } }
      else if (under > 2 && scale < 1) { const s = Math.round((scale + .05) * 20) / 20; if (predict(s) < .8 * periodMs) { scale = s; hold = 1.5; } over = under = 0; }
      return scale;
    }};
}
function run(kind, {hz, load, seconds = 60, gpuShare = .7, fill = .8, seed = 7}) {
  const P = 1000 / hz, gov = kind === 'actuel' ? currentGovernor() : proposedGovernor(); let t = 0, scale = 1, changes = 0, late = 0, frames = 0, sumScale = 0, hitches = 0, flips = 0, lastDir = 0, r = seed, minScale = 1;
  const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296; let lastInterval = P;
  while (t < seconds * 1000) {
    const w1 = load(t / 1000) * (1 + (rnd() - .5) * .08), cpu = w1 * (1 - gpuShare), gpu = w1 * gpuShare * ((1 - fill) + fill * scale * scale);
    let next;
    if (kind === 'actuel') next = gov.update({adaptive: true, frameMs: lastInterval}, 'auto'); else next = gov.update(cpu + gpu, P, lastInterval / 1000);
    let work = cpu + gpu;
    if (next !== scale) { changes++; const dir = Math.sign(next - scale); if (lastDir && dir !== lastDir) flips++; lastDir = dir; scale = next; minScale = Math.min(minScale, scale); if (kind === 'actuel') { work += 8; hitches++; } } // réallocation mesurée dans Chrome : +6 à +12 ms
    const interval = Math.max(1, Math.ceil(work / P - 1e-9)) * P; if (interval > P + 1e-6) late++; frames++; sumScale += scale; t += interval; lastInterval = interval;
  }
  return {gouverneur: kind, changesPerMin: +(changes * 60 / seconds).toFixed(1), reversalsPerMin: +(flips * 60 / seconds).toFixed(1), reallocHitchesPerMin: +(hitches * 60 / seconds).toFixed(1), lateFramesPct: +(100 * late / frames).toFixed(1), fps: +(frames / seconds).toFixed(1), meanScale: +(sumScale / frames).toFixed(3), minScale};
}
const S = [
  ['60 Hz, scène lourde 21 ms à l’échelle 1', {hz: 60, load: () => 21}],
  ['60 Hz, juste au-dessus du vsync : 17,5 ms', {hz: 60, load: () => 17.5}],
  ['60 Hz, scène alternée 12 ms / 24 ms toutes les 6 s', {hz: 60, load: t => Math.floor(t / 6) % 2 ? 24 : 12}],
  ['60 Hz, scène légère 6 ms', {hz: 60, load: () => 6}],
  ['120 Hz, 11 ms à l’échelle 1', {hz: 120, load: () => 11}],
  ['144 Hz, 9 ms à l’échelle 1', {hz: 144, load: () => 9}],
  ['60 Hz, CPU dominant (GPU 30 %) 20 ms : la résolution ne peut pas aider', {hz: 60, load: () => 20, gpuShare: .3}],
];
for (const [name, cfg] of S) for (const k of ['actuel', 'prototype']) console.log(JSON.stringify({scenario: name, ...run(k, cfg)}));
