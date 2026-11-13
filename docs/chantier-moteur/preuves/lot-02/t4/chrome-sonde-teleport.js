// Sonde T4 (LOAD-03), chargée avant le script du jeu dans une copie de dist/index.html.
// Mesure, pour chaque image du jeu (rappel requestAnimationFrame nommé « frame ») :
// durée, sim.snapshot(), JSON.stringify de plus de 20 000 caractères, setItem de la
// clé de reprise. Note aussi ceux qui tombent hors de toute image (tâche différée)
// et les tâches longues (PerformanceObserver « longtask », 50 ms et plus).
(() => {
  'use strict';
  const KEY = 'ferro-expedition-v2';
  const R = window.__t4 = { frames: [], writes: [], strs: [], snaps: [], longtasks: [], sims: 0 };
  try { localStorage.clear(); if (window.__T4SAVE) localStorage.setItem(KEY, window.__T4SAVE); } catch (e) { R.storageError = String(e); }
  let cur = null, frameNo = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => cb && cb.name === 'frame' ? raf(ts => {
    const f = cur = { n: frameNo++, t: performance.now(), snap: 0, snapMs: 0, str: 0, strMs: 0, set: 0, setMs: 0, mark: R.mark || null };
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
  let FS;
  Object.defineProperty(window, 'FSimulation', { configurable: true, enumerable: true, get: () => FS, set(v) {
    const create = v.create;
    v.create = (...a) => {
      const sim = create(...a), snapshot = sim.snapshot; R.sims++;
      sim.snapshot = (...b) => { const t = performance.now(), out = snapshot(...b), ms = performance.now() - t; R.snaps.push({ inFrame: !!cur, frame: cur ? cur.n : null, ms, at: t, airborne: !!sim.state.player.airborne }); if (cur) { cur.snap++; cur.snapMs += ms; } return out; };
      R.sim = sim; return sim;
    };
    FS = v;
  } });
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) R.longtasks.push({ start: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { R.longtaskError = String(e); }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, ms, what) => { const t = performance.now(); while (!test()) { if (performance.now() - t > ms) throw new Error('timeout: ' + what + ' (' + document.body.dataset.state + ')'); await wait(10); } };
  const frames = n => { const end = frameNo + n; return until(() => frameNo >= end, 60000, n + ' images'); };
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const glInfo = () => { try { const gl = document.createElement('canvas').getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'sans webgl2'; } catch (e) { return String(e); } };
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
      const mark = { snaps: R.snaps.length, writes: R.writes.length, strs: R.strs.length, frames: R.frames.length };
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
      await frames(15);
      blasted && (blasted.revisionChanged = s.destructionRevision !== revision);
      p.hp = Math.max(p.hp, 100);
      Object.assign(p, { x: c.x, z: c.z, y: Number.isFinite(c.y) ? c.y : sim.ground(c.x, c.z), airborne: false, airVX: 0, airVY: 0, airVZ: 0 });
      R.mark = 'relais';
      try { await until(() => R.snaps.length > mark.snaps, 3000, 'prise'); } catch (e) { cases.push({ core: c.id, error: String(e), taken: c.taken, dead: s.dead }); continue; }
      await frames(45);
      const snap = R.snaps[mark.snaps], prise = R.frames.find(f => f.n === snap.frame) || null;
      const around = R.frames.filter(f => f.n > snap.frame - 30 && f.n < snap.frame + 30 && f.n !== snap.frame && !f.mark).map(f => f.ms);
      const writes = R.writes.slice(mark.writes), strs = R.strs.slice(mark.strs);
      const tasks = R.longtasks.filter(q => prise && q.start <= prise.t + prise.ms && q.start + q.ms >= prise.t);
      cases.push({ core: c.id, blasted, snapshotInFrame: snap.inFrame, airborne: snap.airborne,
        priseFrameMs: prise && +prise.ms.toFixed(2), snapshotMs: +snap.ms.toFixed(2),
        inFrame: prise && { stringify: prise.str, stringifyMs: +prise.strMs.toFixed(2), setItem: prise.set, setItemMs: +prise.setMs.toFixed(2) },
        deferred: { setItem: writes.filter(q => !q.inFrame).length, setItemMs: +writes.filter(q => !q.inFrame).reduce((a, q) => a + q.ms, 0).toFixed(2), stringify: strs.filter(q => !q.inFrame).length, stringifyMs: +strs.filter(q => !q.inFrame).reduce((a, q) => a + q.ms, 0).toFixed(2), delayMs: writes.length ? +(writes[0].at - snap.at).toFixed(1) : null },
        chars: writes.length ? writes[0].chars : null, neighbourMedianMs: median(around), neighbourMaxMs: around.length ? Math.max(...around) : null, longTasksOverPrise: tasks.length });
    }
    const ordinary = R.frames.slice(60).filter(f => !f.snap && !f.mark).map(f => f.ms);
    return { ua: navigator.userAgent, gl: glInfo(), renderer: document.body.dataset.renderer, resumed, world: { campaign: !!world.campaign, index: world.index ?? world.stage }, state: document.body.dataset.state, hidden: document.hidden,
      frames: R.frames.length, ordinaryMedianMs: median(ordinary), ordinaryP95Ms: ordinary.length ? ordinary.slice().sort((a, b) => a - b)[Math.floor(ordinary.length * .95)] : null,
      longTasks: R.longtasks.length, longTaskMaxMs: R.longtasks.reduce((a, q) => Math.max(a, q.ms), 0), longtaskError: R.longtaskError || null, cases };
  };
})();
