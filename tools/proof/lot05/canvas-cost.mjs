// Banc RCPU-09 : coût du dessin Canvas 2D (renderer.draw seul) et flux d'appels ctx.
// usage: node tools/proof/lot05/canvas-cost.mjs <base>,<tete> [images=300] [monde=camp:6] [qualite=auto] [reps=5]
//
// Structure appariée identique à costInterleaved de tools/proof/render-proof.mjs : les deux
// scènes vivent en même temps, avancent image par image, et l'ordre de mesure est inversé à
// chaque image — aucun côté n'est systématiquement second. Une exécution de contrôle
// (même racine contre elle-même) est publiée, et le ratio corrigé = ratio brut / ratio
// de contrôle. L'ancienne version déroulait `for (r) for (root of [base,tete]) timing(root,1)`,
// c'est-à-dire un bloc de 300 images par racine et par répétition, la tête passant toujours
// en second : son ratio ne reproduisait pas la preuve (1,0233 mesuré pour 0,938 annoncé).
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [base, head] = (process.argv[2] || '').split(',').map(p => resolve(p));
const frames = +(process.argv[3] || 300), spec = process.argv[4] || 'camp:6';
const quality = process.argv[5] || 'auto';
const reps = Math.max(2, +(process.argv[6] || 5));
if (!base || !head) throw new Error('usage: canvas-cost.mjs <base>,<tete> [images] [monde] [qualite] [reps]');
const {makeScene} = await import(pathToFileURL(head + '/tools/proof/render-scene.mjs').href);
const world = [spec.split(':')[0], +spec.split(':')[1]];
const warmup = 90;

function scene(root, {record}) {
  return makeScene(root, {world, seed: 96, quality, canvas2d: true, content: false, record});
}

// Deux scènes en lockstep : même image, ordre inversé à chaque image.
function costInterleaved(list) {
  const samples = list.map(() => []);
  for (let r = 0; r < reps; r++) {
    const scenes = list.map(root => scene(root, {record: false}));
    for (let i = 0; i < warmup; i++) for (const s of scenes) s.frame(1 / 60, {time: false});
    for (let i = 0; i < frames; i++) {
      const order = (i & 1) ? scenes.map((_, j) => j) : scenes.map((_, j) => j).reverse();
      for (const j of order) samples[j].push(scenes[j].frame(1 / 60, {time: true}).drawMs);
    }
    for (const s of scenes) s.renderer.dispose?.();
  }
  return samples;
}

function trace(root) {
  const S = scene(root, {record: true});
  for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
  const stats = S.renderer.stats;
  const r = {digest: S.recorder.digest(), drawCalls: stats.drawCalls, triangles: stats.triangles, instances: stats.instances};
  S.renderer.dispose?.();
  return r;
}

const median = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const quantile = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };
const summarize = s => ({drawP50: +median(s).toFixed(4), drawP95: +quantile(s, .95).toFixed(4), drawP99: +quantile(s, .99).toFixed(4)});

const [A, B] = costInterleaved([base, head]);
const [cA, cB] = costInterleaved([base, base]);
const paires = A.map((v, i) => B[i] / v).sort((x, y) => x - y);
const a = summarize(A), b = summarize(B), ca = summarize(cA), cb = summarize(cB);
const tb = trace(base), th = trace(head);
const ratio = k => +(b[k] / a[k]).toFixed(4);
const ratioCorrige = k => +(ratio(k) / (cb[k] / ca[k])).toFixed(4);

console.log(JSON.stringify({
  banc: 'node tools/proof/lot05/canvas-cost.mjs <base>,<tete> <images> <monde> <qualite> <reps>',
  mesure: 'renderer.draw seul (drawMs de render-scene), scène sans traceur ctx pendant les temps, '
    + 'deux scènes en lockstep et ordre inversé à chaque image',
  monde: spec, qualite: quality, images: frames, reps, node: process.version,
  base: {racine: base, ...a}, tete: {racine: head, ...b},
  controle: {racine: base, A: ca, B: cb, ratioDrawP50: +(cb.drawP50 / ca.drawP50).toFixed(4)},
  ratioDrawP50: ratio('drawP50'), ratioDrawP95: ratio('drawP95'),
  ratioDrawP50Corrige: ratioCorrige('drawP50'), ratioDrawP95Corrige: ratioCorrige('drawP95'),
  ratioParPaire: +paires[Math.floor(paires.length / 2)].toFixed(4),
  appels: {base: tb.drawCalls, tete: th.drawCalls},
  triangles: {base: tb.triangles, tete: th.triangles},
  instances: {base: tb.instances, tete: th.instances},
  fluxCtxIdentique: tb.digest === th.digest, digestBase: tb.digest, digestTete: th.digest
}, null, 1));
