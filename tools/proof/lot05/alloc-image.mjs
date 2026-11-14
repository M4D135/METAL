// Sonde RESTE-01 : octets alloués par image dans le chemin modèles+draw, par catégorie.
// usage: node tools/proof/lot05/alloc-image.mjs <racine> [images=400] [monde=camp:6]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import v8 from 'node:v8';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 400), [kind, idx] = (process.argv[4] || 'camp:6').split(':');
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
const S = makeScene(root, {world: [kind, +idx], seed: 96, quality: 'auto', content: false});
for (let i = 0; i < 150; i++) S.frame(1 / 60, {time: false});
for (let k = 0; k < 4; k++) gc();
const before = process.memoryUsage().heapUsed;
const t0 = process.hrtime.bigint();
for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const after = process.memoryUsage().heapUsed;
const ko = (after - before) / 1024;
console.log(JSON.stringify({monde: kind + ':' + idx, images: frames,
  koParImage: +(ko / frames).toFixed(1), msParImage: +(ms / frames).toFixed(3),
  note: 'heapUsed entre deux GC complets ; les objets encore vivants (listes de la dernière image) sont comptés une fois'}));
