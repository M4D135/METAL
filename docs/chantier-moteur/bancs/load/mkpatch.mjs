// Builds a patched COPY of the sources for A/B measurements (the project folder is never modified).
// usage: node mkpatch.mjs <ferroRoot> <outDir> <patch[,patch...]>
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {PATCHES} from './patches.mjs';
const [root, out, names] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
const files = {};
for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) files[n] = readFileSync(root + '/src/' + n + '.js', 'utf8');
for (const name of names.split(',').filter(Boolean)) {
  const list = PATCHES[name]; if (!list) throw new Error('unknown patch ' + name);
  for (const [file, find, replace] of list) {
    const count = files[file].split(find).length - 1;
    if (count !== 1) throw new Error(`patch ${name}: fragment found ${count}x in ${file}: ${find.slice(0, 80)}`);
    files[file] = files[file].replace(find, () => replace);
  }
}
for (const [n, src] of Object.entries(files)) writeFileSync(out + '/' + n + '.js', src);
console.log('patched', names, '->', out);
