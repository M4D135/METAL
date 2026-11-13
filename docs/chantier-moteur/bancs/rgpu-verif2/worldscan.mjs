// RGPU-verif : analyse indépendante (faux WebGL2, aucun GPU) des créneaux de lumière et des ombres
// sur des trajets de marche simulés dans plusieurs mondes de campagne.
// Usage : node worldscan.mjs <racine-ferro> [indices=0,4,9,13,17] [pas=900]
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const [root, idxArg = '0,4,9,13,17', stepsArg = '900'] = process.argv.slice(2);
const indices = idxArg.split(',').map(Number), STEPS = +stepsArg;
const U = {};
function makeGL() {
  return new Proxy({FRAMEBUFFER_COMPLETE: 0x8CD5, getShaderParameter: () => true, getProgramParameter: () => true, checkFramebufferStatus: () => 0x8CD5,
    getUniformLocation: (p, name) => ({name}), uniform3fv: (l, d) => { if (l) U[l.name] = Array.from(d); }, uniform1i: (l, v) => { if (l) U[l.name] = v; }, uniform4f: (l, a, b, c, d) => { if (l) U[l.name] = [a, b, c, d]; },
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}), createRenderbuffer: () => ({}), createVertexArray: () => ({}), getExtension: () => null},
  {get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 0x8000 + k.length; return () => {}; }});
}
const out = [];
for (const idx of indices) {
  const ctx = {window: {devicePixelRatio: 2, innerWidth: 1440, innerHeight: 932}, performance, console, Math, Date}; vm.createContext(ctx);
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), ctx, {filename: n + '.js'});
  const {FWorld, FSimulation, FBrain, FRender} = ctx.window;
  const world = FWorld.create(96, idx, {campaign: true, campaignVersion: 2});
  const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})});
  const canvas = {width: 300, height: 150, clientWidth: 1440, clientHeight: 932, getContext: () => makeGL(), addEventListener() {}, removeEventListener() {}};
  const r = FRender.create(canvas); r.resize('auto');
  const meshes = sim.destruction?.meshes || world.meshes, lights = sim.destruction?.lights || world.lights;
  r.setWorld(meshes, lights, world.environment);
  const env = world.environment;
  // Part des maillages intérieurs (même règle que outdoorMesh du renderer : mat>=8 ou zone extérieure).
  const outdoorAt = p => !!env && env.outdoorZones.some(z => Math.abs(p[0] - z.x) <= z.w * .5 + .08 && Math.abs(p[2] - z.z) <= z.d * .5 + .08);
  let indoor = 0; for (const m of meshes) { const o = m.outdoor === undefined ? ((m.mat || 0) >= 8 || outdoorAt(m.p || [0, 0, 0])) : !!m.outdoor; if (!o) indoor++; }
  const input = {moveX: 0, moveY: 1, lookX: 0, lookY: 0, fire: false, fireLeft: false, dash: false, sprint: true};
  let prevSlot1 = null, swaps = 0, frames = 0, eyeInside = 0, prevShadow = null, shadowSwaps = 0;
  const lampD = [], slot1D = [], nearestOrdinaryInSpec = {kept: 0, lost: 0};
  const key = a => a ? a.map(v => v.toFixed(2)).join(',') : '';
  for (let s = 0; s < STEPS; s++) {
    input.lookX = Math.sin(s * .013) * .018 + (s % 240 < 40 ? .03 : 0);
    try { sim.step(1 / 60, input); } catch (e) { break; }
    if (s % 3) continue;
    const p = sim.state.player; if (!p || p.hp <= 0) break;
    const camera = {pos: [p.x, (p.y || 0) + 1.62, p.z], yaw: p.yaw, pitch: p.pitch || 0, fov: 74};
    if (!outdoorAt(camera.pos)) eyeInside++;
    r.actorFilter(camera, {shadows: true});
    r.draw(camera, [], {time: s / 60, adaptive: false, lights: []});
    const n = U.uLightCount, P = U.uLightPosition, C = U.uLightColor;
    const slot = i => i < n ? P.slice(i * 3, i * 3 + 3) : null;
    const s0 = slot(0), s1 = slot(1);
    frames++;
    if (prevSlot1 !== null && key(s1) !== prevSlot1) swaps++;
    prevSlot1 = key(s1);
    if (prevShadow !== null && key(s0) !== prevShadow) shadowSwaps++;
    prevShadow = key(s0);
    if (s0) lampD.push(Math.hypot(s0[0] - camera.pos[0], s0[1] - camera.pos[1], s0[2] - camera.pos[2]));
    if (s1) slot1D.push(Math.hypot(s1[0] - camera.pos[0], s1[1] - camera.pos[1], s1[2] - camera.pos[2]));
    // Avec 3 transitoires à 6-9 m : la lumière ordinaire la plus proche garde-t-elle un créneau < 4 (GGX de spec4) ?
    const fw = [Math.sin(p.yaw), 0, -Math.cos(p.yaw)], e = camera.pos;
    const tl = [6, 7.5, 9].map(d => ({p: [e[0] + fw[0] * d, e[1] + .5, e[2] + fw[2] * d], power: 20, range: 12, color: [1, .4, .1]}));
    const nearKey = key(s1);
    r.draw(camera, [], {time: s / 60, adaptive: false, lights: tl});
    const n2 = U.uLightCount, P2 = U.uLightPosition; let j = -1;
    for (let i = 0; i < n2; i++) if (key(P2.slice(i * 3, i * 3 + 3)) === nearKey) j = i;
    if (j >= 0 && j < 4) nearestOrdinaryInSpec.kept++; else nearestOrdinaryInSpec.lost++;
  }
  const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(b.length * p))].toFixed(1) : null; };
  out.push({idx, biome: env?.biome, meshes: meshes.length, indoorMeshShare: +(indoor / meshes.length).toFixed(3), lights: lights.length, lightsWithRange: lights.filter(l => l.range > 0).length,
    frames, eyeIndoorShare: +(eyeInside / Math.max(1, frames)).toFixed(2), slot1Swaps: swaps, slot1SwapsPerMin: +(swaps / (frames * 3 / 60 / 60)).toFixed(1), shadowLampSwaps: shadowSwaps,
    shadowLampDist: {p10: q(lampD, .1), med: q(lampD, .5), p90: q(lampD, .9)}, shadowLampBeyond31m: +(lampD.filter(d => d > 31).length / Math.max(1, lampD.length)).toFixed(2),
    slot1Dist: {p10: q(slot1D, .1), med: q(slot1D, .5)}, nearestOrdinaryWith3Transients: nearestOrdinaryInSpec});
}
for (const o of out) console.log(JSON.stringify(o));
