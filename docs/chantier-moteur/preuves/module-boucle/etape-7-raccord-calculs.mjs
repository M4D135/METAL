// Étape 7 de la voie « boucle » : chiffres du plan de raccord (document, sections 5 et 6), calculés avec FLoop
// seul, sans le jeu. Domaine principal de Node, aucune horloge lue, horodatages synthétiques. Depuis la racine :
// node docs/chantier-moteur/preuves/module-boucle/etape-7-raccord-calculs.mjs → etape-7-raccord-calculs.json
//
// 1. tests : les suites d'images des tests qui pilotent frame() (checks/input.test.mjs, checkpoint, audio),
//    pas par image avec FLoop après reset() (entrée en jeu), contre la formule actuelle de game.js:787 et :802 ;
//    fixes : les deux corrections de checks/input.test.mjs proposées au point 16.
// 2. gate : FOptions.frameGate (limiteur, déjà dans main) devant FLoop, qui ne voit que les images présentées ;
//    horodatages de vsync arrondis à 0,1 ms (Chrome hors isolation d'origine), 60 s par cas.
// 3. cadenceSwitch : limite passée de 0 à 60 à 120 Hz, ou écran passé de 144 à 60 Hz, avec trois façons
//    d'appeler resetPeriod() (point 5 du plan).
// 4. pressWait : attente d'un appui (uniforme dans le temps) jusqu'au pas qui le consomme : FLoop (première
//    image à au moins un pas) contre aujourd'hui (chaque image fait au moins un pas). Hors latence du
//    navigateur et de la composition, qui sont les mêmes dans les deux cas.
// 5. drifts : verrouillée 5 s à 60 Hz, puis période déplacée de +d % pendant 10 minutes, dans la bande
//    d'hystérésis (sortie à 2 %) ou au-delà ; invariant 3 de la section 2.4 du document. Et un départ direct à +1,5 %.
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import {loadRealm} from '../../../../tools/realm-loader.mjs';
import {pattern} from '../../../../tools/boucle-motifs.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const {FLoop, FOptions} = loadRealm({root, modules: ['options', 'loop'], realm: 'main'}).window;
const H = 1000 / 60, r3 = v => Math.round(v * 1000) / 1000, sum = a => a.reduce((s, v) => s + v, 0);
const count = (list) => { const h = {}; for (const v of list) h[v] = (h[v] || 0) + 1; return h; };

// Formule actuelle de frame() : dt borné à 0,12 s (game.js:787), puis STAB-V1 (game.js:802).
function today(ms) { const dt = Math.min(.12, Math.max(0, ms) / 1000); return {steps: Math.max(1, Math.ceil(dt * 60 - .06)), simMs: dt * 1000}; }

function sequence(id, framesMs) {
  const L = FLoop.create(); L.reset();                     // setMode('playing') → loop.reset()
  let now = 0; const steps = [], dropped = [], cur = framesMs.map(today);
  for (const ms of framesMs) { now += ms; const f = L.advance(now); steps.push(f.steps); dropped.push(r3(f.dropped)); }
  return {id, framesMs, floopSteps: steps, floopDroppedMs: dropped, floopSimMs: r3(sum(steps) * H),
    todaySteps: cur.map(c => c.steps), todaySimMs: r3(sum(cur.map(c => c.simMs)))};
}
const rep = (ms, n) => Array.from({length: n}, () => ms);
const tests = [
  sequence('input.test.mjs:91-95, appui verrouillé puis tir tenu', [120, 120]),
  sequence('input.test.mjs:97-102, pistolet presque prêt', [10, 100, 100, 60]),
  sequence('checkpoint.test.mjs, images de 100 ms', rep(100, 7)),
  sequence('input.test.mjs, images de 20 ms', rep(20, 10)),
  sequence('audio.test.mjs, images de 40 ms', rep(40, 10)),
  sequence('input.test.mjs:82-89, première image à 50, 33,3, 16,7 et 6,94 ms', [50]),
];
// Pistolet (input.test.mjs:97-102) : temps simulé après le pas du premier tir, puis délai restant pour 0,32 s.
{
  const t = tests[1], afterShotFloop = (sum(t.floopSteps) - 1) * H / 1000, afterShotToday = (t.todaySimMs - t.framesMs[0]) / 1000;
  t.pistol = {delayS: .32, afterShotSimSFloop: r3(afterShotFloop), afterShotSimSToday: r3(afterShotToday),
    remainingSFloop: r3(.32 - afterShotFloop), remainingSToday: r3(.32 - afterShotToday), testWindowS: [0, .07]};
}
// Corrections proposées au point 16 du plan : une image d'amorce avant :91-95 ; 16 images de 1000/60 ms dans :97-102.
const fixes = [
  sequence('input.test.mjs:91-95 corrigé, image d’amorce puis 120 et 120 ms', [1000 / 60, 120, 120]),
  sequence('input.test.mjs:97-102 corrigé, 16 images de 1000/60 ms puis 6 de 20 ms', [10, ...rep(1000 / 60, 16), ...rep(20, 6)]),
];
{
  const t = fixes[1], afterShot = sum(t.floopSteps.slice(1, 17)) * H / 1000;
  t.pistol = {delayS: .32, afterShotSimSFloop: r3(afterShot), remainingSFloop: r3(.32 - afterShot), testWindowS: [0, .07],
    stepsUntilReady: Math.ceil((.32 - afterShot) * 60 - 1e-9), stepsInTwentyMsFrames: t.floopSteps.slice(17)};
}

