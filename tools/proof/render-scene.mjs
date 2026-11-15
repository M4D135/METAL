// Preuve de rendu — lot 05. Charge les sources locales dans le domaine principal
// de Node, pilote une vraie partie sur un faux WebGL2 enregistreur, et rend un
// empreinte du flux de commandes GL plus les coûts de draw() et models().
// Hors `npm test`, hors budget de taille, sans dépendance ni réseau.
import {existsSync, readFileSync} from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const CONSTS = ('TEXTURE_2D FRAMEBUFFER ARRAY_BUFFER DEPTH_TEST CULL_FACE TRIANGLES STATIC_DRAW ' +
  'RENDERBUFFER POLYGON_OFFSET_FILL TEXTURE0 TEXTURE1 TEXTURE2 FLOAT DEPTH_BUFFER_BIT UNSIGNED_BYTE ' +
  'RGBA8 RGBA NONE NEAREST LINEAR ELEMENT_ARRAY_BUFFER DYNAMIC_DRAW DEPTH_COMPONENT24 DEPTH_ATTACHMENT ' +
  'COLOR_ATTACHMENT0 CLAMP_TO_EDGE BLEND VERTEX_SHADER UNSIGNED_SHORT UNSIGNED_INT TEXTURE_WRAP_T ' +
  'TEXTURE_WRAP_S TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER SRC_ALPHA ONE_MINUS_SRC_ALPHA LINK_STATUS ' +
  'LEQUAL FRAGMENT_SHADER DEPTH_COMPONENT COLOR_BUFFER_BIT BACK COMPILE_STATUS STREAM_DRAW ' +
  'DEPTH_COMPONENT16 FRAMEBUFFER_COMPLETE MAX_RENDERBUFFER_SIZE MAX_TEXTURE_SIZE RGB10_A2 UNSIGNED_INT_2_10_10_10_REV ONE').split(' ');

const TYPED = new Set(['Float32Array','Uint16Array','Uint32Array','Uint8Array','Int32Array','Float64Array','Uint8ClampedArray']);

function serialize(value, out) {
  if (value === null) { out.push('N'); return; }
  const t = typeof value;
  if (t === 'number') { out.push(Object.is(value, -0) ? 'f-0' : 'f' + value); return; }
  if (t === 'string') { out.push('s' + value); return; }
  if (t === 'boolean') { out.push('b' + (value ? 1 : 0)); return; }
  if (t === 'undefined') { out.push('u'); return; }
  if (ArrayBuffer.isView(value)) {
    const b = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    out.push('a' + value.constructor.name + ':' + b.toString('hex'));
    return;
  }
  if (value instanceof ArrayBuffer) { out.push('A' + Buffer.from(value).toString('hex')); return; }
  if (Array.isArray(value)) { out.push('['); for (const v of value) serialize(v, out); out.push(']'); return; }
  if (value.__glid !== undefined) { out.push('o' + value.__glid); return; }
  out.push('?' + (value && value.name ? value.name : Object.prototype.toString.call(value)));
}

