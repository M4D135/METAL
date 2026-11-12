// STAB — cadencement : émule la boucle de game.js:676-696 (steps=ceil(dt*60), part=dt/steps, plafond .12)
// pour des fréquences d'affichage variées, et la compare à un pas fixe avec accumulateur + interpolation.
// Domaine principal, entrées indexées sur le temps simulé, chronométrage en temps CPU du fil, schémas alternés.
// node cadence.mjs <racine METAL> [monde=c0] [secondes=40]
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const [root, wname = 'c0', secArg = '40'] = process.argv.slice(2), SECS = +secArg;
globalThis.window = globalThis;
for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInThisContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), {filename: n + '.js'});
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const campaign = wname[0] === 'c', index = +wname.slice(1);
const world = campaign ? FWorld.create(96, index, {campaign: true, campaignVersion: 2}) : FWorld.create(96, index);
const mk = () => { const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})}); sim.setDifficulty?.(0); return sim; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Horodatages rAF (ms) pour chaque motif.
function stamps(p) {
  if (p === 'q60') { let t = 0; return () => { t += 1000 / 60; return Math.round(t * 10) / 10; }; }      // arrondi 0,1 ms (Chrome isolé)
  if (p === 'ms60') { let t = 0; return () => { t += 1000 / 60; return Math.round(t); }; }                // arrondi 1 ms (Safari, Firefox durci)
  if (p === 'drop60') { let t = 0, k = 0; return () => { t += (++k % 20 === 0 ? 2 : 1) * 1000 / 60; return t; }; } // une image perdue sur 20
  if (p === 'jit144') { let t = 0, k = 0; return () => { t += 1000 / 144; return t + (((k++ * 7919) % 7) - 3) * .12; }; } // gigue ±0,36 ms
  if (p === '60@1e6') { let t = 1e6; return () => (t += 1000 / 60); }
  let t = 0; const d = 1000 / (+p); return () => (t += d);
}
function hashState(s) { let h = 2166136261 >>> 0; const mix = v => { h = Math.imul(h ^ (Math.round(v * 1e4) | 0), 16777619) >>> 0; }; const p = s.player; mix(p.x); mix(p.y); mix(p.z); mix(p.hp); mix(s.kills); mix(s.shots); for (const e of s.enemies) { mix(e.x); mix(e.z); mix(e.hp); } return h.toString(16); }
// Entrées dérivées du temps simulé (identiques pour tous les schémas à temps simulé égal).
function inputsAt(t, input) { input.moveX = Math.sin(t * .667); input.moveY = 1; input.sprint = true; input.fire = (t % .333) < .1; input.weapon = 0; input.assist = false; }
const LOOK = .6; // rad/s
function runner(pattern, scheme) {
  const sim = mk(), s = sim.state, next = stamps(pattern), input = {moveX: 0, moveY: 1, lookX: 0, lookY: 0, fire: false, fireLeft: false, dash: false, pulse: false, melee: false, interact: false, weapon: 0, sprint: true, assist: false};
  const H = scheme === 'fixed120' ? 1 / 120 : 1 / 60;
  let last = pattern === '60@1e6' ? 1e6 : 0, simT = 0, frames = 0, steps = 0, cpuMs = 0, acc = scheme.startsWith('fixed') ? H * .999 : 0, period = 0, hist = {}, parts = new Map(), lastDash = 0;
  let prev = {x: s.player.x, y: s.player.y, z: s.player.z}, shown = {x: s.player.x, y: s.player.y, z: s.player.z}, lastShown = {...shown};
  const speeds = [], dts = []; let dropped = 0;
  const hist2 = [];
  function frame() {
    const now = next(), frameMs = Math.max(0, now - last); last = now; let dt = clamp(frameMs / 1000, 0, .12); frames++;
    let n = 0;
    if (scheme === 'current') {
      const st = Math.max(1, Math.ceil(dt * 60)), part = dt / st; input.lookX = LOOK * dt;
      for (let i = 0; i < st; i++) { inputsAt(simT, input); if (Math.floor(simT / 4) !== Math.floor(lastDash / 4)) { input.dash = true; lastDash = simT; } const c = cpu(); sim.step(part, input); cpuMs += cpu() - c; input.lookX = 0; input.dash = false; simT += part; n++; parts.set(part.toFixed(5), (parts.get(part.toFixed(5)) || 0) + 1); s.events.length = 0; if (s.player.hp < 60) s.player.hp = 100; }
      shown = {x: s.player.x, y: s.player.y, z: s.player.z};
    } else {
      // Lissage d'horloge : période d'affichage estimée (médiane glissante), dt ramené au multiple entier le plus proche s'il en est à moins de 20 %.
      hist2.push(dt); if (hist2.length > 30) hist2.shift(); const sorted = hist2.slice().sort((a, b) => a - b); period = sorted[sorted.length >> 1];
      const k = Math.max(1, Math.round(dt / period)); if (hist2.length >= 8 && Math.abs(dt - k * period) < .2 * period) dt = k * period;
      acc += dt; let pending = LOOK * dt;
      while (acc >= H - 1e-9 && n < 5) { inputsAt(simT, input); if (Math.floor(simT / 4) !== Math.floor(lastDash / 4)) { input.dash = true; lastDash = simT; } input.lookX = LOOK * H; prev = {x: s.player.x, y: s.player.y, z: s.player.z}; const c = cpu(); sim.step(H, input); cpuMs += cpu() - c; input.dash = false; simT += H; acc -= H; n++; parts.set(H.toFixed(5), (parts.get(H.toFixed(5)) || 0) + 1); s.events.length = 0; if (s.player.hp < 60) s.player.hp = 100; }
      if (n === 5 && acc > H) { dropped += acc - H; acc = H; }
      const a = scheme.endsWith('nointerp') ? 1 : clamp(acc / H, 0, 1), p = s.player; shown = {x: prev.x + (p.x - prev.x) * a, y: prev.y + (p.y - prev.y) * a, z: prev.z + (p.z - prev.z) * a};
    }
    steps += n; hist[n] = (hist[n] || 0) + 1;
    // vitesse affichée : déplacement entre deux images présentées, rapporté à la période RÉELLE d'affichage (uniforme)
    const d = Math.hypot(shown.x - lastShown.x, shown.z - lastShown.z); lastShown = shown; speeds.push(d); dts.push(frameMs / 1000);
    return simT;
  }
  return {frame, get simT() { return simT; }, sim, report() {
    // régularité : coefficient de variation du déplacement par image, sur les images où le joueur avance (>60 % de la médiane), fenêtre glissante de 30 images pour retirer les changements de vitesse voulus
    const cv = []; for (let i = 30; i + 30 < speeds.length; i += 30) { const w = speeds.slice(i, i + 30), m = w.reduce((a, b) => a + b, 0) / 30; if (m < .02) continue; const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 30); cv.push(sd / m); }
    cv.sort((a, b) => a - b);
    return {pattern, scheme, frames, steps, stepsPerFrame: +(steps / frames).toFixed(3), hist, parts: [...parts].map(([k, v]) => (+k * 1000).toFixed(2) + 'ms×' + v).join(' '), cpuMsPerSimS: +(cpuMs / simT).toFixed(2), simT: +simT.toFixed(3), kills: s.kills, shots: s.shots, pos: [s.player.x, s.player.z].map(v => +v.toFixed(2)), hash: hashState(s), cvMedian: cv.length ? +cv[cv.length >> 1].toFixed(4) : null, cvP90: cv.length ? +cv[Math.floor(cv.length * .9)].toFixed(4) : null, droppedMs: +(dropped * 1000).toFixed(1)};
  }};
}
const patterns = process.env.STRAIGHT_ONLY ? [] : ['60', '60@1e6', 'q60', 'ms60', '59.94', '75', '90', '120', '144', '165', '240', '50', '30', 'drop60', 'jit144'];
const R = [];
for (const p of patterns) { R.push(runner(p, 'current')); R.push(runner(p, 'fixed60')); }
if (!process.env.STRAIGHT_ONLY) { R.push(runner('144', 'fixed60-nointerp')); R.push(runner('144', 'fixed120')); R.push(runner('60', 'fixed120')); }
// avance alternée par tranches d'une seconde simulée (bruit de machine partagé entre schémas)
for (let sec = 1; sec <= SECS; sec++) for (const r of R) while (r.simT < sec - 1e-9) r.frame();
for (const r of R) console.log(JSON.stringify(r.report()));

