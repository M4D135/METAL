// Harnais STAB : le VRAI jeu METAL (src/*.js dans l'ordre de tools/build.py, vrai game.js, vrai renderer.js)
// exécuté dans le DOMAINE PRINCIPAL de Node (vm.runInThisContext), avec DOM, WebGL2 et Web Audio factices
// et une horloge virtuelle. Rien n'est écrit dans le dépôt : les sondes sont injectées dans la copie mémoire.
// Sondes à temps EXCLUSIF (pile) : la somme des sondes d'une image = temps total de l'image.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import v8 from 'node:v8';
import {performance as realPerf, PerformanceObserver} from 'node:perf_hooks';

export const realNow = () => realPerf.now();
// Temps CPU du fil principal (ms) : insensible aux préemptions d'une machine partagée.
export const cpuNow = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const CLOCK = process.env.STAB_CLOCK === 'wall' ? realNow : cpuNow;
const ORDER = ['renderer', 'world', 'destruction', 'music', 'audio', 'soundscape', 'economy', 'brain', 'simulation', 'motion', 'actors', 'effects', 'options', 'game'];

// ---------- sondes ----------
export const PROBE_NAMES = [];
const ids = new Map();
export function pid(name) { let i = ids.get(name); if (i === undefined) { i = PROBE_NAMES.length; PROBE_NAMES.push(name); ids.set(name, i); } return i; }
const MAXP = 256;
export const EXC = new Float64Array(MAXP), INC = new Float64Array(MAXP), CNT = new Int32Array(MAXP);
const child = new Float64Array(128); let sp = 0;
globalThis.__now = CLOCK;
globalThis.__enter = () => { child[++sp] = 0; return CLOCK(); };
globalThis.__leave = (id, t0) => { const d = CLOCK() - t0; EXC[id] += d - child[sp]; INC[id] += d; CNT[id]++; sp--; child[sp] += d; };
export function resetProbes() { EXC.fill(0); INC.fill(0); CNT.fill(0); }
function wrapFn(name, fn) { const id = pid(name); return function (...a) { const t = __enter(); try { return fn.apply(this, a); } finally { __leave(id, t); } }; }
// Enveloppe textuelle : « function f( » imbriquée (indentation quelconque) -> sonde exclusive.
function wrapSource(src, names, prefix, strict = true) {
  for (const f of names) {
    const re = new RegExp('(\\n[ \\t]+)function ' + f + '\\(');
    if (!re.test(src)) { if (strict) throw new Error('sonde absente : ' + prefix + f); continue; }
    const id = pid(prefix + f);
    src = src.replace(re, (m, lead) => lead + 'function ' + f + '(...__a){const __t=__enter();try{return ' + f + '__o(...__a);}finally{__leave(' + id + ',__t);}}' + lead + 'function ' + f + '__o(');
  }
  return src;
}
export const GAME_PROBES = ['frame', 'events', 'renderHUD', 'drawRadar', 'models', 'saveCheckpoint', 'syncDestruction', 'load', 'renderShop', 'setMode'];
export const SIM_PROBES = ['updateEnemies', 'route', 'updateEncounters', 'updateDebris', 'updateEnvironment', 'fireArsenal', 'explode', 'damageScenery', 'updateBossAttacks', 'updateProjectiles', 'appendDebris', 'updateBrain', 'syncDestruction', 'rebuildCollision', 'refreshNav', 'pumpNav', 'updateDirector', 'collectSupplies', 'updateSystems', 'locomote'];
export const DES_PROBES = ['rebuild', 'damage'];

