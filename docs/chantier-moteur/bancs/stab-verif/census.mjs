// STAB — recensement des saccades : vrai game.js + vrai renderer (WebGL2 factice) + vraie simulation,
// domaine principal, pilote automatique déterministe, sondes exclusives par image.
// node census.mjs <racine METAL> <monde: c0..c17 | l0..l2 | boss:cN> [secondes=180] [hz=60] [sortie.json] [pilote=tour]
import {writeFileSync} from 'node:fs';
import {createHarness, realNow, cpuNow, PROBE_NAMES, EXC, CNT, resetProbes, GLC, dist, pid} from './harness.mjs';
const [root, spec = 'c0', secArg = '180', hzArg = '60', out = '', pilotArg = ''] = process.argv.slice(2);
const seconds = +secArg, bossMode = spec.startsWith('boss:'), wname = bossMode ? spec.slice(5) : spec, campaign = wname[0] === 'c', index = +wname.slice(1);
const pilot = pilotArg || (bossMode ? 'boss' : 'tour');
const EV = ['waveStart', 'explosion', 'core', 'mechanism', 'bossRoar', 'bossPhase', 'bossDeath', 'materialBreak', 'fracture', 'encounterClear', 'rocket', 'grenadeLaunch', 'trophy', 'shopOpen', 'dead', 'win', 'liftStop', 'doorOpen', 'horror', 'pipeLeak'];
let evMask = 0, evShots = 0;
const H = await createHarness(root, {hooks: {}, prefs: process.env.QUALITY ? {quality: process.env.QUALITY} : undefined});
// Événements du pas, lus avant que game.events() ne vide la file.
const wrapSim = () => { const sim = H.G.sim; if (sim.__stab) return; sim.__stab = true; const step = sim.step; sim.step = (dt, input) => { const r = step(dt, input); for (const e of sim.state.events) { const k = EV.indexOf(e.name); if (k >= 0) evMask |= 1 << k; else if (e.name === 'shot') evShots++; } return r; }; };
const phases = {};
// ---- phase menu : 180 images à 60 Hz derrière le menu ----
{ const ms = []; let t = H.now; for (let i = 0; i < 180; i++) { t += 1000 / 60; const a = cpuNow(); H.frame(t); ms.push(cpuNow() - a); } phases.menu = {first: +ms[0].toFixed(2), second: +ms[1].toFixed(2), ...dist(ms.slice(2))}; }
// ---- chargement réel (bouton start -> preparePlay) ----
{ resetProbes(); const a = realNow(), c = cpuNow(); const log = await H.startGame(); phases.loading = {wallMs: +(realNow() - a).toFixed(0), cpuMs: +(cpuNow() - c).toFixed(0), frames: log.length, maxFrameMs: +Math.max(...log).toFixed(1), frameMsOver8: log.filter(v => v > 8).map(v => +v.toFixed(1)),
  probes: Object.fromEntries(PROBE_NAMES.map((n, i) => [n, +EXC[i].toFixed(1)]).filter(([, v]) => v >= 1).sort((x, y) => y[1] - x[1]))}; }
if (!(campaign && index === 0 && !bossMode)) {
  resetProbes(); const a = cpuNow();
  if (campaign) H.G.load(index, 96, undefined, true, 2); else H.G.load(index, 96, undefined, false, 1);
  H.G.saveCheckpoint(); H.G.start('bench');
  phases.loadWorld = {cpuMs: +(cpuNow() - a).toFixed(1), probes: Object.fromEntries(PROBE_NAMES.map((n, i) => [n, +EXC[i].toFixed(1)]).filter(([, v]) => v >= 1).sort((x, y) => y[1] - x[1]))};
}
// Horloge virtuelle déterministe : le nombre d'images passées en chargement dépend des minuteries réelles ;
// sans recalage, le bruit flottant des horodatages change ceil(dt*60) et la partie diverge d'un rejeu à l'autre.
H.now = 1e6; H.G.setMode('playing');
wrapSim();
let sim = H.G.sim, s = sim.state, world = H.G.world;
const arm = () => { const inv = s.inventory; if (!inv?.weapons) return; inv.weapons.fill(true); const caps = sim.ammoCaps || [180, 36, 12, 16, 1]; inv.ammo = inv.ammo.map((v, i) => caps[i] ?? v); };
arm();
// ---- pilotes ----
function makeRoute() { const stops = [...(world.enemies || []).map(e => [e.x, e.z]), ...(world.cores || []).map(c => [c.x, c.z]), [world.exit.x, world.exit.z]]; const route = []; let cur = [world.spawn.x, world.spawn.z]; const left = stops.slice();
  while (left.length) { let bi = 0, bd = Infinity; for (let k = 0; k < left.length; k++) { const d = Math.hypot(left[k][0] - cur[0], left[k][1] - cur[1]); if (d < bd) { bd = d; bi = k; } } cur = left.splice(bi, 1)[0]; route.push(cur); } return route; }
