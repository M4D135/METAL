// Banc de coûts de la voie « boucle » (§7.4 de la mission) : coût d'advance (rappel, puis plan), de pump (10 tâches
// « image »), de pumpSim (3 tâches « sim ») et de track (40 entités). Domaine principal de Node (jamais node:vm,
// MASTER-PROMPT §4), chronométré par process.hrtime.bigint(). Machine partagée : une série de chauffe non comptée,
// puis 5 séries où les cinq mesures se suivent dans un ordre alterné ; médianes. L'horloge de pump est lue ici
// (performance.now()), jamais dans le module. N'écrit que banc-couts.json ; code 1 si un critère tombe.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRealm} from './realm-loader.mjs';
import {pattern} from './boucle-motifs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'docs', 'chantier-moteur', 'preuves', 'module-boucle');
const {FLoop, FSchedule} = loadRealm({root, modules: ['loop', 'schedule'], realm: 'main'}).window;
const loadavg = os.loadavg(), started = process.hrtime.bigint();
const elapsedNs = t0 => Number(process.hrtime.bigint() - t0);

const ADVANCE_CALLS = 1e6, PUMP_CALLS = 2e5, SIM_CALLS = 1e6, TRACK_FRAMES = 2e5, ENTITIES = 40;
const stamps = new Float64Array(ADVANCE_CALLS), next = pattern('jit144');   // horodatages précalculés (image 1, 2, 3…)
for (let i = 0; i < ADVANCE_CALLS; i++) stamps[i] = next(i + 1).stamp;

function advanceNs() {                          // une boucle neuve, un rappel qui incrémente un compteur
  const L = FLoop.create();
  let n = 0;
  const count = () => { n++; };
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ADVANCE_CALLS; i++) L.advance(stamps[i], count);
  const ns = elapsedNs(t0);
  return {value: ns / ADVANCE_CALLS, work: {steps: n, statsSteps: L.stats.steps}};
}
function advancePlanNs() {                      // idem sans rappel : l'appelant lit frame.steps
  const L = FLoop.create();
  let n = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ADVANCE_CALLS; i++) n += L.advance(stamps[i]).steps;
  const ns = elapsedNs(t0);
  return {value: ns / ADVANCE_CALLS, work: {steps: n, statsSteps: L.stats.steps}};
}
function pump10Us() {                           // 10 tâches « image » qui demandent toujours à être rappelées
  const S = FSchedule.create({now: () => performance.now()});
  for (let k = 0; k < 10; k++) S.add({key: k, priority: k % 3, cost: .001, run() { return false; }});
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < PUMP_CALLS; i++) S.pump(4);
  const ns = elapsedNs(t0);
  return {value: ns / PUMP_CALLS / 1000, work: {ran: S.stats.ran, skipped: S.stats.skipped}};
}
function pumpSim3Ns() {                         // 3 tâches « sim » sans fin, 100 unités au plus par appel ; sans horloge
  const S = FSchedule.create();
  for (let k = 0; k < 3; k++) S.add({lane: 'sim', key: k, run: u => Math.min(u, 100)});
  let units = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < SIM_CALLS; i++) units += S.pumpSim(768);
  const ns = elapsedNs(t0);
  return {value: ns / SIM_CALLS, work: {units, simUnits: S.stats.simUnits}};
}
function track40Us() {                          // par image : begin, 40 save (pose d'avant le pas), prune, 40 pose
  const T = FLoop.track(), out = {};
  let sink = 0;
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < TRACK_FRAMES; f++) {
    T.begin();
    for (let j = 0; j < ENTITIES; j++) T.save(j, j + f * .05, 1, j * .5, f * .01);
    T.prune();
    const alpha = (f % 8) / 8;                  // l'entité a avancé de 5 cm : interpolée (sous snap = 2 m)
    for (let j = 0; j < ENTITIES; j++) sink += T.pose(j, j + (f + 1) * .05, 1, j * .5, (f + 1) * .01, alpha, out).x;
  }
  const ns = elapsedNs(t0);
  return {value: ns / TRACK_FRAMES / 1000, work: {size: T.size, sink}};
}