function gate(hz, limit, seconds = 60) {
  const g = FOptions.createFrameGate(), L = FLoop.create(), P = 1000 / hz, N = Math.round(seconds * hz), steps = [];
  for (let i = 1; i <= N; i++) {
    const t = Math.round(i * P * 10) / 10;
    if (!FOptions.frameGate(g, t, limit)) continue;
    steps.push(L.advance(t).steps);
  }
  const zero = steps.filter(n => !n).length;
  return {hz, limit, presentedFps: r3(steps.length / seconds), gateStride: g.stride, gateEffectiveHz: r3(g.effectiveHz),
    floopLocked: L.locked, floopPeriodMs: r3(L.period), lockChanges: L.stats.lockChanges, stepsPerSecond: r3(L.stats.steps / seconds),
    stepsHistogram: count(steps), zeroStepPct: r3(100 * zero / steps.length)};
}
const gates = [];
for (const hz of [60, 120, 144, 165, 240]) for (const limit of [0, 30, 60, 120]) if (!limit || limit < hz * .95) gates.push(gate(hz, limit));

// Changement de cadence au bout de 10 s : limite 0 → 60 à 120 Hz, ou écran 144 → 60 Hz sans limite.
// reset : 'aucun' ; 'au changement' (resetPeriod() avant l'image suivante, comme dans l'écouteur de l'option) ;
// 'après advance' (resetPeriod() juste après advance, à l'image où framePacer.effectiveHz s'écarte de plus de 5 %
// de sa valeur au dernier resetPeriod).
function cadenceSwitch(kind, reset) {
  const g = FOptions.createFrameGate(), L = FLoop.create(), after = [];
  const hzAt = i => kind === 'limite' ? 120 : i <= 1440 ? 144 : 60, limitAt = i => kind === 'limite' && i > 1200 ? 60 : 0;
  const first = kind === 'limite' ? 1201 : 1441, last = first - 1 + (kind === 'limite' ? 120 : 60) * 50;
  let t = 0, ref = 0, resets = 0;
  for (let i = 1; i <= last; i++) {
    t += 1000 / hzAt(i); const stamp = Math.round(t * 10) / 10;
    if (i === first && reset === 'au changement') { L.resetPeriod(); resets++; }
    if (!FOptions.frameGate(g, stamp, limitAt(i))) continue;
    const f = L.advance(stamp); if (i >= first) after.push(f.steps);
    const e = g.effectiveHz;
    if (reset === 'après advance' && e > 0) { if (!ref) ref = e; else if (Math.abs(e / ref - 1) > .05) { L.resetPeriod(); ref = e; resets++; } }
  }
  return {kind, reset, resets, floopLocked: L.locked, floopPeriodMs: r3(L.period), lockChanges: L.stats.lockChanges,
    stepsHistogramAfter: count(after), alphaEnd: r3(L.frame.alpha)};
}

