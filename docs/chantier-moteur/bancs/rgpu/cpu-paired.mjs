// RGPU : coût CPU de FRender.draw() en A/B APPARIÉ (variantes entrelacées image par image, ordre tourné)
// sur un faux contexte WebGL2, pour résister au bruit d'une machine partagée.
// Usage : node cpu-paired.mjs <racine-ferro> <scene.json> <quality> <variante...>
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
import {build} from './patches.mjs';
const [root, scenePath, quality, ...names] = process.argv.slice(2);
const frames = JSON.parse(readFileSync(scenePath, 'utf8'));
function makeGL(counters) {
  const gl = {FRAMEBUFFER_COMPLETE: 0x8CD5, getShaderParameter: () => true, getProgramParameter: () => true, checkFramebufferStatus: () => 0x8CD5,
    getUniformLocation: () => ({}), createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}), createRenderbuffer: () => ({}), createVertexArray: () => ({}),
    bufferData: (t, data) => { counters.bytes += data?.byteLength || 0; }, getExtension: () => null, getShaderInfoLog: () => '', getProgramInfoLog: () => ''};
  return new Proxy(gl, {get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 0x8000 + k.length; return () => {}; }});
}
const V = names.map(name => {
  const counters = {bytes: 0};
  const canvas = {width: 300, height: 150, clientWidth: 1440, clientHeight: 932, getContext: (t) => t === 'webgl2' ? makeGL(counters) : null, addEventListener() {}, removeEventListener() {}};
  const ctx = {window: {devicePixelRatio: 2, innerWidth: 1440, innerHeight: 932}, performance, console, Math, Date}; vm.createContext(ctx);
  vm.runInContext(build(readFileSync(root + '/src/renderer.js', 'utf8'), name), ctx, {filename: 'renderer-' + name + '.js'});
  for (const n of ['world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
  const {FWorld, FSimulation, FBrain, FRender} = ctx.window;
  const world = FWorld.create(96, 0, {campaign: true, campaignVersion: 2});
  const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})});
  const r = FRender.create(canvas); r.resize(quality);
  r.setWorld(sim.destruction?.meshes || world.meshes, sim.destruction?.lights || world.lights, world.environment);
  // Les scènes capturées sont du JSON : chaque variante reçoit sa propre copie (pas d'état partagé).
  const own = JSON.parse(JSON.stringify(frames));
  return {name, r, counters, own, t: [], kb: []};
});
const run = (v, i) => { const f = v.own[i], fx = Object.assign({}, f.fx, {adaptive: false}); v.r.actorFilter(f.camera, {shadows: true}); const b0 = v.counters.bytes; const t0 = performance.now(); v.r.draw(f.camera, f.dynamic, fx); const t = performance.now() - t0; return {t, kb: (v.counters.bytes - b0) / 1024}; };
for (let k = 0; k < 3; k++) for (let i = 0; i < frames.length; i++) for (const v of V) run(v, i);
const PASSES = 12; let rot = 0;
for (let k = 0; k < PASSES; k++) for (let i = 0; i < frames.length; i++) { const order = V.map((_, j) => V[(j + rot) % V.length]); rot++; for (const v of order) { const x = run(v, i); v.t.push(x.t); v.kb.push(x.kb); } }
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const base = V[0];
for (const v of V) {
  const ratios = v.t.map((t, i) => t / base.t[i]);
  // IC 95 % bootstrap de la médiane des rapports appariés.
  const boot = []; let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let b = 0; b < 400; b++) { const s = []; for (let j = 0; j < ratios.length; j++) s.push(ratios[Math.floor(rnd() * ratios.length)]); boot.push(med(s)); }
  boot.sort((a, b) => a - b);
  console.log(JSON.stringify({variant: v.name, quality, samples: v.t.length, medianMs: +med(v.t).toFixed(3), ratioVsBase: +med(ratios).toFixed(3), ci95: [+boot[10].toFixed(3), +boot[389].toFixed(3)], uploadKBMedian: +med(v.kb).toFixed(1)}));
}
