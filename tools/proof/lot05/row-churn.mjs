// Sonde DRAW-03 : quelle part des lignes d'instances dynamiques change vraiment d'une image à l'autre ?
// usage: node tools/proof/lot05/row-churn.mjs <racine> [images=300] [monde=camp:17]
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 300), [kind, idx] = (process.argv[4] || 'camp:17').split(':');
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
const w = {};
const src = readFileSync(root + '/src/renderer.js', 'utf8').replace('window.FRender={create,foliageTriangles};', 'window.FRender={create,foliageTriangles,pack,scratchRows,environmentInfo};');
vm.runInThisContext('(function(window){' + src + '\n})', {filename: 'renderer.js'})(w);
const S = makeScene(root, {world: [kind, +idx], seed: 96, quality: 'auto', content: false});
const pack = w.FRender.pack, env = w.FRender.environmentInfo(S.world.environment), scratch = w.FRender.scratchRows();
let rows = 0, changed = 0, bytesDynamic = 0, bytesStatic = 0, previous = null, previousCount = 0;
for (let i = 0; i < frames; i++) {
  const f = S.frame(1 / 60, {time: false});
  const batch = pack(f.dynamic, env, true, scratch);
  const values = batch.values, count = values.length / 16;
  for (let r = 0; r < count; r++) {
    let same = previous !== null && r < previousCount;
    if (same) for (let k = 0; k < 16; k++) if (values[r * 16 + k] !== previous[r * 16 + k]) { same = false; break; }
    rows++; if (!same) changed++;
  }
  bytesDynamic += values.byteLength;
  previous = values.slice(0); previousCount = count;
}
console.log(JSON.stringify({monde: kind + ':' + idx, images: frames, lignesParImage: +(rows / frames).toFixed(1),
  partModifiee: +(changed / rows).toFixed(4), octetsDynamiquesParImage: +(bytesDynamic / frames).toFixed(0),
  octetsStatiquesUneFois: 60528}));