// ---- régularité du mouvement affiché : course en ligne droite dans l'arène (vitesse constante attendue) ----
function straight(pattern, scheme) {
  const sim = mk(), s = sim.state, A = world.bossArena, p = s.player; Object.assign(p, {x: A.x - 22, y: A.y, z: A.z + 6, yaw: Math.PI / 2, pitch: 0});
  for (const e of s.enemies) { e.hp = 0; e.deployed = false; }
  const next = stamps(pattern), input = {moveX: 0, moveY: 1, lookX: 0, lookY: 0, fire: false, fireLeft: false, dash: false, pulse: false, melee: false, interact: false, weapon: 0, sprint: false, assist: false};
  const H = 1 / 60, P = pattern === 'ms60' || pattern === 'q60' ? 1 / 60 : pattern === 'jit144' ? 1 / 144 : 1 / (+pattern);
  let last = 0, acc = H * .999, prev = {x: p.x, z: p.z}, lastShown = {x: p.x, z: p.z}, simT = 0, debt = 0, maxDebt = 0, realT = 0, zero = 0, two = 0, dilation = 0; const hist = [], out = [];
  while (simT < 2.6) {
    const now = next(), frameMs = now - last; last = now; let dt = clamp(frameMs / 1000, 0, .12), shown;
    if (scheme === 'current') { const st = Math.max(1, Math.ceil(dt * 60)), part = dt / st; for (let i = 0; i < st; i++) { sim.step(part, input); simT += part; s.events.length = 0; } shown = {x: p.x, z: p.z}; }
    else { const raw = dt; { const p0 = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : dt, k = Math.max(1, Math.round(dt / p0)); hist.push(dt / k); if (hist.length > 30) hist.shift(); const period = hist.reduce((a, b) => a + b, 0) / hist.length;
        const locked = Math.abs(period - H) < .01 * H; if (scheme !== 'fixed60-rawclock' && hist.length >= 8 && Math.abs(dt - k * period) < .2 * period) dt = k * (locked ? H : period); if (locked && scheme !== 'fixed60-rawclock') { dilation += raw - dt; } else debt += raw - dt; const fix = clamp(debt, -.002, .002) * .1; dt += fix; debt -= fix; maxDebt = Math.max(maxDebt, Math.abs(debt)); }
      acc += dt; realT += raw; let n = 0; while (acc >= H - 1e-9 && n < 5) { prev = {x: p.x, z: p.z}; sim.step(H, input); simT += H; acc -= H; n++; s.events.length = 0; } if (n === 0) zero++; if (n > 1) two++;
      const a = scheme === 'fixed60-nointerp' ? 1 : clamp(acc / H, 0, 1); shown = {x: prev.x + (p.x - prev.x) * a, z: prev.z + (p.z - prev.z) * a}; }
    const d = Math.hypot(shown.x - lastShown.x, shown.z - lastShown.z); lastShown = shown; if (simT > 1 && simT < 2.5) out.push(d / P); // vitesse perçue si chaque image est présentée à période fixe P
  }
  const m = out.reduce((a, b) => a + b, 0) / out.length, sd = Math.sqrt(out.reduce((a, b) => a + (b - m) ** 2, 0) / out.length), mx = Math.max(...out.map(v => Math.abs(v - m)));
  return {pattern, scheme, frames: out.length, speed: +m.toFixed(3), cvPct: +(100 * sd / m).toFixed(2), maxDevPct: +(100 * mx / m).toFixed(1), maxDebtMs: +(maxDebt * 1000).toFixed(2), clockDriftMs: scheme === 'current' ? 0 : +((simT + acc - H * .999 - realT) * 1000).toFixed(2), zeroStepFrames: zero, twoStepFrames: two, dilationMs: +(dilation * 1000).toFixed(2)};
}
for (const p of ['60', 'q60', 'ms60', '59.94', '75', '120', '144', 'jit144', '240']) for (const sc of ['current', 'fixed60', 'fixed60-rawclock', 'fixed60-nointerp']) console.log(JSON.stringify(straight(p, sc)));
