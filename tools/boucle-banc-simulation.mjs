// Banc de simulation réelle de la voie « boucle » : une seule empreinte d'état quel que soit l'écran (STAB-06, LOOP-05).
// legacy-s0, graine 96, 1 800 pas pilotés par FLoop au rythme de 9 motifs, contre replay() et contre la formule actuelle
// de game.js. Domaine principal (jamais node:vm, MASTER-PROMPT §4) ; machine partagée : chauffe, paires alternées,
// médianes. N'écrit que banc-simulation.json dans les preuves ; code 1 si un critère tombe.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadRealm} from './realm-loader.mjs';
import {SCENARIOS, drive} from './proof/scenarios.mjs';
import {createRun, observeRun, finishRun, replay, sameState} from './proof/run.mjs';
import {pattern, nominalHz} from './boucle-motifs.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const loaded = loadRealm({root, realm: 'main'});                          // simulation : modules par défaut
const FLoop = loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop;
const scenario = SCENARIOS.find(s => s.id === 'legacy-s0'), STEPS = 1800, SEED = 96;
const ref = replay(loaded, scenario, {steps: STEPS, seed: SEED}, {timed: false});
const cpuMs = (start) => { const u = process.cpuUsage(start); return (u.user + u.system) / 1000; };

function withLoop(name) {                       // 1 800 pas pilotés par FLoop au rythme d'un motif
  const run = createRun(loaded, scenario, {seed: SEED}), L = FLoop.create(), next = pattern(name);
  let index = 0, frames = 0;
  const over = () => index >= STEPS || run.sim.state.dead || run.sim.state.won;
  const step = h => {                           // h vient de FLoop : 1/60 s
    drive(index, run.input, run.sim.state);
    run.sim.step(h, run.input);
    observeRun(run, index);                     // empreinte chaînée, puis vide state.events
    index++;
    if (over()) return false;                   // arrêt anticipé
  };
  const c0 = process.cpuUsage();
  for (let i = 1; !over(); i++) { L.advance(next(i).stamp, step); frames++; }
  const cpu = cpuMs(c0), res = finishRun(run);  // finishRun libère la simulation
  return {name, frames, steps: res.steps, chainHash: res.chainHash, snapshotSha256: res.snapshot.sha256,
    sameAsReplay: sameState(res, ref), simulationSeconds: res.simulationSeconds, cpuMsPerSimSecond: cpu / res.simulationSeconds,
    zeroStepFrames: L.stats.zeroStepFrames, multiStepFrames: L.stats.multiStepFrames, locked: L.locked};
}

function current(name, seconds = 30) {          // formule actuelle de game.js, 30 s d'affichage
  const run = createRun(loaded, scenario, {seed: SEED}), next = pattern(name), N = Math.round(seconds * nominalHz(name));
  let index = 0, last = null;
  const c0 = process.cpuUsage();
  for (let i = 1; i <= N; i++) {
    const now = next(i).stamp, frameMs = last === null ? 1000 / 60 : Math.max(0, now - last); last = now;
    const dt = Math.min(.12, frameMs / 1000), steps = Math.max(1, Math.ceil(dt * 60 - .06)), part = dt / steps;
    for (let s = 0; s < steps; s++) { drive(index, run.input, run.sim.state); run.sim.step(part, run.input); observeRun(run, index); index++; }
    if (run.sim.state.dead || run.sim.state.won) break;
  }
  const cpu = cpuMs(c0), res = finishRun(run);
  return {name, frames: N, steps: res.steps, simulationSeconds: res.simulationSeconds, stepsPerSimSecond: res.steps / res.simulationSeconds,
    snapshotSha256: res.snapshot.sha256, cpuMsPerSimSecond: cpu / res.simulationSeconds};
}

// Déroulé du §7.3 de la mission. Le rapport de CPU n'est qu'une information, sans seuil : au-dessus de 60 Hz, les deux
// exécutions d'une paire ne suivent pas la même trajectoire (pas de 1/60 s contre pas d'une période d'écran).
const PATTERNS = ['60', 'q60', '59.94', '75', '120', '144', '165', 'jit144', 'long60'];
const outDir = path.join(root, 'docs', 'chantier-moteur', 'preuves', 'module-boucle');
const median = v => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = x => x.toFixed(2);
const loadavg = os.loadavg(), t0 = process.hrtime.bigint();
withLoop('60'); current('60');                  // 1. chauffe, non comptée

