// Banc et preuve du lot 05 — rendu, coût processeur.
// usage: node tools/proof/render-proof.mjs <racine> [--mode stream|cost|both] [options]
//        node tools/proof/render-proof.mjs <racineA>,<racineB> --mode cost …   comparaison appariée
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
const out = opt('out', null);

const cpu = () => { const u = process.cpuUsage(); return () => { const d = process.cpuUsage(u); return (d.user + d.system) / 1000; }; };

function streamRun(root) {
  const scene = makeScene(root, {world: worldSpec, seed, quality, canvas2d});
  for (let i = 0; i < frames; i++) scene.frame(1 / 60);
  const result = {root, world: opt('world', 'camp:17'), seed, quality, canvas2d, frames, streamSha256: scene.recorder.digest(), contentSha256: scene.recorder.contentDigest(), ...scene.recorder.state};
  scene.renderer.dispose?.();
  return result;
}

function costBlock(root, measure) {
  const scene = makeScene(root, {world: worldSpec, seed, quality, canvas2d, content: false});
  const n = measure ? skip : warmup;
  for (let i = 0; i < n; i++) scene.frame(1 / 60, {time: false});
  const draw = [], models = [], total = [];
  for (let i = 0; i < frames; i++) {
    const f = scene.frame(1 / 60, {time: true});
    draw.push(f.drawMs); models.push(f.modelsMs); total.push(f.drawMs + f.modelsMs);
  }
  scene.renderer.dispose?.();
  return {draw, models, total};
}

const median = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const quantile = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const summarize = s => ({drawP50: +median(s.draw).toFixed(4), drawP95: +quantile(s.draw, .95).toFixed(4), drawP99: +quantile(s.draw, .99).toFixed(4),
  drawMean: +(s.draw.reduce((x, y) => x + y, 0) / s.draw.length).toFixed(4),
  modelsP50: +median(s.models).toFixed(4), modelsMean: +(s.models.reduce((x, y) => x + y, 0) / s.models.length).toFixed(4),
  totalP50: +median(s.total).toFixed(4)});

const report = {mode, world: opt('world', 'camp:17'), seed, quality, canvas2d, frames, reps, warmup, skip, node: process.version};
if (mode === 'stream' || mode === 'both') report.stream = roots.map(streamRun);
if (mode === 'cost' || mode === 'both') {
  for (const root of roots) costBlock(root, false);
  const samples = roots.map(() => ({draw: [], models: [], total: []}));
  for (let r = 0; r < reps; r++) {
    const order = r % 2 === 0 ? roots.map((_, i) => i) : roots.map((_, i) => i).reverse();
    for (const i of order) { const b = costBlock(roots[i], true); for (const k of ['draw', 'models', 'total']) samples[i][k].push(...b[k]); }
  }
  report.cost = roots.map((root, i) => ({root, ...summarize(samples[i])}));
  if (report.cost.length === 2) {
    const a = report.cost[0], b = report.cost[1];
    report.ratio = {drawP50: +(b.drawP50 / a.drawP50).toFixed(4), drawMean: +(b.drawMean / a.drawMean).toFixed(4),
      modelsP50: +(b.modelsP50 / a.modelsP50).toFixed(4), totalP50: +(b.totalP50 / a.totalP50).toFixed(4)};
  }
}
const text = JSON.stringify(report, null, 1);
if (out) writeFileSync(out, text + '\n');
console.log(text);