const MEASURES = [
  {name: 'advanceNs', run: advanceNs, threshold: 1000, unit: 'ns par appel',
    protocol: '1 000 000 advance(t, rappel) sur les horodatages jit144 précalculés (Float64Array), une boucle neuve par série'},
  {name: 'advancePlanNs', run: advancePlanNs, threshold: 1000, unit: 'ns par appel',
    protocol: '1 000 000 advance(t) en mode plan, mêmes horodatages, une boucle neuve par série'},
  {name: 'pump10Us', run: pump10Us, threshold: 20, unit: 'µs par appel',
    protocol: "FSchedule.create({now: () => performance.now()}), 10 tâches de clés 0 à 9, priorité k % 3, coût .001, run() rend false ; 200 000 pump(4)"},
  {name: 'pumpSim3Ns', run: pumpSim3Ns, threshold: 2000, unit: 'ns par appel',
    protocol: "FSchedule.create(), 3 tâches « sim » qui rendent Math.min(u, 100) ; 1 000 000 pumpSim(768)"},
  {name: 'track40Us', run: track40Us, threshold: 20, unit: 'µs par image',
    protocol: 'FLoop.track() ; par image : begin, 40 save, prune, 40 pose ; 200 000 images'},
];
const SERIES = 5;
for (const m of MEASURES) { m.series = []; m.works = []; }
for (let s = 0; s <= SERIES; s++) {             // série 0 : chauffe, non comptée ; ordre inversé une série sur deux
  for (const m of s % 2 ? [...MEASURES].reverse() : MEASURES) {
    const r = m.run();
    if (s) { m.series.push(r.value); m.works.push(r.work); } else m.warmup = r.value;
  }
}

const median = v => { const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const same = list => list.every(w => JSON.stringify(w) === JSON.stringify(list[0]));
const measures = {};
let allBelowThreshold = true;
for (const m of MEASURES) {
  const med = median(m.series), ok = med < m.threshold;
  if (!ok) allBelowThreshold = false;
  measures[m.name] = {unit: m.unit, protocol: m.protocol, threshold: m.threshold, warmup: m.warmup, series: m.series, median: med,
    min: Math.min(...m.series), max: Math.max(...m.series), ok, work: same(m.works) ? m.works[0] : m.works};
}
// Le travail mesuré est le bon : les deux modes d'advance font les mêmes pas, chaque série le même travail
// (pump excepté : une préemption de plus de 4 ms dans un pump y coupe la file, ce qui ne fausse pas le coût par appel).
const adv = measures.advanceNs.work, plan = measures.advancePlanNs.work, sim = measures.pumpSim3Ns.work, trk = measures.track40Us.work;
const sameWork = same(MEASURES[0].works) && same(MEASURES[1].works) && same(MEASURES[3].works) && same(MEASURES[4].works);
const workOk = sameWork && adv.steps === adv.statsSteps && plan.steps === adv.steps && plan.statsSteps === adv.steps &&
  sim.units === 300 * SIM_CALLS && sim.simUnits === sim.units && trk.size === ENTITIES;
const source = name => { const b = fs.readFileSync(path.join(root, 'src', name)); return {bytes: b.length, sha256: createHash('sha256').update(b).digest('hex')}; };
const loop = source('loop.js'), schedule = source('schedule.js');

const report = {
  schema: 'boucle-banc-couts-v1',
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0].model,
  loadavg,
  loadavgEnd: os.loadavg(),
  cores: os.cpus().length,
  seconds: elapsedNs(started) / 1e9,
  realm: 'main',
  clock: 'process.hrtime.bigint()',
  warmupSeries: 1,
  series: SERIES,
  order: 'série 1 : track, pumpSim, pump, plan, advance ; série 2 dans l\'autre sens, et ainsi de suite (chauffe : advance en premier)',
  sources: {loopBytes: loop.bytes, loopSha256: loop.sha256, scheduleBytes: schedule.bytes, scheduleSha256: schedule.sha256},
  measures,
  checks: {allBelowThreshold, workOk, sameWorkEachSeries: sameWork},
};
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'banc-couts.json'), JSON.stringify(report, null, 2) + '\n');
const fmt = x => x < 10 ? x.toFixed(3) : x.toFixed(1);
for (const m of MEASURES) {
  const r = measures[m.name];
  console.log(m.name + ' : médiane ' + fmt(r.median) + ' ' + m.unit + ' (séries ' + r.series.map(fmt).join(', ') + ') ; seuil ' + m.threshold + ' : ' + (r.ok ? 'ok' : 'DÉPASSÉ'));
}
const ok = allBelowThreshold && workOk;
console.log('bilan : ' + (ok ? 'ok' : 'ÉCART') + ' — ' + adv.steps + ' pas pour 1 000 000 images jit144 dans les deux modes' + (workOk ? '' : ', travail incohérent') +
  ' ; charge ' + loadavg.map(x => x.toFixed(2)).join(' / ') + ' ; ' + report.seconds.toFixed(1) + ' s');
if (!ok) process.exit(1);