// ---------- WebGL2 factice (compte appels et octets) ----------
export const GLC = {calls: 0, bufferData: 0, bufferBytes: 0, draws: 0, instances: 0, texImage: 0, texPixels: 0, rbStorage: 0, programs: 0};
const CONSTS = 'TEXTURE_2D FRAMEBUFFER ARRAY_BUFFER DEPTH_TEST CULL_FACE TRIANGLES STATIC_DRAW RENDERBUFFER POLYGON_OFFSET_FILL TEXTURE0 FLOAT DEPTH_BUFFER_BIT UNSIGNED_BYTE RGBA8 RGBA NONE NEAREST LINEAR ELEMENT_ARRAY_BUFFER DYNAMIC_DRAW DEPTH_COMPONENT24 DEPTH_ATTACHMENT COLOR_ATTACHMENT0 CLAMP_TO_EDGE BLEND VERTEX_SHADER UNSIGNED_SHORT UNSIGNED_INT TEXTURE2 TEXTURE1 TEXTURE_WRAP_T TEXTURE_WRAP_S TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER SRC_ALPHA ONE_MINUS_SRC_ALPHA LINK_STATUS LEQUAL FRAGMENT_SHADER DEPTH_COMPONENT COLOR_BUFFER_BIT BACK COMPILE_STATUS STREAM_DRAW'.split(' ');
export function fakeGL() {
  const gl = {}; let n = 100, id = 0;
  for (const k of CONSTS) gl[k] = ++n;
  gl.FRAMEBUFFER_COMPLETE = 36053; gl.COLOR_BUFFER_BIT = 16384; gl.DEPTH_BUFFER_BIT = 256;
  const noop = () => { GLC.calls++; };
  const fns = 'enable disable bindFramebuffer useProgram uniform1i bindTexture viewport deleteProgram bindVertexArray activeTexture texParameteri drawArrays enableVertexAttribArray deleteShader clear uniform4f polygonOffset framebufferTexture2D drawBuffers depthMask deleteVertexArray deleteTexture deleteBuffer bindRenderbuffer attachShader vertexAttribDivisor uniform1fv uniform1f shaderSource readBuffer framebufferRenderbuffer depthFunc deleteRenderbuffer deleteFramebuffer cullFace compileShader clearColor blendFunc pixelStorei scissor colorMask uniform3fv uniform2f uniformMatrix4fv bindBuffer vertexAttribPointer bufferSubData'.split(' ');
  for (const f of fns) gl[f] = noop;
  for (const f of ['createBuffer', 'createVertexArray', 'createFramebuffer', 'createTexture', 'createShader', 'createRenderbuffer']) gl[f] = () => { GLC.calls++; return {id: ++id}; };
  gl.createProgram = () => { GLC.calls++; GLC.programs++; return {id: ++id}; };
  gl.linkProgram = noop;
  gl.getUniformLocation = (p, name) => { GLC.calls++; return {name}; };
  gl.getShaderParameter = gl.getProgramParameter = () => { GLC.calls++; return true; };
  gl.getShaderInfoLog = gl.getProgramInfoLog = () => '';
  gl.checkFramebufferStatus = () => { GLC.calls++; return 36053; };
  gl.getExtension = () => null; gl.getParameter = () => 4096; gl.isContextLost = () => false;
  gl.texImage2D = (t, l, f, w, h) => { GLC.calls++; GLC.texImage++; GLC.texPixels += w * h; };
  gl.renderbufferStorage = (t, f, w, h) => { GLC.calls++; GLC.rbStorage++; GLC.texPixels += w * h; };
  gl.bufferData = (target, data) => { GLC.calls++; GLC.bufferData++; GLC.bufferBytes += data && data.byteLength || 0; };
  gl.drawElementsInstanced = (mode, count, type, offset, instances) => { GLC.calls++; GLC.draws++; GLC.instances += instances; };
  gl.drawArrays = () => { GLC.calls++; GLC.draws++; };
  return gl;
}

