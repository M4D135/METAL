// Banc RCPU-09 : coût du dessin Canvas 2D (renderer.draw seul) et flux d'appels ctx, en paires alternées.
// usage: node tools/proof/lot05/canvas-cost.mjs <base>,<tete> [images=300] [monde=camp:6] [qualite=auto]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [base, head] = (process.argv[2] || '').split(',').map(p => resolve(p));
const frames = +(process.argv[3] || 300), spec = process.argv[4] || 'camp:6';
const quality = process.argv[5] || 'auto';
if (!base || !head) throw new Error('usage: canvas-cost.mjs <base>,<tete> [images] [monde] [qualite]');
const {makeScene} = await import(pathToFileURL(head + '/tools/proof/render-scene.mjs').href);
const world = [spec.split(':')[0], +spec.split(':')[1]];
const roots = [{tag: 'base', root: base}, {tag: 'tete', root: head}];

function scene(root, silencieux) {
  const S = makeScene(root, {world, seed: 96, quality, canvas2d: true, content: false});
  if (silencieux) S.recorder.record = () => {};
  return S;
}
function timing(root, reps) {
  const S = scene(root, true), samples = [];
  for (let i = 0; i < 90; i++) S.frame(1 / 60, {time: false});
  for (let r = 0; r < reps; r++) {
    let sum = 0;
    for (let i = 0; i < frames; i++) sum += S.frame(1 / 60, {time: true}).drawMs;
    samples.push(sum / frames);
  }
  return samples;
}
function trace(root) {
  const S = scene(root, false);
  for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
  const stats = S.renderer.stats;
  return {digest: S.recorder.digest(), drawCalls: stats.drawCalls, triangles: stats.triangles, instances: stats.instances};
}

const reps = 5, series = {base: [], tete: []};
for (let r = 0; r < reps; r++) for (const {root, tag} of roots) series[tag].push(...timing(root, 1));
const sorted = a => a.slice().sort((x, y) => x - y);
const b = sorted(series.base), h = sorted(series.tete);
const tb = trace(base), th = trace(head);
const ratios = b.map((v, i) => h[i] / v).sort((x, y) => x - y);
console.log(JSON.stringify({monde: spec, qualite: quality, images: frames, reps,
  mesure: 'renderer.draw seul (drawMs de render-scene), ctx silencieux pendant les temps',
  base: {p50: +b[(reps - 1) >> 1].toFixed(4), p95: +b[Math.floor((reps - 1) * .95)].toFixed(4)},
  tete: {p50: +h[(reps - 1) >> 1].toFixed(4), p95: +h[Math.floor((reps - 1) * .95)].toFixed(4)},
  ratioP50: +(h[(reps - 1) >> 1] / b[(reps - 1) >> 1]).toFixed(4),
  ratioParPaire: +ratios[(reps - 1) >> 1].toFixed(4),
  appels: {base: tb.drawCalls, tete: th.drawCalls},
  triangles: {base: tb.triangles, tete: th.triangles},
  instances: {base: tb.instances, tete: th.instances},
  fluxCtxIdentique: tb.digest === th.digest, digestBase: tb.digest, digestTete: th.digest}, null, 1));