let route = makeRoute(), leg = 0, firing = false, weaponSlot = -1, ang = 0;
const boss = () => s.enemies.find(e => e.type === 3 && e.bossScale > 1) || s.enemies.find(e => e.type === 3);
if (pilot === 'boss') { const A = world.bossArena, p = s.player; Object.assign(p, {x: A.x - 14, y: A.y, z: A.z + .3, yaw: Math.PI / 2, pitch: 0}); }
function drive(elapsed, dt) {
  const p = s.player, i60 = Math.floor(elapsed * 60);
  if (pilot === 'tour') {
    const w = route[leg % route.length], dx = w[0] - p.x, dz = w[1] - p.z, d = Math.hypot(dx, dz);
    if (d < 1.5) leg++; else { const k = Math.min(1, 7 * dt / d); p.x += dx * k; p.z += dz * k; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y; }
    p.yaw = Math.atan2(dx, -dz) + Math.sin(i60 / 45) * .9; p.pitch = Math.sin(i60 / 70) * .12;
  } else if (pilot === 'boss') {
    const b = boss(), A = world.bossArena, cx = b && b.hp > 0 ? b.x : A.x, cz = b && b.hp > 0 ? b.z : A.z; ang += 7 * dt / 14;
    p.x = cx + Math.cos(ang) * 14; p.z = cz + Math.sin(ang) * 14; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y;
    const sc = b?.bossScale || 1, tx = cx, ty = (b?.baseY ?? A.y) + 1.93 * sc, tz = cz, ddx = tx - p.x, ddz = tz - p.z; p.yaw = Math.atan2(ddx, -ddz) + Math.sin(i60 / 45) * .25; p.pitch = Math.atan2(ty - p.y - 1.62, Math.hypot(ddx, ddz));
  }
  const wantFire = (i60 % 30) < 12; if (wantFire !== firing) { firing = wantFire; H.G.fire = firing; }
  const slot = Math.floor(i60 / 300) % 4; if (slot !== weaponSlot) { weaponSlot = slot; H.G.switchWeapon([0, 2, 1, 3][slot]); }
  if (i60 % 600 === 0) arm();
  if (p.hp < 100) p.hp = 100;
}
// ---- cadence ----
function intervals(p) {
  if (p === 'q60') { let t = 0; return () => { const a = Math.round(t * 10) / 10; t += 1000 / 60; return Math.round(t * 10) / 10 - a; }; }
  if (p === 'ms60') { let t = 0; return () => { const a = Math.round(t); t += 1000 / 60; return Math.round(t) - a; }; }
  return () => 1000 / (+p);
}
const next = intervals(hzArg), K = 64;
const maxFrames = Math.ceil(seconds * Math.max(60, +hzArg || 60) * 1.02) + 8;
const total = new Float32Array(maxFrames), wallMs = new Float32Array(maxFrames), exc = new Float32Array(maxFrames * K), alloc = new Float32Array(maxFrames), startAt = new Float64Array(maxFrames), endAt = new Float64Array(maxFrames);
const steps = new Uint8Array(maxFrames), flags = new Int32Array(maxFrames), rev = new Uint8Array(maxFrames), glBytes = new Float32Array(maxFrames), meshes = new Uint16Array(maxFrames), navPending = new Int32Array(maxFrames), simT = new Float32Array(maxFrames), enemiesOn = new Uint16Array(maxFrames);
const modeLog = [];
let t = H.now, elapsed = 0, f = 0, lastRev = s.destructionRevision ?? sim.destruction?.revision ?? 0;
H.C.gc.length = 0; const wall0 = realNow();
const WALL_LIMIT = +(process.env.WALL_LIMIT || 270) * 1000;
while (elapsed < seconds * 1000 && f < maxFrames && realNow() - wall0 < WALL_LIMIT) {
  const dt = next(); t += dt; elapsed += dt;
  if (H.G.mode !== 'playing') {
    modeLog.push({f, mode: H.G.mode, t: +(elapsed / 1000).toFixed(2)});
    if (H.G.mode === 'shop') H.G.togglePause(); else if (H.G.mode === 'paused') H.G.togglePause(); else break;
  }
  if (H.G.sim !== sim) { sim = H.G.sim; s = sim.state; world = H.G.world; wrapSim(); route = makeRoute(); leg = 0; }
  drive(elapsed / 1000, dt / 1000);
  resetProbes(); evMask = 0; const steps0 = H.C.steps, b0 = GLC.bufferBytes;
  const h0 = H.heap(), a = realNow(), c0 = cpuNow();
  H.frame(t);
  const c1 = cpuNow(), b = realNow(), h1 = H.heap();
  total[f] = c1 - c0; wallMs[f] = b - a; startAt[f] = a; endAt[f] = b; alloc[f] = h1 - h0; steps[f] = H.C.steps - steps0; flags[f] = evMask; glBytes[f] = GLC.bufferBytes - b0; simT[f] = s.time;
  const r = s.destructionRevision ?? sim.destruction?.revision ?? 0; rev[f] = Math.min(255, r - lastRev); lastRev = r;
  navPending[f] = s.aiStats?.navPending || 0;
  const n = PROBE_NAMES.length; if (n > K) throw new Error('trop de sondes'); for (let k = 0; k < n; k++) exc[f * K + k] = EXC[k];
  f++;
}
const wall = realNow() - wall0;
await new Promise(r => setTimeout(r, 20)); H.obs.takeRecords?.();
// ---- GC par image ----
const gcMs = new Float32Array(f), gcKind = new Uint8Array(f); let gi = 0; const gcs = H.C.gc.slice().sort((x, y) => x.start - y.start); let gcOutside = 0;
for (const g of gcs) { while (gi < f && endAt[gi] < g.start) gi++; if (gi < f && g.start >= startAt[gi] - .01 && g.start <= endAt[gi]) { gcMs[gi] += g.ms; gcKind[gi] |= g.kind; } else gcOutside++; }
const names = PROBE_NAMES.slice();
const frameIdx = names.indexOf('game.frame');
// ---- synthèse ----
const tot = Array.from(total.subarray(0, f));
const sumBy = new Float64Array(names.length); for (let i = 0; i < f; i++) for (let k = 0; k < names.length; k++) sumBy[k] += exc[i * K + k];
const top = (i, n = 4) => names.map((nm, k) => [nm, exc[i * K + k]]).sort((x, y) => y[1] - x[1]).slice(0, n).filter(([, v]) => v > .05).map(([nm, v]) => nm + '=' + v.toFixed(2)).join(' ');
const evNames = m => EV.filter((_, k) => m & (1 << k)).join(',');
const cause = i => { if (gcMs[i] > wallMs[i] * .5) return 'GC'; let bk = 0, bv = -1; for (let k = 0; k < names.length; k++) { const v = exc[i * K + k]; if (v > bv) { bv = v; bk = k; } } return names[bk]; };
const long = []; for (let i = 0; i < f; i++) if (total[i] > 4) long.push(i);
const byCause = {}; for (const i of long) { const c = cause(i); const q = byCause[c] ??= {n: 0, over8: 0, over16: 0, max: 0, sumMs: 0}; q.n++; q.sumMs += total[i]; if (total[i] > 8) q.over8++; if (total[i] > 16.7) q.over16++; q.max = Math.max(q.max, total[i]); }
for (const q of Object.values(byCause)) { q.max = +q.max.toFixed(1); q.sumMs = +q.sumMs.toFixed(0); }
const allocOK = Array.from(alloc.subarray(0, f)).filter(v => v > 0);
const gcList = gcs.filter(g => g.start >= startAt[0] && g.start <= endAt[f - 1]);
const kinds = {}; for (const g of gcList) { const q = kinds[g.kind] ??= {n: 0, ms: 0, max: 0}; q.n++; q.ms += g.ms; q.max = Math.max(q.max, g.ms); } for (const q of Object.values(kinds)) { q.ms = +q.ms.toFixed(1); q.max = +q.max.toFixed(2); }
const summary = {spec, pilot, hz: hzArg, seconds, clock: process.env.STAB_CLOCK === 'wall' ? 'wall' : 'thread-cpu', frames: f, wallMs: +wall.toFixed(0), cpuShare: +(tot.reduce((x, y) => x + y, 0) / wall).toFixed(2), wallFrame: dist(Array.from(wallMs.subarray(0, f))), simTime: +s.time.toFixed(1), kills: s.kills, shots: s.shots, modeLog, hash: stateHash(), phases,
  frame: dist(tot), stepsPerFrame: +(H.C.steps / f).toFixed(3), stepHist: Array.from(steps.subarray(0, f)).reduce((h, n) => (h[n] = (h[n] || 0) + 1, h), {}),
  perSystemAvgMs: Object.fromEntries(names.map((n, k) => [n, +(sumBy[k] / f).toFixed(4)]).filter(([, v]) => v >= .002).sort((x, y) => y[1] - x[1])),
  allocPerFrameKB: allocOK.length ? {avg: +(allocOK.reduce((x, y) => x + y, 0) / allocOK.length / 1024).toFixed(0), p50: +(allocOK.sort((x, y) => x - y)[allocOK.length >> 1] / 1024).toFixed(0), n: allocOK.length} : null,
  gc: {count: gcList.length, kinds, outsideFrames: gcOutside, framesWithGC: Array.from(gcMs).filter(v => v > 0).length, maxGcMsInFrame: +Math.max(0, ...gcMs).toFixed(2)},
  destructionRevisions: Array.from(rev.subarray(0, f)).reduce((x, y) => x + (y > 0), 0), checkpoints: H.C.storage.set, checkpointMaxChars: H.C.storage.maxBytes,
  longFrames: {over4: long.length, byCause}, glUploadKBPerFrame: +(Array.from(glBytes.subarray(0, f)).reduce((x, y) => x + y, 0) / f / 1024).toFixed(1),
  top: [...long].sort((x, y) => total[y] - total[x]).slice(0, 30).map(i => ({f: i, t: +simT[i].toFixed(2), ms: +total[i].toFixed(2), steps: steps[i], gc: +gcMs[i].toFixed(2), rev: rev[i], nav: navPending[i], ev: evNames(flags[i]), top: top(i)}))};
function stateHash() { let h = 2166136261 >>> 0; const mix = v => { const x = Math.round(v * 1000) | 0; h = Math.imul(h ^ x, 16777619) >>> 0; }; const p = s.player; mix(p.x); mix(p.y); mix(p.z); mix(s.time); mix(s.kills); mix(s.shots); for (const e of s.enemies) { mix(e.x); mix(e.z); mix(e.hp); } return h.toString(16); }
console.log(JSON.stringify(summary, null, 1));
if (out) {
  writeFileSync(out, JSON.stringify(summary));
  writeFileSync(out.replace(/\.json$/, '') + '.bin.json', JSON.stringify({names, K, f, total: Array.from(total.subarray(0, f), v => +v.toFixed(3)), gcMs: Array.from(gcMs, v => +v.toFixed(3)), steps: Array.from(steps.subarray(0, f)), rev: Array.from(rev.subarray(0, f)), flags: Array.from(flags.subarray(0, f)), nav: Array.from(navPending.subarray(0, f)), simT: Array.from(simT.subarray(0, f), v => +v.toFixed(3)), alloc: Array.from(alloc.subarray(0, f)), EV,
    exc: Array.from(exc.subarray(0, f * K), v => +v.toFixed(3))}));
}
process.exit(0);
