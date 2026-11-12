// RGPU : montre la réaffectation du créneau de lumière 1 (facteur .27 dans le shader, ligne 316)
// quand une lumière transitoire (explosion, roquette, trophée) apparaît. Faux contexte WebGL2.
// Usage : node slot1.mjs <racine-ferro> <scene.json>
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const [root, scenePath] = process.argv.slice(2);
const frames = JSON.parse(readFileSync(scenePath, 'utf8'));
const U = {};
const gl = new Proxy({FRAMEBUFFER_COMPLETE: 0x8CD5, getShaderParameter: () => true, getProgramParameter: () => true, checkFramebufferStatus: () => 0x8CD5,
  getUniformLocation: (p, name) => ({name}), uniform3fv: (l, d) => { if (l) U[l.name] = Array.from(d); }, uniform1i: (l, v) => { if (l) U[l.name] = v; },
  createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}), createRenderbuffer: () => ({}), createVertexArray: () => ({}), getExtension: () => null},
  {get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 0x8000 + k.length; return () => {}; }});
const canvas = {width: 300, height: 150, clientWidth: 1440, clientHeight: 932, getContext: () => gl, addEventListener() {}, removeEventListener() {}};
const ctx = {window: {devicePixelRatio: 2, innerWidth: 1440, innerHeight: 932}, performance, console, Math, Date}; vm.createContext(ctx);
for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
const {FWorld, FSimulation, FBrain, FRender} = ctx.window;
const world = FWorld.create(96, 0, {campaign: true, campaignVersion: 2});
const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})});
const r = FRender.create(canvas); r.resize('auto'); r.setWorld(sim.destruction?.meshes || world.meshes, sim.destruction?.lights || world.lights, world.environment);
const slots = () => { const p = U.uLightPosition, c = U.uLightColor, out = []; for (let i = 0; i < U.uLightCount; i++) out.push({p: p.slice(i * 3, i * 3 + 3).map(v => +v.toFixed(2)), c: +Math.max(...c.slice(i * 3, i * 3 + 3)).toFixed(2)}); return out; };
let moved = 0, checked = 0, sample = null; const lampD = [];
for (const f of frames) {
  const fx = Object.assign({}, f.fx, {adaptive: false, lights: []});
  r.draw(f.camera, f.dynamic, fx); const a = slots();
  const e = f.camera.pos, fw = [Math.sin(f.camera.yaw), 0, -Math.cos(f.camera.yaw)];
  r.draw(f.camera, f.dynamic, {...fx, lights: [{p: [e[0] + fw[0] * 6, e[1], e[2] + fw[2] * 6], power: 20, range: 12, color: [1, .4, .1]}]}); const b = slots();
  lampD.push(Math.hypot(...a[0].p.map((v, k) => v - f.camera.pos[k])));
  checked++; const key = JSON.stringify(a[1].p), j = b.findIndex(s => JSON.stringify(s.p) === key);
  if (j >= 2) { moved++; if (!sample) { const eye = e, d = Math.hypot(...a[1].p.map((v, k) => v - eye[k])); sample = {sansTransitoire: a.slice(0, 3), avecTransitoire: b.slice(0, 3), lumiereSlot1Devient: j, distanceOeil: +d.toFixed(1), facteurAvant: .27, facteurApres: .13, variationAuPixelProche: '-52 %'}; } }
}
lampD.sort((x, y) => x - y);
console.log(JSON.stringify({images: checked, slot1Deplace: moved, exemple: sample, distanceLampeOmbree: {min: +lampD[0].toFixed(1), mediane: +lampD[lampD.length >> 1].toFixed(1), max: +lampD[lampD.length - 1].toFixed(1)}, ombreLampeHorsPortee32m: lampD.filter(d => d > 32).length}));
