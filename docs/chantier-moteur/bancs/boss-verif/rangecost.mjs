// Coût CPU réel de renderer.draw() (faux contexte GL / 2D, comme les tests du dépôt) dans l'arène,
// avec et sans la zone de vue longue (longViewZones), par qualité. Mesure : stats du renderer + temps médian.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load} from '../boss/lib.mjs';
const root = process.argv[2], source = readFileSync(root + '/src/renderer.js', 'utf8');
function fakeGL() {
  let serial = 0;
  const gl = new Proxy({FRAMEBUFFER_COMPLETE: 36053, COLOR_BUFFER_BIT: 16384, DEPTH_BUFFER_BIT: 256}, {get(t, name) {
    if (name in t) return t[name]; if (typeof name === 'string' && /^[A-Z_0-9]+$/.test(name)) return name;
    return (...a) => { if (typeof name === 'string' && name.startsWith('create')) return {kind: name, id: ++serial};
      if (name === 'getUniformLocation') return {name: a[1]}; if (name === 'getShaderParameter' || name === 'getProgramParameter') return true; if (name === 'checkFramebufferStatus') return 36053; };
  }});
  const canvas = {width: 960, height: 600, clientWidth: 960, clientHeight: 600, getContext: () => gl, addEventListener() {}, removeEventListener() {}};
  const scope = {window: {innerWidth: 960, innerHeight: 600, devicePixelRatio: 1}, performance}; vm.runInNewContext(source, scope);
  return scope.window.FRender.create(canvas);
}
function fake2D() {
  const gradient = {addColorStop() {}};
  const ctx = new Proxy({}, {get(t, name) { if (name in t) return t[name]; return (...a) => (typeof name === 'string' && name.startsWith('create') ? gradient : undefined); }, set(t, n, v) { t[n] = v; return true; }});
  const canvas = {width: 960, height: 600, clientWidth: 960, clientHeight: 600, getContext: k => (k === '2d' ? ctx : null)};
  const scope = {window: {innerWidth: 960, innerHeight: 600, devicePixelRatio: 1}, performance}; vm.runInNewContext(source, scope);
  return scope.window.FRender.create(canvas);
}
const W = load(root), out = [];
for (const index of [0, 1, 2]) {
  const world = W.FWorld.create(96, index, {campaign: true, campaignVersion: 2}), A = world.bossArena;
  const scale = [5.4, 7.2, 9][index % 3], coreY = A.y + 1.93 * scale, eye = [A.x - 15, A.y + 1.62, A.z];
  const pitchCore = Math.atan2(coreY - eye[1], 15 - .9 * scale);
  for (const backend of ['webgl', 'canvas2d']) for (const quality of ['low', 'medium', 'high']) for (const long of [true, false]) for (const look of ['core', 'level']) {
    const r = backend === 'webgl' ? fakeGL() : fake2D();
    const env = long ? world.environment : {...world.environment, longViewZones: []};
    r.setWorld(world.meshes, world.lights, env); r.resize(quality);
    const camera = {pos: eye, yaw: Math.PI / 2, pitch: look === 'core' ? pitchCore : 0, fov: 74};
    const times = [];
    for (let k = 0; k < 25; k++) { const t0 = performance.now(); r.draw(camera, [], {time: 1 + k / 60, adaptive: false}); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b); const st = r.stats;
    out.push({index, backend, quality, long, look, viewDistance: +(st.viewDistance ?? 0).toFixed(0), staticVisible: st.staticVisible, instances: st.instances, drawCalls: st.drawCalls, triangles: st.triangles, medMs: +times[12].toFixed(2), p80: +times[20].toFixed(2)});
  }
}
for (const r of out) console.log(JSON.stringify(r));
