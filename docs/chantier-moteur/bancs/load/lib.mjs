// Shared loader for LOAD benches. Read-only use of the project sources.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import inspector from 'node:inspector';

export function load(root, extra = [], srcDir = process.env.SRC || root + '/src') {
  const ctx = {window: {}, performance, console, Math, Date};
  vm.createContext(ctx);
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation', ...extra])
    vm.runInContext(readFileSync((n === 'renderer' || n === 'world' || n === 'destruction' || n === 'economy' || n === 'brain' || n === 'simulation' ? srcDir : root + '/src') + '/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
  ctx.window.__s = {sf: 0, routes: [], t: 0, pump: 0, debris: 0};
  return ctx.window;
}

export const now = () => performance.now();
export function time(f) { const t = now(); const r = f(); return [r, now() - t]; }

export function makeWorld(W, spec) {
  const [kind, idx] = spec.split(':');
  return kind === 'c' ? W.FWorld.create(96, +idx, {campaign: true, campaignVersion: 2}) : W.FWorld.create(96, +idx);
}

// Minimal profiler wrapper (node:inspector, same-thread; no network port).
export async function profiler() {
  const session = new inspector.Session(); session.connect();
  const post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, r) => e ? rej(e) : res(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', {interval: 100});
  return {
    start: () => post('Profiler.start'),
    stop: async () => (await post('Profiler.stop')).profile,
  };
}

export function summarize(profile, top = 20) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  profile.samples.forEach((id, k) => self.set(id, (self.get(id) || 0) + profile.timeDeltas[k]));
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = id => { const cf = nodes.get(id).callFrame; return (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1); };
  const incl = new Map(), selfByKey = new Map();
  for (const [id, t] of self) {
    selfByKey.set(key(id), (selfByKey.get(key(id)) || 0) + t);
    const seen = new Set(); let cur = id;
    while (cur !== undefined) { const k = key(cur); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + t); } cur = parent.get(cur); }
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const fmt = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, t]) => [(t / 1000).toFixed(1) + 'ms', (100 * t / total).toFixed(1) + '%', k]);
  return {totalMs: +(total / 1000).toFixed(1), inclusive: fmt(incl), self: fmt(selfByKey)};
}

// WebGL2 stub: every call is a no-op so renderer CPU work (index, pack, culling) can be timed.
export function stubCanvas(width = 1280, height = 720) {
  const consts = new Map(); let next = 1;
  const fns = {
    getShaderParameter: () => true, getProgramParameter: () => true,
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
    getUniformLocation: () => ({}), getExtension: () => null, getParameter: () => 4096,
    bufferData: (target, data) => { stub.uploaded += data?.byteLength || 0; stub.uploads++; },
  };
  const stub = {uploaded: 0, uploads: 0, calls: 0};
  const gl = new Proxy({}, {get(_, name) {
    if (typeof name !== 'string') return undefined;
    if (/^[A-Z0-9_]+$/.test(name)) { if (!consts.has(name)) consts.set(name, next++); return consts.get(name); }
    if (fns[name]) return (...a) => { stub.calls++; return fns[name](...a); };
    return (...a) => { stub.calls++; return name.startsWith('create') ? {} : undefined; };
  }});
  const canvas = {width, height, clientWidth: width, clientHeight: height, getContext: () => gl, addEventListener() {}, removeEventListener() {}};
  return {canvas, gl, stub};
}

export function gcObserver() {
  const entries = [];
  return import('node:perf_hooks').then(({PerformanceObserver}) => {
    const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) entries.push({kind: e.detail?.kind ?? e.kind, ms: e.duration, at: e.startTime}); });
    obs.observe({entryTypes: ['gc']});
    return {entries, stop: () => obs.disconnect()};
  });
}