export function makeGL(recorder, {reuse = false} = {}) {
  const gl = {drawingBufferWidth:0,drawingBufferHeight:0}; let serial = 100, constant = 1000;
  for (const k of CONSTS) gl[k] = ++constant;
  gl.FRAMEBUFFER_COMPLETE = 36053; gl.COLOR_BUFFER_BIT = 16384; gl.DEPTH_BUFFER_BIT = 256;
  const obj = kind => ({__glid: ++serial, kind});
  const pool = new Map(), locations = new Map();
  const reused = (kind, key) => { let o = pool.get(key); if (!o) { o = obj(kind); pool.set(key, o); } return o; };
  const NAMES = ('activeTexture attachShader bindBuffer bindFramebuffer bindRenderbuffer bindTexture ' +
    'bindVertexArray blendFunc bufferData bufferSubData checkFramebufferStatus clear clearColor compileShader ' +
    'createBuffer createFramebuffer createProgram createRenderbuffer createShader createTexture ' +
    'createVertexArray cullFace deleteBuffer deleteFramebuffer deleteProgram deleteRenderbuffer deleteShader ' +
    'deleteTexture deleteVertexArray depthFunc depthMask disable drawArrays drawBuffers drawElementsInstanced ' +
    'enable enableVertexAttribArray framebufferRenderbuffer framebufferTexture2D getExtension getParameter ' +
    'getProgramInfoLog getProgramParameter getShaderInfoLog getShaderParameter getUniformLocation isContextLost ' +
    'linkProgram polygonOffset readBuffer readPixels renderbufferStorage shaderSource texImage2D texParameteri ' +
    'texSubImage2D uniform1f uniform1fv uniform1i uniform2f uniform2i uniform3f uniform3fv uniform4f ' +
    'uniformMatrix4fv useProgram vertexAttribDivisor vertexAttribPointer viewport uniform4fv blendFuncSeparate').split(' ');
  for (const name of NAMES) {
    gl[name] = (...args) => {
      recorder.record(name, args, gl);
      if (name.startsWith('create')) return obj(name);
      // Un vrai pilote ne cree pas un objet JavaScript par emplacement d'uniforme : sans
      // reutilisation, le faux pilote allouait plus que le moteur et faussait le banc GC.
      if (name === 'getUniformLocation') return reuse ? reused('uniformLocation', (args[0] && args[0].__glid) + ':' + args[1]) : {__glid: 'u' + serial + ':' + args[1]};
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return true;
      if (name === 'checkFramebufferStatus') return 36053;
      if (name === 'getExtension') return null;
      if (name === 'isContextLost') return false;
      if (name === 'getParameter') return 4096;
      if (name === 'getShaderInfoLog' || name === 'getProgramInfoLog') return '';
      return undefined;
    };
  }
  return gl;
}

export function verifyGL(gl, root) {
  const src = readFileSync(root + '/src/renderer.js', 'utf8');
  const missing = new Set();
  for (const m of src.matchAll(/gl\.([A-Za-z_][A-Za-z0-9_]*)/g)) if (!(m[1] in gl)) missing.add(m[1]);
  if (missing.size) throw new Error('faux WebGL2 incomplet: ' + [...missing].join(', '));
}

function compte(state, name, args, gl) {
  state.calls++;
  if (name === 'drawElementsInstanced') { state.draws++; state.instances += args[4] || 0; state.triangles += (args[1] || 0) / 3 * (args[4] || 0); }
  else if (name === 'drawArrays') state.draws++;
  else if (name === 'bufferData') { state.bufferData++; state.bufferBytes += args[1] && args[1].byteLength || 0; }
  else if (name === 'bufferSubData') { state.subData++; state.subBytes += args[2] && args[2].byteLength || 0; }
  else if (name.startsWith('uniform')) state.uniforms++;
  else if (name === 'texImage2D') state.texImage++;
  else if (name === 'texSubImage2D') state.texSubImage++;
  else if (name === 'createProgram') state.programs++;
  else if (name === 'createShader') state.shaders++;
  else if (name === 'createBuffer') state.buffers++;
  else if (name === 'createVertexArray') state.vaos++;
  else if (name === 'createTexture') state.textures++;
  if (name === 'bindBuffer') { if (args[0] === gl.ARRAY_BUFFER) state.boundArray = args[1]; }
}

// Enregistreur muet : ne compte que les appels, sans sérialiser les arguments ni hasher.
// Pour les bancs qui mesurent l'allocation du chemin de rendu : la sérialisation du
// traceur (Buffer.from(...).toString('hex') sur chaque tampon) noierait la mesure sous
// des mégaoctets par image qui n'appartiennent pas au moteur.
export function makeCountingRecorder() {
  const state = {calls: 0, draws: 0, instances: 0, triangles: 0, bufferData: 0, bufferBytes: 0, subData: 0, subBytes: 0, uniforms: 0, texImage: 0, texSubImage: 0, programs: 0, shaders: 0, buffers: 0, vaos: 0, textures: 0, contentDraws: 0, contentLen: 0, boundArray: null};
  return {state, frames: [], record(name, args, gl) { compte(state, name, args, gl); },
    digest() { return 'muet'; }, contentDigest() { return 'muet'; }};
}

