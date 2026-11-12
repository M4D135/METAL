// RGPU : coût CPU (JS) de FRender.draw() avec un faux contexte WebGL2 (aucun GPU), sur des images
// réellement capturées dans le jeu (out/scene-w0.json : caméra + maillages dynamiques + fx).
// Usage : node cpu-draw.mjs <racine-ferro> <scene.json> [quality=auto] [variant=base] [--profile]
import {readFileSync} from 'node:fs'; import vm from 'node:vm'; import inspector from 'node:inspector';
import {build} from './patches.mjs';
const [root, scenePath, quality='auto', variant='base', flag] = process.argv.slice(2);
const frames = JSON.parse(readFileSync(scenePath, 'utf8'));
// Faux WebGL2 : toutes les méthodes sont des no-op ; on compte les octets envoyés et les appels.
const counters = {calls: 0, bufferBytes: 0, draws: 0};
const enumProxy = new Proxy({}, {get: (t, k) => (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) ? 0x8000 + k.length : undefined});
function makeGL() {
  const gl = {
    FRAMEBUFFER_COMPLETE: 0x8CD5, getShaderParameter: () => true, getProgramParameter: () => true, checkFramebufferStatus: () => 0x8CD5,
    getUniformLocation: () => ({}), createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}), createRenderbuffer: () => ({}), createVertexArray: () => ({}),
    bufferData: (t, data) => { counters.bufferBytes += data?.byteLength || 0; },
    drawElementsInstanced: () => { counters.draws++; }, drawArrays: () => { counters.draws++; },
    getExtension: () => null, getShaderInfoLog: () => '', getProgramInfoLog: () => '',
  };
  return new Proxy(gl, {get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 0x8000 + k.length; return () => { counters.calls++; }; }});
}
const canvas = {width: 300, height: 150, clientWidth: 1440, clientHeight: 932, getContext: (t) => t === 'webgl2' ? makeGL() : null, addEventListener() {}, removeEventListener() {}};
const ctx = {window: {devicePixelRatio: 2, innerWidth: 1440, innerHeight: 932}, performance, console, Math, Date}; vm.createContext(ctx);
const rendererSrc = build(readFileSync(root + '/src/renderer.js', 'utf8'), variant);
vm.runInContext(rendererSrc, ctx, {filename: 'renderer.js'});
for (const n of ['world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
const {FWorld, FSimulation, FBrain, FRender} = ctx.window;
const world = FWorld.create(96, 0, {campaign: true, campaignVersion: 2});
const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})});
const r = FRender.create(canvas); r.resize(quality);
r.setWorld(sim.destruction?.meshes || world.meshes, sim.destruction?.lights || world.lights, world.environment);
const times = [], perFrame = [];
const run = (f) => { const fx = Object.assign({}, f.fx, {adaptive: false}); r.actorFilter(f.camera, {shadows: true}); const b0 = counters.bufferBytes, d0 = counters.draws; const t0 = performance.now(); r.draw(f.camera, f.dynamic, fx); const t = performance.now() - t0; return {t, kb: (counters.bufferBytes - b0) / 1024, draws: counters.draws - d0}; };
for (let k = 0; k < 3; k++) for (const f of frames) run(f); // chauffe JIT
let session, post;
if (flag === '--profile') { session = new inspector.Session(); session.connect(); post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, x) => e ? rej(e) : res(x))); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', {interval: 50}); await post('Profiler.start'); }
for (let k = 0; k < 10; k++) for (const f of frames) { const x = run(f); times.push(x.t); if (k === 0) perFrame.push(x); }
const q = p => { const a = times.slice().sort((x, y) => x - y); return +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(3); };
console.log(JSON.stringify({variant, quality, frames: frames.length, samples: times.length, medianMs: q(.5), p90Ms: q(.9), maxMs: q(1), uploadKBMedian: perFrame.map(x => x.kb).sort((a, b) => a - b)[perFrame.length >> 1], draws: perFrame[0].draws, staticVisible: r.stats.staticVisible, width: r.stats.width, height: r.stats.height}));
if (session) {
  const {profile} = await post('Profiler.stop');
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
  profile.samples.forEach((id, k) => self.set(id, (self.get(id) || 0) + profile.timeDeltas[k]));
  const byFn = new Map(); let tot = 0;
  for (const [id, t] of self) { const cf = nodes.get(id).callFrame; const key = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1); byFn.set(key, (byFn.get(key) || 0) + t); tot += t; }
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const incl = new Map();
  for (const [id, t] of self) { const seen = new Set(); let cur = id; while (cur !== undefined) { const cf = nodes.get(cur).callFrame, key = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + (cf.lineNumber + 1); if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + t); } cur = parent.get(cur); } }
  console.log('SELF (top 18, % du temps échantillonné)');
  for (const [k, t] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log((100 * t / tot).toFixed(1).padStart(5) + '%', k);
  console.log('INCLUSIF (top 18)');
  for (const [k, t] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log((100 * t / tot).toFixed(1).padStart(5) + '%', k);
}
