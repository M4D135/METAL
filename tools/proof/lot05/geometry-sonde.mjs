// Sonde DRAW-11 : taille des tampons de géométrie (sommets, indices) par forme, avant/après.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root = resolve(process.argv[2] || '.');
const w = {};
const src = readFileSync(root + '/src/renderer.js', 'utf8').replace('window.FRender={create,foliageTriangles};', 'window.FRender={create,foliageTriangles,geometry};');
vm.runInThisContext('(function(window){' + src + '\n})', {filename: 'renderer.js'})(w);
const report = {racine: root, qualites: {}};
for (const low of [false, 1, 2]) {
  const g = w.FRender.geometry(low);
  report.qualites[String(low)] = {
    sommets: g.vertices.length / 6, octetsTamponSommets: g.vertices.byteLength,
    indices: g.indices.length, octetsTamponIndices: g.indices.byteLength,
    parForme: Object.fromEntries(Object.entries(g.ranges).map(([k, v]) => [k, v.count])),
  };
}
console.log(JSON.stringify(report, null, 1));