function pressWait(name, frames = 6000) {
  const next = pattern(name), L = FLoop.create(), t = [], s = [];
  for (let i = 1; i <= frames; i++) { const now = next(i).stamp; t.push(now); s.push(L.advance(now).steps); }
  const firstStep = new Int32Array(frames); let k = -1;
  for (let i = frames - 1; i >= 0; i--) { if (s[i] > 0) k = i; firstStep[i] = k; }
  let total = 0, meanF = 0, meanT = 0, maxF = 0, maxT = 0; const gaps = [];
  for (let i = 41; i < frames && firstStep[i] >= 0; i++) {     // après le calibrage de la période
    const d = t[i] - t[i - 1], wait = t[firstStep[i]] - t[i];   // appui dans ]t[i-1], t[i]], lu à l'image i
    total += d; meanF += d * (wait + d / 2); meanT += d * d / 2; maxF = Math.max(maxF, wait + d); maxT = Math.max(maxT, d);
    if (s[i] > 0 && s[i - 1] >= 0) { let j = i - 1; while (j > 0 && !s[j]) j--; if (j > 40) gaps.push((t[i] - t[j]).toFixed(1)); }
  }
  return {name, floopMeanMs: r3(meanF / total), floopMaxMs: r3(maxF), todayMeanMs: r3(meanT / total), todayMaxMs: r3(maxT),
    gapsBetweenStepFramesMs: count(gaps)};
}
const pressWaits = ['60', '72', '75', '120', '144', 'jit144', '165'].map(name => pressWait(name));

// Invariant 3 : |stats.dilationMs| ≤ stepMs + 1 % de stats.realMs.
const r4 = v => Math.round(v * 1e4) / 1e4;
function drift(d, lockFirst = true) {
  const L = FLoop.create(), P = H * (1 + d / 100); let t = 0;
  if (lockFirst) for (let i = 0; i < 300; i++) { t += H; L.advance(t); }
  const lockedBefore = L.locked;
  for (let i = 0, n = Math.round(600000 / P); i < n; i++) { t += P; L.advance(t); }
  const s = L.stats, bound = H + .01 * s.realMs;
  return {driftPct: d, lockFirst, lockedBefore, lockedEnd: L.locked, lockChanges: s.lockChanges, dilationMs: r3(s.dilationMs),
    dilationPct: r4(100 * s.dilationMs / s.realMs), invariant3BoundMs: r3(bound), invariant3Ok: Math.abs(s.dilationMs) <= bound};
}
const drifts = [...[.5, .9, 1.2, 1.5, 1.9, 2.1].map(d => drift(d)), drift(1.5, false)];

const out = {schema: 'boucle-etape7-raccord/1', node: process.version, arch: process.arch, platform: process.platform,
  cpu: os.cpus()[0]?.model || 'unknown', loadavg: os.loadavg().map(r3),
  loopSha256: loadRealm({root, modules: ['loop'], realm: 'main'}).sourceSha256.loop,
  // Aucun événement ne signale un changement d'écran : la variante « au changement » ne vaut que pour la limite.
  tests, fixes, gates, cadenceSwitch: [...['aucun', 'au changement', 'après advance'].map(reset => cadenceSwitch('limite', reset)),
    ...['aucun', 'après advance'].map(reset => cadenceSwitch('écran', reset))],
  pressWaits, drifts};
writeFileSync(fileURLToPath(new URL('./etape-7-raccord-calculs.json', import.meta.url)), JSON.stringify(out, null, 1) + '\n');
for (const t of tests) console.log(`${t.id} : FLoop ${t.floopSteps.join(',')} pas (${t.floopSimMs} ms) ; aujourd'hui ${t.todaySteps.join(',')} (${t.todaySimMs} ms)`);
console.log('pistolet :', JSON.stringify(tests[1].pistol));
for (const t of fixes) console.log(`${t.id} : FLoop ${t.floopSteps.join(',')} pas (${t.floopSimMs} ms)`);
console.log('pistolet corrigé :', JSON.stringify(fixes[1].pistol));
for (const g of gates) console.log(`${g.hz} Hz, limite ${g.limit} : ${g.presentedFps} i/s, verrou ${g.floopLocked}, ${g.zeroStepPct} % sans pas, ${JSON.stringify(g.stepsHistogram)}`);
for (const c of out.cadenceSwitch) console.log(`changement (${c.kind}), resetPeriod ${c.reset} (${c.resets}) : verrou ${c.floopLocked}, période ${c.floopPeriodMs} ms, ${JSON.stringify(c.stepsHistogramAfter)}`);
for (const w of pressWaits) console.log(`${w.name} : FLoop ${w.floopMeanMs} / ${w.floopMaxMs} ms ; aujourd'hui ${w.todayMeanMs} / ${w.todayMaxMs} ms ; écarts ${JSON.stringify(w.gapsBetweenStepFramesMs)}`);
for (const d of drifts) console.log(`dérive +${d.driftPct} % (${d.lockFirst ? 'après verrouillage' : 'dès le départ'}) : verrou ${d.lockedBefore} → ${d.lockedEnd}, dilatation ${d.dilationMs} ms (${d.dilationPct} %), borne ${d.invariant3BoundMs} ms, invariant 3 ${d.invariant3Ok}`);
