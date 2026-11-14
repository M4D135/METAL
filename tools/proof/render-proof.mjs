// Banc et preuve du lot 05 — rendu, coût processeur.
// usage: node tools/proof/render-proof.mjs <racine> [--mode stream|cost|both] [options]
//        node tools/proof/render-proof.mjs <racineA>,<racineB> --mode cost …   comparaison appariée
// Le mode cost compare les deux racines image par image (les deux scènes avancent en
// lockstep et l'ordre est alterné à chaque image) et publie un contrôle « même racine
// contre elle-même » : le ratio corrigé est le ratio brut divisé par le ratio du contrôle.
// --no-control supprime l'exécution de contrôle (déconseillé : le ratio n'est pas corrigé).
import {makeScene} from './render-scene.mjs';
import {writeFileSync} from 'node:fs';

const argv = process.argv.slice(2);
const roots = (argv[0] || '.').split(',');
function opt(name, def) { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def; }
function num(name, def) { const v = opt(name, undefined); return v === undefined ? def : Number(v); }
const mode = opt('mode', 'both');
const worldSpec = (() => { const [kind, idx] = (opt('world', 'camp:17')).split(':'); return [kind, +idx]; })();
const seed = num('seed', 96);
const quality = opt('quality', 'auto');
const canvas2d = argv.includes('--canvas2d');
const frames = num('frames', 600);
const reps = num('reps', 5);
const warmup = num('warmup', 120);
const skip = num('skip', 60);
const withControl = !argv.includes('--no-control');
const out = opt('out', null);

function streamRun(root) {
  const scene = makeScene(root, {world: worldSpec, seed, quality, canvas2d});
  for (let i = 0; i < frames; i++) scene.frame(1 / 60);
  const result = {root, world: opt('world', 'camp:17'), seed, quality, canvas2d, frames, streamSha256: scene.recorder.digest(), contentSha256: scene.recorder.contentDigest(), ...scene.recorder.state};
  scene.renderer.dispose?.();
  return result;
}

// Comparaison appariée : toutes les scènes d'un même passage vivent en même temps,
// avancent image par image, et l'ordre de mesure est inversé à chaque image. Aucun
// côté n'est systématiquement premier : le biais de position est annulé à la source.
function costInterleaved(list) {
  const samples = list.map(() => ({draw: [], models: [], total: []}));
  for (let r = 0; r < reps; r++) {
    const scenes = list.map(root => makeScene(root, {world: worldSpec, seed, quality, canvas2d, content: false}));
    for (let i = 0; i < warmup + skip; i++) for (const s of scenes) s.frame(1 / 60, {time: false});
    for (let i = 0; i < frames; i++) {
      const order = (i & 1) ? scenes.map((_, j) => j) : scenes.map((_, j) => j).reverse();
      for (const j of order) {
        const f = scenes[j].frame(1 / 60, {time: true});
        samples[j].draw.push(f.drawMs); samples[j].models.push(f.modelsMs); samples[j].total.push(f.drawMs + f.modelsMs);
      }
    }
    for (const s of scenes) s.renderer.dispose?.();
  }
  return samples;
}

const median = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const quantile = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const summarize = s => ({drawP50: +median(s.draw).toFixed(4), drawP95: +quantile(s.draw, .95).toFixed(4), drawP99: +quantile(s.draw, .99).toFixed(4),
  drawMean: +mean(s.draw).toFixed(4),
  modelsP50: +median(s.models).toFixed(4), modelsMean: +mean(s.models).toFixed(4),
  totalP50: +median(s.total).toFixed(4)});
const METRICS = ['drawP50', 'drawMean', 'modelsP50', 'totalP50'];
const ratiosOf = (a, b) => Object.fromEntries(METRICS.map(k => [k, +(b[k] / a[k]).toFixed(4)]));

const report = {mode, world: opt('world', 'camp:17'), seed, quality, canvas2d, frames, reps, warmup, skip, node: process.version, appariement: 'images alternées, ordre inversé à chaque image'};
if (mode === 'stream' || mode === 'both') report.stream = roots.map(streamRun);
if (mode === 'cost' || mode === 'both') {
  const samples = costInterleaved(roots);
  report.cost = roots.map((root, i) => ({root, ...summarize(samples[i])}));
  if (report.cost.length === 2) {
    report.ratio = ratiosOf(report.cost[0], report.cost[1]);
    if (withControl) {
      const cs = costInterleaved([roots[0], roots[0]]);
      const ca = summarize(cs[0]), cb = summarize(cs[1]);
      report.controle = {racine: roots[0], A: ca, B: cb, ratio: ratiosOf(ca, cb)};
      report.ratioCorrige = Object.fromEntries(METRICS.map(k => [k, +(report.ratio[k] / report.controle.ratio[k]).toFixed(4)]));
    }
  }
}
const text = JSON.stringify(report, null, 1);
if (out) writeFileSync(out, text + '\n');
console.log(text);