export function makeRecorder({content = true} = {}) {
  const hash = crypto.createHash('sha256');
  const contentHash = crypto.createHash('sha256');
  const out = [], frames = [];
  // Contenu réellement présent dans le tampon d'instances à chaque dessin :
  // rend la preuve indépendante de la stratégie de téléversement (bufferData / bufferSubData / capacité).
  const contents = new Map();
  const attribs = new Map();
  let boundArray = null;
  let stopped = false;
  const state = {calls: 0, draws: 0, instances: 0, triangles: 0, bufferData: 0, bufferBytes: 0, subData: 0, subBytes: 0, uniforms: 0, texImage: 0, texSubImage: 0, programs: 0, shaders: 0, buffers: 0, vaos: 0, textures: 0, contentDraws: 0, contentLen: 0, boundArray: null};
  return {
    state,
    record(name, args, gl) {
      if (stopped) return;
      compte(state, name, args, gl);
      const boundArray = state.boundArray;
      if (content && name === 'bufferData') {
        if (ArrayBuffer.isView(args[1])) contents.set(boundArray, Array.from(args[1]));
        else contents.delete(boundArray);
      } else if (content && name === 'bufferSubData' && ArrayBuffer.isView(args[2])) {
        const target = contents.get(boundArray) || [];
        const source = args[2], start = args[0] === gl.ARRAY_BUFFER ? args[1] / 4 : 0;
        for (let i = 0; i < source.length; i++) target[start + i] = source[i];
        contents.set(boundArray, target);
      } else if (name === 'vertexAttribPointer') attribs.set(args[0], args[5]);
      else if (content && name === 'drawElementsInstanced') {
        const rows = contents.get(boundArray), base = (attribs.get(2) || 0) / 4, count = (args[4] || 0) * 16;
        out.length = 0;
        out.push('D', args[1], args[3], args[4], ':');
        state.contentDraws++;frames.push(args[1]+'@'+args[4]+'|'+(rows?rows.slice(base,base+count).sort().join(','):'!'));if(rows&&rows.length)state.contentLen=(state.contentLen||0)+rows.length;out.push(rows?rows.slice(base, base + count).join(","):"!");
        contentHash.update(out.join(''));
      }
      out.length = 0;
      out.push(name, '(');
      serialize(args, out);
      hash.update(out.join(','));
    },
    frames,
    digest() { stopped = true; return hash.digest('hex'); },
    contentDigest() { stopped = true; return contentHash.digest('hex'); },
  };
}

export function loadModules(root, names = ['fmath', 'renderer', 'passages', 'world', 'destruction', 'economy', 'brain', 'simulation', 'actors', 'effects', 'motion'], sources = {}) {
  const win = {innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2};
  for (const n of names) {
    // The historical comparison root predates FPassages; current worlds require it.
    if (n === 'passages' && sources[n] === undefined && !existsSync(root + '/src/passages.js')) continue;
    const src = sources[n] ?? readFileSync(root + '/src/' + n + '.js', 'utf8');
    vm.runInThisContext('(function(window){' + src + '\n})', {filename: n + '.js'})(win);
  }
  return win;
}

export function loadModels(root, env) {
  const lines = readFileSync(root + '/src/game.js', 'utf8').split('\n');
  const find = (needle, from = 0) => { const i = lines.findIndex((l, k) => k >= from && l.includes(needle)); if (i < 0) throw new Error('game.js: ancre absente: ' + needle); return i; };
  const mLine = find('const m=(shape,p,s,mat');
  const start = find('function systemsReady()', mLine);
  const end = find('function renderHUD', start);
  const body = [lines[mLine], ...lines.slice(start, end)].join('\n');
  const factory = vm.runInThisContext('(function(env){let {sim,world,quality,renderer,actorMotion,systemMotion,motion,leftMotion,prefs,clamp,FMotion,FActors,FEffects,FRender,window,innerWidth,innerHeight}=env;let shieldLift=0,renderState=null;const impactMarks=[];\n' + body + '\nreturn {models};})', {filename: 'game-models.js'});
  return factory(env);
}

