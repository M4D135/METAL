// Sonde RESTE-01 : part des octets par image imputée à models() (producteurs) seule.
// usage: node tools/proof/lot05/alloc-models.mjs <racine> [images=400] [monde=camp:6]
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
const p = S.sim.state.player;
const camera = {pos: [p.x, (p.y || 0) + 1.62, p.z], yaw: p.yaw, pitch: p.pitch, roll: 0, fov: 74};
for (let k = 0; k < 4; k++) gc();
const before = process.memoryUsage().heapUsed;
let keep = null;
for (let i = 0; i < frames; i++) keep = S.game.models(S.sim.state.time + i / 60, true, camera);
const ko = (process.memoryUsage().heapUsed - before) / 1024;
const meshes = keep.length;
console.log(JSON.stringify({monde: kind + ':' + idx, images: frames, maillagesDerniereImage: meshes,
  koParImageModeles: +(ko / frames).toFixed(1)}));
