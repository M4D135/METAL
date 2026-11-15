// Sonde DRAW-04 : appels GL par image et appels redondants (même nom et mêmes arguments que le précédent).
// usage: node tools/proof/lot05/glcalls.mjs <racine> [images=600] [monde=camp:17] [qualite=auto]
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 600), spec = process.argv[4] || 'camp:17';
const quality = process.argv[5] || 'auto';
const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
const S = makeScene(root, {world: [spec.split(':')[0], +spec.split(':')[1]], seed: 96, quality, content: false});
const inner = S.recorder.record.bind(S.recorder);
const byName = new Map(), lastForKey = new Map();
let total = 0, redundant = 0;
// Un appel d'état est redondant quand il répète le dernier appel de même nom avec les mêmes arguments.
// Les appels de téléversement et de dessin sont exclus : répéter les mêmes octets a un effet réel.
const DATA = new Set(['bufferData', 'bufferSubData', 'texImage2D', 'texImage2D', 'texSubImage2D', 'compressedTexSubImage2D', 'drawElementsInstanced', 'drawArrays', 'drawElements', 'flush', 'readPixels', 'getUniformLocation']);
const key = (name, args) => {
  const parts = [name];
  for (const a of args) {
    if (ArrayBuffer.isView(a)) parts.push(a.constructor.name + ':' + a.byteLength + ':' + Array.from(a.subarray(0, Math.min(a.length, 24))).join(','));
    else if (a && typeof a === 'object') parts.push(a.__glid !== undefined ? 'o' + a.__glid : JSON.stringify(a));
    else parts.push(String(a));
  }
  return parts.join('\u0000');
};
S.recorder.record = (name, args, gl) => {
  const k = key(name, args);
  total++;
  if (!DATA.has(name)) {
    if (lastForKey.get(name) === k) redundant++;
    lastForKey.set(name, k);
  }
  byName.set(name, (byName.get(name) || 0) + 1);
  inner(name, args, gl);
};
for (let i = 0; i < 60; i++) S.frame(1 / 60, {time: false});
const beforeTotal = total, beforeRedundant = redundant;
for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  .map(([name, count]) => ({nom: name, parImage: +(count / frames).toFixed(2)}));
console.log(JSON.stringify({monde: spec, qualite: quality, images: frames,
  appelsParImage: +((total - beforeTotal) / frames).toFixed(1),
  redondantsParImage: +((redundant - beforeRedundant) / frames).toFixed(1),
  partRedondante: +((redundant - beforeRedundant) / (total - beforeTotal)).toFixed(4),
  drawsParImage: +(S.recorder.state.draws / frames).toFixed(2),
  appelsParDraw: +((total - beforeTotal) / S.recorder.state.draws).toFixed(2),
  haut: top}, null, 1));