function fakeCanvas(gl, ctx2d) {
  return {width: 300, height: 150, clientWidth: 1280, clientHeight: 720,
    getContext: kind => ctx2d ? (kind === '2d' ? ctx2d : null) : gl,
    addEventListener() {}, removeEventListener() {}};
}

function fakeContext2D(recorder) {
  const gradient = {addColorStop(...args) { recorder.record('colorStop', args); }};
  return new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name === 'symbol') return undefined;
      return (...args) => { recorder.record(String(name), args); return String(name).startsWith('create') ? gradient : undefined; };
    },
    set(target, name, value) { recorder.record('set:' + String(name), [value === gradient ? 'gradient' : value]); target[name] = value; return true; },
  });
}

export function makeScene(root, {world: spec = ['camp', 6], seed = 96, quality = 'auto', canvas2d = false, content = true, record = true, sources = {}} = {}) {
  const win = loadModules(root, undefined, sources);
  const {FWorld, FSimulation, FBrain, FRender, FActors, FEffects, FMotion} = win;
  const world = spec[0] === 'camp' ? FWorld.create(seed, spec[1], {campaign: true, campaignVersion: 2}) : FWorld.create(seed, spec[1]);
  let brain = null; try { brain = FBrain.create({mode: 'cpu'}); } catch {}
  const sim = FSimulation.create(world, {armorSystem: true, ...(brain ? {brain} : {})});
  sim.setDifficulty?.(0);
  const recorder = record ? makeRecorder({content}) : makeCountingRecorder();
  const gl = canvas2d ? null : makeGL(recorder, {reuse: !record});
  if (gl) verifyGL(gl, root);
  const ctx2d = canvas2d ? fakeContext2D(recorder) : null;
  const canvas = fakeCanvas(gl, ctx2d);
  const renderer = FRender.create(canvas);
  renderer.resize(quality);
  renderer.setWorld(sim.destruction?.meshes || world.meshes, sim.destruction?.lights || world.lights, world.environment);
  let renderRevision = sim.state.destructionRevision ?? sim.destruction?.revision ?? -1;
  const motion = FMotion.create(), leftMotion = FMotion.create();
  const actorMotion = new Map(), systemMotion = new Map();
  const prefs = {shadows: true, bloom: true, fov: 74};
  const s = sim.state;
  const game = loadModels(root, {sim, world, quality, renderer, actorMotion, systemMotion, motion, leftMotion, prefs,
    clamp: FSimulation.clamp, FMotion, FActors, FEffects, FRender: win.FRender, window: {FEffects}, innerWidth: 1280, innerHeight: 720});
  if (s.inventory?.weapons) { s.inventory.weapons.fill(true); if (s.inventory.ammo) s.inventory.ammo = s.inventory.ammo.map((v, i) => [180, 36, 12, 16, 200][i] ?? v); }
  const input = {moveX: 0, moveY: 1, lookX: 0, lookY: 0, fire: false, fireLeft: false, dash: false, pulse: false, melee: false, interact: false, weapon: 0, sprint: true, assist: false};
  const stops = [...(world.enemies || []).map(e => [e.x, e.z]), ...(world.cores || []).map(c => [c.x, c.z]), [world.exit.x, world.exit.z]];
  const route = []; { let cur = [world.spawn.x, world.spawn.z]; const left = stops.slice();
    while (left.length) { let bi = 0, bd = Infinity; for (let k = 0; k < left.length; k++) { const d = Math.hypot(left[k][0] - cur[0], left[k][1] - cur[1]); if (d < bd) { bd = d; bi = k; } } cur = left.splice(bi, 1)[0]; route.push(cur); } }
  let leg = 0, frameIndex = 0;
  const out = {win, world, sim, renderer, game, recorder, state: recorder.state, input, motion, actorMotion, systemMotion, route};
  out.syncDestruction = () => {
    const d = sim.destruction, revision = s.destructionRevision ?? d?.revision;
    if (!d || revision === renderRevision) return false;
    renderer.updateWorld(d.meshes, revision, d.lights); renderRevision = revision; return true;
  };
  out.frame = (dt = 1 / 60, {god = true, tour = true, speed = 7, sweep = 45, time = false} = {}) => {
    const cpuNow = () => { const u = process.cpuUsage(); return () => { const d = process.cpuUsage(u); return (d.user + d.system) / 1000; }; };
    const i = frameIndex++;
    if (tour) {
      const p = s.player, w = route[leg % route.length], dx = w[0] - p.x, dz = w[1] - p.z, d = Math.hypot(dx, dz);
      if (d < 1.5) leg++; else { const k = Math.min(1, speed * dt / d); p.x += dx * k; p.z += dz * k; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y; }
      input.moveX = 0; input.moveY = 0; input.sprint = false; input.fire = (i % 30) < 12; input.dash = false; input.weapon = [0, 2, 1, 3][Math.floor(i / 300) % 4];
      p.yaw = Math.atan2(dx, -dz) + Math.sin(i / sweep) * .9; p.pitch = Math.sin(i / 70) * .12;
    } else {
      input.moveX = Math.sin(i / 90); input.moveY = 1; input.fire = (i % 20) < 6; input.dash = (i % 240) === 0;
      input.weapon = [0, 2, 1, 3][Math.floor(i / 300) % 4]; input.sprint = true; s.player.yaw += 0.01; s.player.pitch = Math.sin(i / 70) * .12;
    }
    sim.step(dt, input); input.lookX = input.lookY = 0; input.dash = false;
    for (const e of s.events || []) { if (e.name === 'shot' || e.name === 'fracture') motion.impulse(e.name === 'shot' ? 'shot' : 'fracture'); }
    if (god && s.player.hp < 50) s.player.hp = 100;
    out.syncDestruction();
    for (const e of s.enemies) {
      const scale = e.type === 3 ? Math.max(1, Number(e.bossScale) || 1) : 1;
      if (e.deployed === false || e.hp <= 0 || (e.type !== 1 && e.type !== 2 && e.type !== 3) || (e.x - s.player.x) ** 2 + (e.z - s.player.z) ** 2 > (scale > 1 ? 140 : 40) ** 2) { actorMotion.delete(e.id); continue; }
      const pose = actorMotion.get(e.id) || {phase: e.id * .7, blend: 0};
      pose.phase = (pose.phase + (e.moveSpeed || 0) * dt * 4.8 / scale) % (Math.PI * 2);
      pose.blend += (Math.min(1, (e.moveSpeed || 0) / .9) - pose.blend) * (1 - Math.exp(-dt * 15));
      actorMotion.set(e.id, pose);
    }
    const p = s.player, signals = {time: s.time, lookYaw: .6, lookPitch: 0, firing: input.fire};
    const view = motion.update(dt, s.locomotion || {}, signals, true);
    leftMotion.update(dt, s.locomotion || {}, {...signals, firing: false}, true);
    const camera = {pos: [p.x, (p.y || 0) + 1.62 + view.height, p.z], yaw: p.yaw, pitch: p.pitch, roll: view.roll, fov: prefs.fov + view.fov};
    const tModels = time ? cpuNow() : null;
    const dynamic = game.models(s.time, true, camera);
    const modelsMs = tModels ? tModels() : 0;
    const lights = FEffects.lights(s);
    const fx = {time: s.time, flash: Math.max(s.flash || 0, s.leftFlash || 0), lights, damage: s.damage, pulse: 0, shake: 0, frameMs: 16.7, shadows: prefs.shadows, bloom: prefs.bloom, horror: s.director, adaptive: false};
    const tDraw = time ? cpuNow() : null;
    renderer.draw(camera, dynamic, fx);
    const drawMs = tDraw ? tDraw() : 0;
    return {i, camera, dynamic, fx, lights, modelsMs, drawMs};
  };
  return out;
}
