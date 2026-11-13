// Banc d'horloge de la voie « boucle » : les 21 motifs d'horodatage contre la table de référence (STAB-06).
// Mesure dans le domaine principal (jamais node:vm, MASTER-PROMPT §4). N'écrit que dans les preuves.
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {loadRealm} from './realm-loader.mjs';
import {FRAMES, REFERENCE, runPattern, compare} from './boucle-motifs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'docs', 'chantier-moteur', 'preuves', 'module-boucle');
const FLoop = loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop;
const stepMs = FLoop.create().stepMs;
const loopSrc = fs.readFileSync(path.join(root, 'src', 'loop.js'));

const patterns = [];
let allMatchReference = true, allInvariant = true, allEcartBelowStep = true, allDilationBound = true, maxStepsPerFrame = 0;
for (const name of Object.keys(FRAMES)) {
  const r = runPattern(FLoop, name);
  const differences = compare(r, REFERENCE[name]);
  if (differences.length) allMatchReference = false;
  if (!(r.maxInvariantErr < 1e-6)) allInvariant = false;
  if (!(r.maxEcartMs <= stepMs)) allEcartBelowStep = false;
  if (!r.dilationBoundOk) allDilationBound = false;
  if (r.maxStepsPerFrame > maxStepsPerFrame) maxStepsPerFrame = r.maxStepsPerFrame;
  patterns.push({...r, differences});
  console.log(name + ' : ' + (differences.length ? differences.join(' ; ') : 'ok'));
}

const report = {
  schema: 'boucle-banc-horloge-v1',
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0].model,
  loadavg: os.loadavg(),
  stepMs,
  patterns,
  checks: {
    allMatchReference,
    allInvariant,
    allEcartBelowStep,
    allDilationBound,
    maxStepsPerFrame,
    loopBytes: loopSrc.length,
    loopSha256: createHash('sha256').update(loopSrc).digest('hex'),
  },
};
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'banc-horloge.json'), JSON.stringify(report, null, 2) + '\n');
const ok = allMatchReference && allInvariant && allEcartBelowStep && allDilationBound && maxStepsPerFrame <= 5;
console.log('bilan : ' + (ok ? 'ok' : 'ÉCART') + ' (' + patterns.length + ' motifs, pas max par image ' + maxStepsPerFrame + ')');
if (!ok) process.exit(1);