export async function createHarness(root, opts = {}) {
  const C = {dom: {text: 0, textSame: 0, style: 0, styleSame: 0, cls: 0, clsSame: 0, attr: 0, attrSame: 0, data: 0, dataSame: 0, html: 0, hidden: 0, hiddenSame: 0, prop: 0, propSame: 0},
    canvas2d: 0, audio: {param: 0, nodes: 0, buffers: 0, bufferSamples: 0}, storage: {set: 0, bytes: 0, maxBytes: 0}, steps: 0, lastStepDt: 0, stepDts: new Map(), gc: []};
  let virtualNow = 0;
  // ---------- DOM factice ----------
  class ClassList { constructor() { this.s = new Set(); }
    add(...c) { for (const x of c) { if (this.s.has(x)) C.dom.clsSame++; else { this.s.add(x); C.dom.cls++; } } }
    remove(...c) { for (const x of c) { if (!this.s.has(x)) C.dom.clsSame++; else { this.s.delete(x); C.dom.cls++; } } }
    toggle(c, f) { const has = this.s.has(c), want = f === undefined ? !has : !!f; if (want === has) C.dom.clsSame++; else { C.dom.cls++; want ? this.s.add(c) : this.s.delete(c); } return want; }
    contains(c) { return this.s.has(c); } }
  const recorder = kind => new Proxy({}, {set(t, k, v) { v = String(v); if (t[k] === v) C.dom[kind + 'Same']++; else { C.dom[kind]++; t[k] = v; } return true; }, get(t, k) { return k in t ? t[k] : ''; }});
  function fake2d() { const props = {}; return new Proxy(props, {get(t, k) { if (k in t) return t[k]; return () => { C.canvas2d++; }; }, set(t, k, v) { C.canvas2d++; t[k] = v; return true; }}); }
  const pending = []; const gl = fakeGL();
  class El {
    constructor(id) { this.id = id; this._t = ''; this._h = ''; this._hid = false; this._dis = false; this.style = recorder('style'); this.classList = new ClassList(); this.dataset = recorder('data'); this.attrs = {}; this.ls = {}; this.kids = {}; this.value = ''; this.title = ''; this.tabIndex = 0; this.scrollTop = 0; this.firstChild = {textContent: ''}; this.clientWidth = opts.width || 1280; this.clientHeight = opts.height || 720; this.width = 300; this.height = 150; this.tagName = 'DIV'; }
    get textContent() { return this._t; } set textContent(v) { v = String(v); if (v === this._t) C.dom.textSame++; else { C.dom.text++; this._t = v; } }
    get innerHTML() { return this._h; } set innerHTML(v) { C.dom.html++; this._h = String(v); }
    get hidden() { return this._hid; } set hidden(v) { v = !!v; if (v === this._hid) C.dom.hiddenSame++; else { C.dom.hidden++; this._hid = v; } }
    get disabled() { return this._dis; } set disabled(v) { v = !!v; if (v === this._dis) C.dom.propSame++; else { C.dom.prop++; this._dis = v; } }
    setAttribute(k, v) { v = String(v); if (this.attrs[k] === v) C.dom.attrSame++; else { C.dom.attr++; this.attrs[k] = v; } }
    getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, f) { (this.ls[t] ??= []).push(f); } removeEventListener() {}
    dispatch(t, e = {}) { for (const f of this.ls[t] || []) f({preventDefault() {}, stopPropagation() {}, target: this, ...e}); }
    focus() {} blur() {} click() { this.dispatch('click'); }
    querySelector(s) { return this.kids[s] ??= new El(this.id + '>' + s); }
    querySelectorAll(s) { return this.kids['*' + s] ??= [0, 1, 2].map(i => new El(this.id + '>' + s + i)); }
    getBoundingClientRect() { return {left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120}; }
    setPointerCapture() {} releasePointerCapture() {}
    requestPointerLock() { doc.pointerLockElement = this; pending.push(() => doc.dispatch('pointerlockchange')); return Promise.resolve(); }
    getContext(t) { if (t === '2d') return this._c2d ??= fake2d(); if (t === 'webgl2' && this.id === 'world' && opts.webgl !== false) return gl; return null; }
  }
  const els = new Map();
  const doc = {body: new El('body'), hidden: false, pointerLockElement: null, ls: {},
    getElementById(id) { let e = els.get(id); if (!e) { e = new El(id); if (id === 'world') e.tagName = 'CANVAS'; els.set(id, e); } return e; },
    addEventListener(t, f) { (this.ls[t] ??= []).push(f); }, removeEventListener() {}, dispatch(t, e = {}) { for (const f of this.ls[t] || []) f({preventDefault() {}, target: doc.getElementById('world'), ...e}); },
    exitPointerLock() { this.pointerLockElement = null; pending.push(() => doc.dispatch('pointerlockchange')); }, hasFocus() { return true; }, createElement(t) { return new El('new-' + t); }};
  const winLs = {};
  const store = new Map();
  const localStorage = {getItem: k => store.has(k) ? store.get(k) : null, removeItem: k => store.delete(k),
    setItem(k, v) { v = String(v); store.set(k, v); C.storage.set++; C.storage.bytes += v.length; C.storage.maxBytes = Math.max(C.storage.maxBytes, v.length); }};
  if (opts.prefs) store.set('ferro-settings', JSON.stringify(opts.prefs));
  // ---------- Web Audio factice ----------
  class Param { constructor() { this.value = 0; }
    setTargetAtTime() { C.audio.param++; return this; } setValueAtTime() { C.audio.param++; return this; } linearRampToValueAtTime() { C.audio.param++; return this; } exponentialRampToValueAtTime() { C.audio.param++; return this; }
    cancelScheduledValues() { C.audio.param++; return this; } cancelAndHoldAtTime() { C.audio.param++; return this; } setValueCurveAtTime() { C.audio.param++; return this; } }
  function node(kind) { C.audio.nodes++; const t = {kind, connect() {}, disconnect() {}, start() {}, stop() { if (t.onended) pending.push(() => t.onended && t.onended()); }};
    return new Proxy(t, {get(o, k) { if (k in o) return o[k]; if (typeof k !== 'string') return undefined; const p = new Param(); o[k] = p; return p; }, set(o, k, v) { o[k] = v; return true; }}); }
  class FakeAudioContext { constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = node('destination'); }
    get currentTime() { return virtualNow / 1000; }
    createGain() { return node('gain'); } createBiquadFilter() { return node('filter'); } createStereoPanner() { return node('panner'); } createDynamicsCompressor() { return node('compressor'); }
    createWaveShaper() { return node('shaper'); } createDelay() { return node('delay'); } createOscillator() { return node('osc'); } createBufferSource() { return node('source'); } createConvolver() { return node('convolver'); }
    createBuffer(ch, len, sr) { C.audio.buffers++; C.audio.bufferSamples += len * ch; const data = Array.from({length: ch}, () => new Float32Array(len)); return {length: len, duration: len / sr, sampleRate: sr, numberOfChannels: ch, getChannelData: i => data[i], copyToChannel(src, i) { data[i].set(src); }}; }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); } }
  // ---------- globaux du navigateur (domaine principal) ----------
  let raf = [];
  const G0 = globalThis;
  G0.window = G0; G0.document = doc; G0.localStorage = localStorage;
  G0.location = {search: opts.search || '', reload() {}};
  G0.matchMedia = () => ({matches: false, addEventListener() {}, addListener() {}});
  G0.innerWidth = opts.width || 1280; G0.innerHeight = opts.height || 720; G0.devicePixelRatio = opts.dpr || 2;
  G0.addEventListener = (t, f) => { (winLs[t] ??= []).push(f); }; G0.removeEventListener = () => {};
  G0.requestAnimationFrame = cb => { raf.push(cb); return raf.length; }; G0.cancelAnimationFrame = () => {};
  if (opts.audio !== false) G0.AudioContext = FakeAudioContext;
  const fakePerf = {now: () => virtualNow}, fakeDate = {now: () => 1700000000000};
  const hooks = opts.hooks || {};
  for (const n of ORDER) {
    let src = readFileSync(root + '/src/' + n + '.js', 'utf8');
    if (opts.patch?.[n]) src = opts.patch[n](src);
    if (n === 'game') {
      if (opts.probes !== false) src = wrapSource(src, GAME_PROBES, 'game.');
      const tail = src.lastIndexOf('})();');
      src = src.slice(0, tail) + 'window.__game={load,start,newRun,setMode,saveCheckpoint,renderHUD,drawRadar,models,events,preparePlay,motion,leftMotion,input,keys,switchWeapon,togglePause,result,actorMotion,get sim(){return sim},get world(){return world},get mode(){return mode},get prefs(){return prefs},get stage(){return stage},get savedRun(){return savedRun},get renderer(){return renderer},get audio(){return audio},get quality(){return quality},set fire(v){mouseFire=v},set weapon(v){selectedWeapon=v},set hudWait(v){hudWait=v}};\n' + src.slice(tail);
      vm.runInThisContext('(function(performance,Date){' + src + '\n})', {filename: 'game.js'})(fakePerf, fakeDate);
      continue;
    }
    if (n === 'simulation' && opts.simProbes !== false && opts.probes !== false) src = wrapSource(src, opts.simProbeNames || SIM_PROBES, 'sim:', false);
    if (n === 'destruction' && opts.simProbes !== false && opts.probes !== false) src = wrapSource(src, DES_PROBES, 'des:', false);
    vm.runInThisContext(src, {filename: n + '.js'});
    if (opts.probes === false) { if (n === 'simulation') { const create = FSimulation.create; FSimulation.create = (...a) => { const sim = create(...a), step = sim.step; sim.step = (dt, input) => { C.steps++; C.lastStepDt = dt; return step(dt, input); }; return sim; }; } continue; }
    if (n === 'simulation') {
      const create = FSimulation.create, idStep = pid('sim.step'), idSnap = pid('sim.snapshot'), idCreate = pid('sim.create'), idRestore = pid('sim.restore');
      FSimulation.create = (...a) => { const t = __enter(); let sim; try { sim = create(...a); } finally { __leave(idCreate, t); }
        const step = sim.step, snap = sim.snapshot, restore = sim.restore;
        sim.step = (dt, input) => { C.steps++; C.lastStepDt = dt; const t = __enter(); try { return step(dt, input); } finally { __leave(idStep, t); } };
        sim.snapshot = (...b) => { const t = __enter(); try { return snap(...b); } finally { __leave(idSnap, t); } };
        if (restore) sim.restore = (...b) => { const t = __enter(); try { return restore(...b); } finally { __leave(idRestore, t); } };
        return sim; };
    }
    if (n === 'world') { FWorld.create = wrapFn('world.create', FWorld.create); }
    if (n === 'renderer') {
      const create = FRender.create;
      FRender.create = canvas => { const t = __enter(); let r; try { r = create(canvas); } finally { __leave(pid('render.create'), t); }
        for (const k of ['draw', 'updateWorld', 'setWorld', 'resize']) r[k] = wrapFn('render.' + k, r[k]); hooks.renderer?.(r); return r; };
    }
    if (n === 'soundscape') { const create = FSoundscape.create; FSoundscape.create = () => { const s = create(); for (const k of ['sample', 'event']) s[k] = wrapFn('soundscape.' + k, s[k]); return s; }; }
    if (n === 'effects') { FEffects.build = wrapFn('fx.build', FEffects.build); FEffects.lights = wrapFn('fx.lights', FEffects.lights); }
    if (n === 'actors') { FActors.build = wrapFn('actors.build', FActors.build); }
    if (n === 'motion') { const create = FMotion.create; FMotion.create = () => { const m = create(); m.update = wrapFn('motion.update', m.update); return m; }; }
    if (n === 'audio') { const create = FAudio.create, id = pid('audio');
      FAudio.create = () => { const a = create(); hooks.audio?.(a);
        for (const k of Object.keys(a)) if (typeof a[k] === 'function') { const f = a[k], idk = opts.audioDetail ? pid('audio.' + k) : id; a[k] = function (...b) { const t = __enter(); try { return f.apply(a, b); } finally { __leave(idk, t); } }; } return a; }; }
    if (n === 'music' && globalThis.FMusic?.warmup) { FMusic.warmup = wrapFn('music.warmup', FMusic.warmup); }
  }
  const G = G0.__game, canvas = doc.getElementById('world');
  // ---------- GC ----------
  const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) C.gc.push({start: e.startTime, ms: e.duration, kind: e.detail?.kind ?? e.kind}); });
  obs.observe({entryTypes: ['gc']});
  function flush() { while (pending.length) pending.shift()(); }
  function frame(now) { virtualNow = now; flush(); const q = raf; raf = []; for (const cb of q) cb(now); flush(); }
  const key = (type, code, repeat = false) => { for (const f of winLs[type] || []) f({code, repeat, metaKey: false, altKey: false, ctrlKey: false, preventDefault() {}, target: {tagName: 'CANVAS'}}); };
  const mouse = {move(dx, dy) { doc.dispatch('mousemove', {movementX: dx, movementY: dy}); },
    down(button = 0) { canvas.dispatch('mousedown', {button}); }, up(button = 0) { for (const f of winLs.mouseup || []) f({button}); }};
  async function settle(n = 4) { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); }
  // Vrai bouton « start » : preparePlay complet (FMusic.warmup, audio.prepare, brain.prepare), puis mode playing.
  async function startGame(id = 'start', maxFrames = 6000) {
    const log = [];
    doc.getElementById(id).click();
    for (let i = 0; i < maxFrames && G.mode !== 'playing'; i++) { const t = cpuNow(); frame(virtualNow + 16.667); log.push(cpuNow() - t); await new Promise(r => setTimeout(r, 0)); await settle(2); }
    if (G.mode !== 'playing') throw new Error('start failed, mode=' + G.mode);
    return log;
  }
  const heap = () => v8.getHeapStatistics().used_heap_size;
  return {C, G, doc, canvas, gl, frame, key, mouse, startGame, settle, store, heap, obs, winLs, get now() { return virtualNow; }, set now(v) { virtualNow = v; }};
}

export function dist(a) {
  const s = Float64Array.from(a).sort(), q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))], n = s.length;
  let sum = 0, o4 = 0, o8 = 0, o16 = 0; for (const v of s) { sum += v; if (v > 4) o4++; if (v > 8) o8++; if (v > 16.7) o16++; }
  return {n, avg: +(sum / Math.max(1, n)).toFixed(3), p50: +q(.5).toFixed(3), p95: +q(.95).toFixed(3), p99: +q(.99).toFixed(3), p999: +q(.999).toFixed(3), max: +(s[n - 1] || 0).toFixed(2), over4: o4, over8: o8, over16: o16};
}
