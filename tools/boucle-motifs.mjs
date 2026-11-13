// Motifs d'horodatage synthétiques et mesure d'une boucle FLoop sur un motif (banc et tests de la voie « boucle »).
// Aucune horloge, aucun hasard non semé : chaque motif rend toujours les mêmes horodatages.
export const P60 = 1000 / 60, P144 = 1000 / 144;
// Nombre d'images de chaque motif (environ 10 minutes d'affichage).
export const FRAMES = Object.freeze({
  '30': 18000, '50': 30000, '59.94': 35964, '60': 36000, '75': 45000, '90': 54000, '120': 72000, '144': 86400, '165': 99000, '240': 144000,
  '60@1e6': 36000, 'q60': 36000, 'ms60': 36000, 'jit60': 36000, 'drop60': 36000, 'long60': 36000, 'bimodal': 36000,
  'jit144': 86400, 'q144': 86400, 'ms144': 86400, 'switch': 86400});
// Fréquence nominale de l'écran de chaque motif (pour la formule actuelle de game.js).
export const NOMINAL_HZ = Object.freeze({'60@1e6': 60, 'q60': 60, 'ms60': 60, 'jit60': 60, 'drop60': 60, 'long60': 60, 'bimodal': 60, 'jit144': 144, 'q144': 144, 'ms144': 144, 'switch': 144});
export const nominalHz = name => NOMINAL_HZ[name] ?? Number(name);
// pattern(name) rend next(i) pour i = 1, 2, 3… (appels dans l'ordre, une fois par image) :
// {stamp: horodatage rAF en ms, truth: durée vraie de l'image en ms}.
export function pattern(name) {
  let t = 0, k = 0;
  const lcg = () => (k = (Math.imul(k, 1103515245) + 12345) >>> 0) / 4294967296;
  switch (name) {
    case '60@1e6': return i => ({stamp: 1e6 + i * P60, truth: P60});
    case 'q60': return i => ({stamp: Math.round(i * P60 * 10) / 10, truth: P60});
    case 'ms60': return i => ({stamp: Math.round(i * P60), truth: P60});
    case 'jit60': return i => ({stamp: i * P60 + (lcg() * 4 - 2), truth: P60});
    case 'jit144': return i => ({stamp: i * P144 + (((i * 7919) % 7) - 3) * .12, truth: P144});
    case 'q144': return i => ({stamp: Math.round(i * P144 * 10) / 10, truth: P144});
    case 'ms144': return i => ({stamp: Math.round(i * P144), truth: P144});
    case 'drop60': return i => { const n = i % 20 === 0 ? 2 : 1; t += n * P60; return {stamp: t, truth: n * P60}; };
    case 'long60': return i => { const n = i === 5000 ? 30 : i % 1000 === 0 ? 7 : i % 300 === 0 ? 3 : 1; t += n * P60; return {stamp: t, truth: n * P60}; };
    case 'switch': return i => { const p = 1000 / (i <= 300 ? 60 : 144); t += p; return {stamp: t, truth: p}; };
    case 'bimodal': return i => { const d = i % 5 === 0 ? 10 : 18.33; t += d; return {stamp: t, truth: d}; };
    default: {
      const hz = Number(name);
      if (!(hz > 0)) throw new Error('motif inconnu : ' + name);
      const p = 1000 / hz; return i => ({stamp: i * p, truth: p});
    }
  }
}
// Mesure d'un motif. FLoop est l'objet global du module (chargé par vm ou dans le domaine principal).
export function runPattern(FLoop, name, opts = {}, frames = FRAMES[name]) {
  const L = FLoop.create(opts), next = pattern(name), H = L.stepMs, fill = opts.fill ?? .999;
  const hist = {}, ratios = [], marks = {};
  let S = 0, lastShown = null, maxEcart = 0, maxInv = 0, firstLock = 0, maxSteps = 0, zeroRun = 0, maxZeroRun = 0;
  const count = () => { S++; };
  for (let i = 1; i <= frames; i++) {
    const {stamp, truth} = next(i), f = L.advance(stamp, count);
    hist[f.steps] = (hist[f.steps] || 0) + 1;
    if (f.steps > maxSteps) maxSteps = f.steps;
    if (f.locked && !firstLock) firstLock = i;
    zeroRun = f.steps === 0 ? zeroRun + 1 : 0; if (zeroRun > maxZeroRun) maxZeroRun = zeroRun;
    const shown = S - 1 + f.alpha; // position affichée d'un corps qui avance d'une unité par pas
    if (lastShown !== null && f.dropped === 0 && i > 40) ratios.push((shown - lastShown) / (truth / H));
    lastShown = shown;
    // Écart temps simulé / temps réel, hors abandons voulus et hors dilatation du verrouillage (vaut -debt).
    const st = L.stats, ecart = st.steps * H + (L.acc - fill * H) - (st.realMs - st.droppedMs - st.abortedMs + st.dilationMs);
    if (Math.abs(ecart) > maxEcart) maxEcart = Math.abs(ecart);
    if (Math.abs(ecart + L.debt) > maxInv) maxInv = Math.abs(ecart + L.debt);
    if (name === 'long60' && (i === 300 || i === 1000 || i === 5000)) marks['frame' + i] = {steps: f.steps, raw: f.raw, dropped: f.dropped};
    if (name === 'switch' && i > 300 && !f.locked && !marks.unlockFrame) marks.unlockFrame = i;
    if (name === 'switch' && i === 330) marks.periodAt330 = L.period;
  }
  const st = L.stats, mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const sd = Math.sqrt(ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length);
  return {name, frames: st.frames, steps: st.steps, hist, maxStepsPerFrame: maxSteps, zeroStepFrames: st.zeroStepFrames, multiStepFrames: st.multiStepFrames,
    firstLockFrame: firstLock, locked: L.locked, periodMs: L.period, lockChanges: st.lockChanges, dilationMs: st.dilationMs, dilationPct: 100 * st.dilationMs / st.realMs,
    dilationBoundOk: Math.abs(st.dilationMs) <= H + .01 * st.realMs, maxDebtMs: st.maxDebtMs, maxEcartMs: maxEcart, maxInvariantErr: maxInv,
    droppedMs: st.droppedMs, clampedMs: st.clampedMs, abortedMs: st.abortedMs, cvPct: 100 * sd / mean, maxZeroRun, marks};
}
// Valeurs de référence (implémentation validée de la mission) : entiers, booléens et histogrammes exacts, flottants à TOLERANCE près.
export const REFERENCE = {
  "30": {frames:18000,steps:35999,hist:{"1":1,"2":17999},firstLockFrame:9,locked:true,lockChanges:1,periodMs:33.3333,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "50": {frames:30000,steps:36000,hist:{"1":24000,"2":6000},firstLockFrame:0,locked:false,lockChanges:0,periodMs:20,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "60": {frames:36000,steps:36000,hist:{"1":36000},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "75": {frames:45000,steps:36001,hist:{"0":8999,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:13.3333,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:1},
  "90": {frames:54000,steps:36001,hist:{"0":17999,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:11.1111,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:1},
  "120": {frames:72000,steps:36001,hist:{"0":35999,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:8.3333,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:1},
  "144": {frames:86400,steps:36001,hist:{"0":50399,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:6.9444,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:2},
  "165": {frames:99000,steps:36001,hist:{"0":62999,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:6.0606,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:2},
  "240": {frames:144000,steps:36001,hist:{"0":107999,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:4.1667,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:3},
  "59.94": {frames:35964,steps:35965,hist:{"1":35963,"2":1},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6834,dilationPct:-0.0944,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "60@1e6": {frames:36000,steps:36000,hist:{"1":36000},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "q60": {frames:36000,steps:36000,hist:{"1":36000},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "ms60": {frames:36000,steps:36000,hist:{"1":36000},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0028,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "jit60": {frames:36000,steps:36001,hist:{"1":35999,"2":1},firstLockFrame:10,locked:true,lockChanges:1,periodMs:16.7311,dilationPct:0.005,maxDebtMs:0.727,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "drop60": {frames:36000,steps:37800,hist:{"1":34200,"2":1800},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0026,maxDebtMs:0,cvPct:0,droppedMs:0,clampedMs:0,maxZeroRun:0},
  "long60": {frames:36000,steps:36360,hist:{"1":35856,"3":108,"5":36},firstLockFrame:9,locked:true,lockChanges:1,periodMs:16.6667,dilationPct:0.0027,maxDebtMs:0,cvPct:0,droppedMs:1333.333,clampedMs:250,maxZeroRun:0},
  "bimodal": {frames:36000,steps:35995,hist:{"0":2870,"1":30265,"2":2865},firstLockFrame:0,locked:false,lockChanges:0,periodMs:18.33,dilationPct:0.0028,maxDebtMs:6.26,cvPct:0.035,droppedMs:0,clampedMs:0,maxZeroRun:1},
  "jit144": {frames:86400,steps:36001,hist:{"0":50399,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:6.9604,dilationPct:0.0028,maxDebtMs:0.383,cvPct:0.535,droppedMs:0,clampedMs:0,maxZeroRun:2},
  "q144": {frames:86400,steps:36001,hist:{"0":50399,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:6.9433,dilationPct:0.0028,maxDebtMs:0.08,cvPct:0.062,droppedMs:0,clampedMs:0,maxZeroRun:2},
  "ms144": {frames:86400,steps:36001,hist:{"0":50399,"1":36001},firstLockFrame:0,locked:false,lockChanges:0,periodMs:6.9333,dilationPct:0.0028,maxDebtMs:0.8,cvPct:0.606,droppedMs:0,clampedMs:0,maxZeroRun:2},
  "switch": {frames:86400,steps:36173,hist:{"0":50227,"1":36173},firstLockFrame:9,locked:false,lockChanges:2,periodMs:6.9444,dilationPct:-0.0053,maxDebtMs:0,cvPct:0.9,droppedMs:0,clampedMs:0,maxZeroRun:7},
};
export const TOLERANCE = Object.freeze({periodMs: .001, dilationPct: .0005, maxDebtMs: .002, cvPct: .002, droppedMs: .001, clampedMs: .001});
// Rend la liste des écarts entre une mesure de runPattern et sa référence (vide si conforme).
export function compare(result, ref) {
  const out = [];
  for (const [key, want] of Object.entries(ref)) {
    const got = result[key];
    if (key === "hist") { if (JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(want).sort())) out.push(key + " : " + JSON.stringify(got) + " au lieu de " + JSON.stringify(want)); }
    else if (key in TOLERANCE) { if (!(Math.abs(got - want) <= TOLERANCE[key])) out.push(key + " : " + got + " au lieu de " + want + " ± " + TOLERANCE[key]); }
    else if (got !== want) out.push(key + " : " + got + " au lieu de " + want);
  }
  return out;
}
