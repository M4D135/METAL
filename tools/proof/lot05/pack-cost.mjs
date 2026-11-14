// Banc lot 05 T8 [RESTE-03] : coût de pack() seul, comparaison appariée et alternée.
// usage: node tools/proof/lot05/pack-cost.mjs <racineA>,<racineB> [--frames 240] [--reps 5]
//        [--warmup 120] [--skip 60] [--world camp:6] [--seed 96] [--out rapport.json]
// Les sources sont chargées dans le processus principal de Node (vm.runInThisContext,
// même style que tools/proof/render-scene.mjs), jamais dans un contexte isolé.
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import vm from 'node:vm';

const argv = process.argv.slice(2);
const roots = (argv[0] || '.').split(',').map(r => resolve(r));
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const num = (n, d) => { const v = opt(n, undefined); return v === undefined ? d : Number(v); };
const worldSpec = (() => { const [kind, idx] = (opt('world', 'camp:6')).split(':'); return [kind, +idx]; })();
const seed = num('seed', 96), frames = num('frames', 240), reps = num('reps', 5);
const warmup = num('warmup', 120), skip = num('skip', 60), out = opt('out', null);

function loadPack(root) {
  const src = readFileSync(root + '/src/renderer.js', 'utf8')
    .replace('window.FRender={create,foliageTriangles};', 'window.FRender={create,foliageTriangles,pack,scratchRows,environmentInfo};');
  const win = {innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2};
  vm.runInThisContext('(function(window){' + src + '\n})', {filename: root + '/src/renderer.js'})(win);
  return win.FRender;
}

async function collect(root, warm, skipFrames, keep) {
  const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
  const scene = makeScene(root, {world: worldSpec, seed, quality: 'auto', content: false});
  const lists = [];
  for (let i = 0; i < warm + skipFrames; i++) scene.frame(1 / 60, {time: false});
  for (let i = 0; i < keep; i++) lists.push(scene.frame(1 / 60, {time: false}).dynamic);
  return {scene, lists, environment: scene.world.environment};
}

const cpu = () => { const u = process.cpuUsage(); return () => { const d = process.cpuUsage(u); return (d.user + d.system) / 1000; }; };
const median = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const quantile = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * p))]; };

const runs = [];
for (const root of roots) runs.push({root, ...(await collect(root, warmup, skip, frames)), packApi: loadPack(root)});
const measured = runs;
const apis = runs.map(r => ({pack: r.packApi.pack, env: r.packApi.environmentInfo(r.environment), scratch: r.packApi.scratchRows()}));
const now = () => Number(process.hrtime.bigint());
const pairs = [], ta = [], tb = [];
for (let rep = 0; rep < reps + 2; rep++) {
  for (let k = 0; k < frames; k++) {
    const a = measured[0].lists[k], b = measured[1].lists[k];
    let x, y;
    if ((rep + k) & 1) { let t = now(); apis[1].pack(b, apis[1].env, true, apis[1].scratch); y = now() - t; t = now(); apis[0].pack(a, apis[0].env, true, apis[0].scratch); x = now() - t; }
    else { let t = now(); apis[0].pack(a, apis[0].env, true, apis[0].scratch); x = now() - t; t = now(); apis[1].pack(b, apis[1].env, true, apis[1].scratch); y = now() - t; }
    if (rep >= 2) { ta.push(x / 1e6); tb.push(y / 1e6); pairs.push(y / x); }
  }
}

const LABELS = ['base', 'tete'];
const report = {banc: 'pack() seul, image par image, ordre alterné (2 passages de chauffe exclus)', world: opt('world', 'camp:6'), seed, frames, reps, warmup, skip,
  node: process.version, maillagesParImage: measured.map(m => +(m.lists.reduce((a, l) => a + l.length, 0) / m.lists.length).toFixed(2)),
  runs: runs.map((r, i) => ({racine: LABELS[i] || r.root,
    medianeMs: +median(i ? tb : ta).toFixed(5), moyenneMs: +mean(i ? tb : ta).toFixed(5),
    p05: +quantile(i ? tb : ta, .05).toFixed(5), p95: +quantile(i ? tb : ta, .95).toFixed(5), n: (i ? tb : ta).length}))};
report.ratioMediane = +(median(tb) / median(ta)).toFixed(4);
report.ratioParPaire = +median(pairs).toFixed(4);
const text = JSON.stringify(report, null, 1) + '\n';
if (out) writeFileSync(out, text);
console.log(text);
