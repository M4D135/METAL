// Étape 4 de la voie « boucle » : le banc d'horloge (domaine principal) et T-F28 (node:vm) mesurent-ils la même chose ?
// runPattern sur les 21 motifs, avec FLoop chargé de deux façons : loadRealm(…, realm: 'main'), comme le banc, et
// vm.runInContext, comme checks/floop.test.mjs. Chauffe, puis 5 paires alternées ; chaque exécution doit rendre les
// mêmes résultats, au bit près (JSON.stringify). Les durées sont données pour information (machine partagée).
// Depuis la racine : node docs/chantier-moteur/preuves/module-boucle/etape-4-domaines.mjs
// Écrit etape-4-domaines.json à côté de ce fichier. Code 1 si une exécution diffère.
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync} from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {loadRealm} from '../../../../tools/realm-loader.mjs';
import {FRAMES, runPattern} from '../../../../tools/boucle-motifs.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const source = readFileSync(path.join(root, 'src/loop.js'), 'utf8');
const load = {
  main: () => loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop,
  vm: () => { const context = {window: {}}; vm.runInContext(source, vm.createContext(context)); return context.window.FLoop; },
};
const names = Object.keys(FRAMES);
const runAll = F => names.map(name => JSON.stringify(runPattern(F, name))).join('\n');
const timed = realm => { const t0 = process.hrtime.bigint(), out = runAll(load[realm]()); return {ms: Number(process.hrtime.bigint() - t0) / 1e6, out}; };
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];

runAll(load.main()); runAll(load.vm());                                   // chauffe, non comptée
const ms = {main: [], vm: []};
let reference = null, runs = 0, identical = true;
for (let rep = 0; rep < 5; rep++) {
  for (const realm of rep % 2 ? ['vm', 'main'] : ['main', 'vm']) {
    const {ms: t, out} = timed(realm);
    ms[realm].push(+t.toFixed(1)); runs++;
    if (reference === null) reference = out; else if (out !== reference) identical = false;
  }
}
const report = {
  schema: 'boucle-etape-4-domaines-v1', node: process.version, arch: process.arch, platform: process.platform,
  cpu: os.cpus()[0].model, loadavg: os.loadavg(),
  patterns: names.length, runs, identical,
  ms, medianMs: {main: median(ms.main), vm: median(ms.vm)}, vmOverMain: +(median(ms.vm) / median(ms.main)).toFixed(2),
};
writeFileSync(fileURLToPath(new URL('./etape-4-domaines.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.log((identical ? 'identique' : 'DIFFÉRENT') + ' : ' + names.length + ' motifs, ' + runs + ' exécutions alternées ; médianes '
  + report.medianMs.main + ' ms (domaine principal) et ' + report.medianMs.vm + ' ms (node:vm), rapport ' + report.vmOverMain);
if (!identical) process.exit(1);
