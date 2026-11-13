// Sonde T4 (LOAD-03), approche à pied : chargée avant le script du jeu dans une copie de dist/index.html.
// Pour chaque relais : le joueur est posé à 2,6 m du relais, la scène se stabilise (40 images),
// une brèche est ouverte près du relais, puis le joueur marche jusqu'au relais à 0,12 m par image
// (environ 7 m/s). L'image de prise est donc une image de marche ordinaire, sans téléportation.
// Mesure, pour chaque image du jeu (rappel requestAnimationFrame nommé « frame ») : durée totale,
// sim.step (somme des sous-pas), renderer.draw et renderer.updateWorld, sim.snapshot(), JSON.stringify
// de plus de 20 000 caractères et setItem de la clé de reprise ; note ceux qui tombent hors de toute
// image (tâche différée) et les tâches longues (PerformanceObserver « longtask », 50 ms et plus).
(() => {
  'use strict';
  const KEY = 'ferro-expedition-v2';
  const R = window.__t4 = { frames: [], writes: [], strs: [], snaps: [], longtasks: [], sims: 0, walk: null };
  try { localStorage.clear(); if (window.__T4SAVE) localStorage.setItem(KEY, window.__T4SAVE); } catch (e) { R.storageError = String(e); }
  let cur = null, frameNo = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => cb && cb.name === 'frame' ? raf(ts => {
    const w = R.walk, p = R.sim && R.sim.state.player;
    if (w && p) { const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz); if (d > 1e-3) { const k = Math.min(1, w.speed / d); p.x += dx * k; p.z += dz * k; } }
    const f = cur = { n: frameNo++, t: performance.now(), snap: 0, snapMs: 0, str: 0, strMs: 0, set: 0, setMs: 0, step: 0, stepMs: 0, drawMs: 0, updMs: 0, mark: R.mark || null, walking: !!w };
    R.mark = null;
    try { cb(ts); } finally { f.ms = performance.now() - f.t; cur = null; R.frames.push(f); }
  }) : raf(cb);
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const t = performance.now();
    try { return setItem.call(this, k, v); }
    finally { if (k === KEY) { const ms = performance.now() - t; R.writes.push({ inFrame: !!cur, frame: cur ? cur.n : null, ms, chars: String(v).length, at: t }); if (cur) { cur.set++; cur.setMs += ms; } } }
  };
  const stringify = JSON.stringify;
  JSON.stringify = function (...a) {
    const t = performance.now(), out = stringify.apply(JSON, a), ms = performance.now() - t;
    if (typeof out === 'string' && out.length > 20000) { R.strs.push({ inFrame: !!cur, frame: cur ? cur.n : null, ms, chars: out.length, at: t }); if (cur) { cur.str++; cur.strMs += ms; } }
    return out;
  };
  const timed = (obj, name, add) => { const fn = obj[name]; if (typeof fn !== 'function') return; obj[name] = function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { if (cur) add(cur, performance.now() - t); } }; };
  let FS, FR;
  Object.defineProperty(window, 'FSimulation', { configurable: true, enumerable: true, get: () => FS, set(v) {
    const create = v.create;
    v.create = (...a) => {
      const sim = create(...a), snapshot = sim.snapshot; R.sims++;
      sim.snapshot = (...b) => { const t = performance.now(), out = snapshot(...b), ms = performance.now() - t; R.snaps.push({ inFrame: !!cur, frame: cur ? cur.n : null, ms, at: t, airborne: !!sim.state.player.airborne }); if (cur) { cur.snap++; cur.snapMs += ms; } return out; };
      timed(sim, 'step', (f, ms) => { f.step++; f.stepMs += ms; });
      R.sim = sim; return sim;
    };
    FS = v;
  } });
  Object.defineProperty(window, 'FRender', { configurable: true, enumerable: true, get: () => FR, set(v) {
    const create = v.create;
    v.create = (...a) => { const r = create(...a); timed(r, 'draw', (f, ms) => { f.drawMs += ms; }); timed(r, 'updateWorld', (f, ms) => { f.updMs += ms; }); return r; };
    FR = v;
  } });
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) R.longtasks.push({ start: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { R.longtaskError = String(e); }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, ms, what) => { const t = performance.now(); while (!test()) { if (performance.now() - t > ms) throw new Error('timeout: ' + what + ' (' + document.body.dataset.state + ')'); await wait(5); } };
  const frames = n => { const end = frameNo + n; return until(() => frameNo >= end, 60000, n + ' images'); };
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const r2 = v => v === null || v === undefined ? null : +v.toFixed(2);
  const glInfo = () => { try { const gl = document.createElement('canvas').getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'sans webgl2'; } catch (e) { return String(e); } };
  // Un point de départ à 2,6 m du relais, au même niveau, libre, avec un chemin droit libre.
  function approach(sim, c) {
    const cy = Number.isFinite(c.y) ? c.y : sim.ground(c.x, c.z);
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, ok = [];
      for (let i = 0; i <= 8; i++) { const r = 1.0 + 1.6 * i / 8, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, y = sim.ground(x, z); ok.push(Number.isFinite(y) && Math.abs(y - cy) < .25 && !sim.blocked(x, z, .3)); }
      if (ok.every(Boolean)) { const x = c.x + Math.cos(a) * 2.6, z = c.z + Math.sin(a) * 2.6; return { x, z, y: sim.ground(x, z), yaw: Math.atan2(-(c.x - x), c.z - z) }; }
    }
    return null;
  }
  window.__t4run = async ({ blast = true } = {}) => {
    await until(() => document.body.dataset.state === 'menu' && R.sim, 30000, 'menu');
    const resume = document.getElementById('resume-expedition');
    const resumed = !!(window.__T4SAVE && resume && !resume.hidden);
    (resumed ? resume : document.getElementById('start')).click();
    await until(() => document.body.dataset.state === 'playing', 60000, 'jeu');
    await frames(120);
    const sim = R.sim, s = sim.state, p = s.player, world = s.world, cases = [];
    for (const c of s.cores) {
      if (c.taken) continue;
      const from = approach(sim, c);
      if (!from) { cases.push({ core: c.id, error: 'pas de point de départ libre' }); continue; }
      p.hp = Math.max(p.hp, 100);
      Object.assign(p, { x: from.x, z: from.z, y: from.y, airborne: false, airVX: 0, airVY: 0, airVZ: 0 });
      R.mark = 'pose';
      await frames(40);
      const mark = { snaps: R.snaps.length, writes: R.writes.length, strs: R.strs.length };
      let revision = s.destructionRevision, blasted = null;
      if (blast && sim.destruction) {
        // Une brèche près du relais, comme une roquette dans un mur (LOAD-03).
        let best = null, bestD = Infinity;
        for (const g of world.destructibles || []) {
          if (!g.bounds || !sim.destruction.isAlive(g.id)) continue;
          const b = g.bounds, x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2, d = Math.hypot(x - c.x, z - c.z);
          if (d < bestD) { bestD = d; best = [x, (b.minY + b.maxY) / 2, z]; }
        }
        if (best && bestD < 30) { R.mark = 'brèche'; sim.destruction.blast(best, 2.4, 80); blasted = { distance: +bestD.toFixed(1) }; }
      }
      await frames(3);
      blasted && (blasted.revisionChanged = s.destructionRevision !== revision);
      p.hp = Math.max(p.hp, 100);
      const walkFrom = frameNo;
      R.walk = { x: c.x, z: c.z, speed: .12 };
      try { await until(() => R.snaps.length > mark.snaps, 4000, 'prise'); } catch (e) { R.walk = null; cases.push({ core: c.id, error: String(e), taken: c.taken, dead: s.dead, x: p.x, z: p.z }); continue; }
      R.walk = null;
      await frames(45);
      const snap = R.snaps[mark.snaps], prise = R.frames.find(f => f.n === snap.frame) || null;
      const before = R.frames.filter(f => f.n >= walkFrom && f.n < snap.frame && f.walking && !f.mark).slice(-8);
      const writes = R.writes.slice(mark.writes), strs = R.strs.slice(mark.strs);
      const tasks = R.longtasks.filter(q => prise && q.start <= prise.t + prise.ms && q.start + q.ms >= prise.t);
      const rest = prise ? prise.ms - prise.stepMs - prise.drawMs - prise.updMs - prise.snapMs - prise.strMs - prise.setMs : null;
      cases.push({ core: c.id, blasted, walkFrames: snap.frame - walkFrom, snapshotInFrame: snap.inFrame, airborne: snap.airborne,
        priseFrameMs: prise && r2(prise.ms), snapshotMs: r2(snap.ms),
        inFrame: prise && { stringify: prise.str, stringifyMs: r2(prise.strMs), setItem: prise.set, setItemMs: r2(prise.setMs), steps: prise.step, stepMs: r2(prise.stepMs), drawMs: r2(prise.drawMs), updateWorldMs: r2(prise.updMs), restMs: r2(rest) },
        deferred: { setItem: writes.filter(q => !q.inFrame).length, setItemMs: r2(writes.filter(q => !q.inFrame).reduce((a, q) => a + q.ms, 0)), stringify: strs.filter(q => !q.inFrame).length, stringifyMs: r2(strs.filter(q => !q.inFrame).reduce((a, q) => a + q.ms, 0)), delayMs: writes.length ? +(writes[0].at - snap.at).toFixed(1) : null },
        chars: writes.length ? writes[0].chars : null,
        walkBefore: { frames: before.length, medianMs: r2(median(before.map(f => f.ms))), maxMs: before.length ? r2(Math.max(...before.map(f => f.ms))) : null, stepMedianMs: r2(median(before.map(f => f.stepMs))), drawMedianMs: r2(median(before.map(f => f.drawMs))), restMedianMs: r2(median(before.map(f => f.ms - f.stepMs - f.drawMs - f.updMs - f.snapMs - f.strMs - f.setMs))) },
        longTasksOverPrise: tasks.length });
    }
    const ordinary = R.frames.slice(60).filter(f => !f.snap && !f.mark).map(f => f.ms);
    return { ua: navigator.userAgent, gl: glInfo(), renderer: document.body.dataset.renderer, resumed, world: { campaign: !!world.campaign, index: world.index ?? world.stage }, state: document.body.dataset.state, hidden: document.hidden,
      frames: R.frames.length, ordinaryMedianMs: median(ordinary), ordinaryP95Ms: ordinary.length ? ordinary.slice().sort((a, b) => a - b)[Math.floor(ordinary.length * .95)] : null,
      longTasks: R.longtasks.length, longTaskMaxMs: R.longtasks.reduce((a, q) => Math.max(a, q.ms), 0), longtaskError: R.longtaskError || null, cases };
  };
})();