const floop = [], currentFirst = [], cpuRatios = [], chainHashes = new Set(), floopCpu = [];
let floopRuns = 0, allSameAsReplay = true, allStepsDone = true, currentRepeatable = true;
const counted = f => {                          // 3. chaque exécution FLoop : même empreinte que replay(), 1 800 pas
  floopRuns++; chainHashes.add(f.chainHash); floopCpu.push(f.cpuMsPerSimSecond);
  if (!f.sameAsReplay || f.chainHash !== ref.chainHash) allSameAsReplay = false;
  if (f.steps !== STEPS) allStepsDone = false;
  return f;
};
for (const name of PATTERNS) {                  // 2. paires alternées : (FLoop, actuel), (actuel, FLoop), (FLoop, actuel)
  const pairs = [];
  { const f = counted(withLoop(name)), c = current(name); pairs.push([f, c]); }
  { const c = current(name), f = counted(withLoop(name)); pairs.push([f, c]); }
  { const f = counted(withLoop(name)), c = current(name); pairs.push([f, c]); }
  const [f0, c0] = pairs[0], ratios = pairs.map(([f, c]) => f.cpuMsPerSimSecond / c.cpuMsPerSimSecond);
  if (pairs.some(([, c]) => c.steps !== c0.steps || c.snapshotSha256 !== c0.snapshotSha256)) currentRepeatable = false;
  floop.push(f0); currentFirst.push(c0);
  cpuRatios.push({name, ratios, medianRatio: median(ratios), floopCpuMsPerSimSecond: pairs.map(([f]) => f.cpuMsPerSimSecond),
    currentCpuMsPerSimSecond: pairs.map(([, c]) => c.cpuMsPerSimSecond)});
  console.log(name + ' : FLoop ' + f0.frames + ' images, ' + f0.steps + ' pas, ' + f0.chainHash + (pairs.every(([f]) => f.sameAsReplay) ? ' = rejeu' : ' ≠ rejeu') +
    ' ; actuel ' + c0.steps + ' pas en ' + c0.frames + ' images ; CPU FLoop / actuel ' + fmt(median(ratios)) + ' (' + ratios.map(fmt).join(', ') + ')');
}

const distinctChainHashes = chainHashes.size, distinctSnapshotsCurrent = new Set(currentFirst.map(c => c.snapshotSha256)).size;
const report = {                                // 4. JSON (sans rows)
  schema: 'boucle-banc-simulation-v1',
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0].model,
  loadavg,
  loadavgEnd: os.loadavg(),
  seconds: Number(process.hrtime.bigint() - t0) / 1e9,
  scenario: scenario.id,
  seed: SEED,
  steps: STEPS,
  patterns: PATTERNS,
  reference: {steps: ref.steps, chainHash: ref.chainHash, snapshotSha256: ref.snapshot.sha256},
  floop,
  floopRuns,
  distinctChainHashes,
  allSameAsReplay,
  allStepsDone,
  current: currentFirst,
  distinctSnapshotsCurrent,
  currentRepeatable,
  cpuRatios,                                    // « cpu[] » du §7.3, renommé : la clé cpu est le modèle du processeur (§7)
  // Les 27 exécutions FLoop font le même travail (même trajectoire) : leur dispersion est le bruit de la machine.
  floopCpuSpread: {min: Math.min(...floopCpu), median: median(floopCpu), max: Math.max(...floopCpu)},
};
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'banc-simulation.json'), JSON.stringify(report, null, 2) + '\n');
const ok = distinctChainHashes === 1 && allSameAsReplay && allStepsDone;   // 5.
console.log('bilan : ' + (ok ? 'ok' : 'ÉCART') + ' — référence ' + ref.steps + ' pas, ' + ref.chainHash + (ref.dead || ref.won ? '' : ', ni mort ni victoire') +
  ' ; FLoop ' + distinctChainHashes + ' empreinte(s) sur ' + floopRuns + ' exécutions, ' + (allSameAsReplay ? 'toutes égales au rejeu' : 'pas toutes égales au rejeu') +
  ' ; actuel ' + distinctSnapshotsCurrent + ' instantanés distincts sur ' + currentFirst.length + ' ; bruit : FLoop de ' + fmt(report.floopCpuSpread.min) +
  ' à ' + fmt(report.floopCpuSpread.max) + ' ms CPU par seconde simulée pour le même travail ; ' + report.seconds.toFixed(1) + ' s');
if (!ok) process.exit(1);
