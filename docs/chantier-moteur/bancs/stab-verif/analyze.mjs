// STAB — analyse d'un recensement (fichier .bin.json de census.mjs) : distribution, causes par excès, dérive, GC, HUD.
// node analyze.mjs out/A-c0.bin.json [out/B-c0.bin.json]   (2e fichier = rejeu identique : minimum par image)
import {readFileSync} from 'node:fs';
const files = process.argv.slice(2).filter(a => !a.startsWith('--')), verbose = process.argv.includes('--top');
const runs = files.map(f => JSON.parse(readFileSync(f, 'utf8')));
const A = runs[0], K = A.K, names = A.names, n = Math.min(...runs.map(r => r.f));
// minimum par image entre rejeux (filtre le bruit de machine) ; ventilation prise dans le rejeu le plus rapide
const pick = new Uint8Array(n), total = new Float64Array(n);
for (let i = 0; i < n; i++) { let b = 0; for (let r = 1; r < runs.length; r++) if (runs[r].total[i] < runs[b].total[i]) b = r; pick[i] = b; total[i] = runs[b].total[i]; }
const ex = (i, k) => runs[pick[i]].exc[i * K + k];
const GROUPS = [
  ['A* route()', ['sim:route']],
  ['IA hors route (updateEnemies)', ['sim:updateEnemies', 'sim:updateBrain']],
  ['vagues/renforts (updateEncounters)', ['sim:updateEncounters']],
  ['gravats (updateDebris)', ['sim:updateDebris']],
  ['cuisson navigation (pumpNav/refreshNav)', ['sim:pumpNav', 'sim:refreshNav']],
  ['destruction côté simulation', ['des:rebuild', 'des:damage', 'sim:rebuildCollision', 'sim:syncDestruction', 'sim:damageScenery', 'sim:explode', 'sim:appendDebris']],
  ['destruction côté rendu (updateWorld)', ['render.updateWorld', 'game.syncDestruction']],
  ['draw() JS', ['render.draw', 'render.resize']],
  ['models() (acteurs, effets)', ['game.models', 'actors.build', 'fx.build', 'fx.lights']],
  ['HUD + minicarte', ['game.renderHUD', 'game.drawRadar']],
  ['point de reprise (snapshot+JSON)', ['game.saveCheckpoint', 'sim.snapshot']],
  ['audio + paysage sonore', ['audio', 'soundscape.sample', 'soundscape.event']],
  ['chargement (create/setWorld)', ['sim.create', 'render.setWorld', 'world.create', 'game.load', 'render.create', 'music.warmup', 'sim.restore', 'game.setMode', 'game.renderShop']],
];
const gOf = new Int8Array(names.length).fill(-1);
GROUPS.forEach(([, list], g) => { for (const nm of list) { const k = names.indexOf(nm); if (k >= 0) gOf[k] = g; } });
const SIMOTHER = GROUPS.length, LOOPG = GROUPS.length + 1, NG = GROUPS.length + 2;
const gName = g => g === SIMOTHER ? 'simulation (autres systèmes)' : g === LOOPG ? 'boucle, événements, poses' : GROUPS[g][0];
for (let k = 0; k < names.length; k++) if (gOf[k] < 0) gOf[k] = names[k].startsWith('sim') ? SIMOTHER : LOOPG;
const gv = new Float64Array(n * NG);
for (let i = 0; i < n; i++) for (let k = 0; k < names.length; k++) gv[i * NG + gOf[k]] += ex(i, k);
const q = (arr, p) => { const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const med = q(total, .5);
const gMed = Array.from({length: NG}, (_, g) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = gv[i * NG + g]; return q(a, .5); });
const D = {n, median: +med.toFixed(3), p95: +q(total, .95).toFixed(2), p99: +q(total, .99).toFixed(2), p999: +q(total, .999).toFixed(2), max: +Math.max(...total).toFixed(1)};
const cnt = t => { let c = 0; for (let i = 0; i < n; i++) if (total[i] > t) c++; return c; };
D.rawOver = {ms4: cnt(4), ms8: cnt(8), ms16_7: cnt(16.7)};
D.relOver = {x3: cnt(3 * med), x6: cnt(6 * med), x12: cnt(12 * med)};
// cause = groupe au plus fort excès sur sa médiane
const causes = {}; const longIdx = [];
for (let i = 0; i < n; i++) if (total[i] > 3 * med) {
  longIdx.push(i); let bg = 0, bv = -1, sum = 0; for (let g = 0; g < NG; g++) { const e = Math.max(0, gv[i * NG + g] - gMed[g]); sum += e; if (e > bv) { bv = e; bg = g; } }
  const c = causes[gName(bg)] ??= {n: 0, x6: 0, x12: 0, maxMs: 0, maxX: 0, excessMs: 0, share: []};
  c.n++; if (total[i] > 6 * med) c.x6++; if (total[i] > 12 * med) c.x12++; c.maxMs = Math.max(c.maxMs, total[i]); c.maxX = Math.max(c.maxX, total[i] / med); c.excessMs += bv; c.share.push(bv / Math.max(1e-9, sum));
}
for (const c of Object.values(causes)) { c.maxMs = +c.maxMs.toFixed(1); c.maxX = +c.maxX.toFixed(1); c.excessMs = +c.excessMs.toFixed(0); c.shareOfExcess = +(c.share.reduce((a, b) => a + b, 0) / c.share.length).toFixed(2); delete c.share; }
// reproductibilité entre rejeux : images longues dans le rejeu 0 qui le sont aussi dans le rejeu 1
let repro = null;
if (runs.length > 1) { const m0 = q(runs[0].total.slice(0, n), .5), m1 = q(runs[1].total.slice(0, n), .5); let a = 0, both = 0, b = 0; for (let i = 0; i < n; i++) { const l0 = runs[0].total[i] > 3 * m0, l1 = runs[1].total[i] > 3 * m1; if (l0) a++; if (l1) b++; if (l0 && l1) both++; } repro = {run0: a, run1: b, both, med0: +m0.toFixed(2), med1: +m1.toFixed(2)}; }
// dérive : médiane par fenêtre de 10 s simulées
const drift = []; { const w = Math.max(1, Math.round(n / Math.max(1, Math.round(A.simT[n - 1] / 10)))); for (let s = 0; s + w <= n; s += w) { const seg = total.subarray(s, s + w); drift.push(+q(seg, .5).toFixed(2)); } }
// HUD : images avec tic HUD contre voisines sans
const kHud = names.indexOf('game.renderHUD'), kRadar = names.indexOf('game.drawRadar'); let hudN = 0, hudSum = 0, radarSum = 0;
for (let i = 0; i < n; i++) { const v = ex(i, kHud); if (v > 0) { hudN++; hudSum += v; radarSum += ex(i, kRadar); } }
// GC : excès des images contenant une collecte par rapport à leurs voisines
const gcIdx = []; for (let i = 2; i < n - 2; i++) if (runs[pick[i]].gcMs[i] > 0) gcIdx.push(i);
const gcExcess = gcIdx.map(i => total[i] - q([total[i - 2], total[i - 1], total[i + 1], total[i + 2]], .5));
// allocation
const al = A.alloc.slice(0, n).filter(v => v > 0);
const avgG = Object.fromEntries(Array.from({length: NG}, (_, g) => { let s = 0; for (let i = 0; i < n; i++) s += gv[i * NG + g]; return [gName(g), +(s / n).toFixed(3)]; }).sort((a, b) => b[1] - a[1]));
const out = {file: files[0], runs: runs.length, simSeconds: +A.simT[n - 1].toFixed(1), dist: D, repro, avgMsBySystem: avgG, medianMsBySystem: Object.fromEntries(gMed.map((v, g) => [gName(g), +v.toFixed(3)])),
  longFramesOver3xMedian: longIdx.length, causes: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1].excessMs - a[1].excessMs)),
  driftMedianPer10s: drift, hud: {ticks: hudN, avgMs: +(hudSum / Math.max(1, hudN)).toFixed(3), radarAvgMs: +(radarSum / Math.max(1, hudN)).toFixed(3)},
  gc: {frames: gcIdx.length, medianExcessMs: gcExcess.length ? +q(gcExcess, .5).toFixed(2) : 0, p90ExcessMs: gcExcess.length ? +q(gcExcess, .9).toFixed(2) : 0, perMinute: +(gcIdx.length / (A.simT[n - 1] / 60)).toFixed(0)},
  allocKBPerFrame: al.length ? +(al.reduce((a, b) => a + b, 0) / al.length / 1024).toFixed(0) : null,
  revisions: A.rev.slice(0, n).filter(v => v > 0).length, steps: A.steps.slice(0, n).reduce((h, v) => (h[v] = (h[v] || 0) + 1, h), {})};
console.log(JSON.stringify(out, null, 1));
if (verbose) { const ev = m => A.EV.filter((_, k) => m & (1 << k)).join(','); for (const i of [...longIdx].sort((a, b) => total[b] - total[a]).slice(0, 25)) { const parts = Array.from({length: NG}, (_, g) => [gName(g), gv[i * NG + g] - gMed[g]]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, v]) => v > .2).map(([k, v]) => k + ' +' + v.toFixed(1)).join(' ; '); console.log('t=' + A.simT[i].toFixed(1) + 's', total[i].toFixed(1) + 'ms', 'x' + (total[i] / med).toFixed(0), 'rev' + A.rev[i], 'nav' + A.nav[i], ev(A.flags[i]), '|', parts); } }
