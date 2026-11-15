import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const fx = {time: 2, adaptive: false, bloom: false};
const box = (p, s, extra = {}) => ({shape: 'box', p, s, mat: 3, ...extra});
const meshes = [box([0, -.12, 0], [60, .24, 60], {mat: 2, ground: true})];
for (let i = 0; i < 48; i++) {
  const a = i / 48 * Math.PI * 2, d = 6 + (i % 5) * 4;
  meshes.push(box([Math.sin(a) * d, .8 + (i % 3), Math.cos(a) * d], [.8 + (i % 4) * .6, 1.6 + (i % 3), .8]));
}
for (let i = 0; i < 12; i++) meshes.push(box([(i - 6) * 3, 6, -26], [1.2, 9, 1.2], {detail: i % 3}));
const environment = {biome: 'woodland', outdoorZones: [{x: 0, z: 0, w: 120, d: 120}], sunDirection: [.2, 1, .1], wind: .6};

function gpu() {
  const calls = [], draws = [], buffers = new Map(), uniforms = new Map();
  let serial = 0, bound = null, currentProgram = null, framebuffer = null, instanceOffset = 0;
  const gl = new Proxy({FRAMEBUFFER_COMPLETE: 36053, COLOR_BUFFER_BIT: 16384, DEPTH_BUFFER_BIT: 256}, {get(target, name) {
    if (name in target) return target[name];
    if (/^[A-Z_0-9]+$/.test(name)) return name;
    return (...args) => {
      calls.push({name, args});
      if (name.startsWith('create')) return {kind: name, id: ++serial};
      if (name === 'getUniformLocation') return {program: args[0], name: args[1]};
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return true;
      if (name === 'checkFramebufferStatus') return 36053;
      if (name === 'bindBuffer' && args[0] === 'ARRAY_BUFFER') bound = args[1];
      if (name === 'bufferData' && args[0] === 'ARRAY_BUFFER' && ArrayBuffer.isView(args[1])) buffers.set(bound, Array.from(args[1]));
      if (name === 'bufferSubData' && args[0] === 'ARRAY_BUFFER') {
        const target = buffers.get(bound) || [], source = Array.from(args[2]), start = args[1] / 4;
        for (let i = 0; i < source.length; i++) target[start + i] = source[i];
        buffers.set(bound, target);
      }
      if (name === 'useProgram') currentProgram = args[0];
      if (name === 'bindFramebuffer') framebuffer = args[1];
      if (name === 'vertexAttribPointer' && args[0] === 2) instanceOffset = args[5] / 4;
      if (name.startsWith('uniform')) uniforms.set(args[0].name, ArrayBuffer.isView(args.at(-1)) ? Array.from(args.at(-1)) : args.slice(1));
      if (name === 'drawElementsInstanced') draws.push({program: currentProgram, framebuffer, values: (buffers.get(bound) || []).slice(instanceOffset, instanceOffset + args[4] * 16), count: args[4], indexCount: args[1], indexOffset: args[3]});
    };
  }});
  const canvas = {width: 960, height: 600, clientWidth: 960, clientHeight: 600, getContext: () => gl, addEventListener() {}, removeEventListener() {}}, scope = {window: {innerWidth: 960, innerHeight: 600, devicePixelRatio: 1}};
  vm.runInNewContext(source, scope);
  return {renderer: scope.window.FRender.create(canvas), draws, canvas};
}

function tour(gpu, invalidate, shadows) {
  const renderer=gpu.renderer;
  const visible = [], main = [];
  for (let i = 0; i < 48; i++) {
    const a = i * .19, camera = {pos: [Math.sin(a) * 11, 1.6 + Math.sin(i * .7) * .4, Math.cos(a) * 11], yaw: a, pitch: -.05 + Math.sin(i * .3) * .2, fov: 74};
    if (invalidate) renderer.updateWorld(meshes, i + 1);
    renderer.draw(camera, [], {...fx, shadows});
    visible.push(renderer.stats.staticVisible);
    main.push(gpu.draws.filter(d => d.framebuffer === null).map(d => d.count + ':' + d.values.join(',')).join('#'));
  }
  return {visible, main};
}

for (const shadows of [false, true]) test(`le cache temporel de vue rend exactement les mêmes instances avec et sans cache (ombres ${shadows})`, () => {
  const a = gpu(), b = gpu();
  a.renderer.setWorld(meshes, [], environment);
  b.renderer.setWorld(meshes, [], environment);
  const cached = tour(a, false, shadows), uncached = tour(b, true, shadows);
  assert.deepEqual(cached.visible, uncached.visible, 'le nombre d\'instances visibles diffère image par image');
  assert.deepEqual(cached.main, uncached.main, 'le contenu des lots dessinés diffère image par image');
});

test('le cache temporel de vue est réellement réutilisé pendant la visite', () => {
  const a = gpu();
  a.renderer.setWorld(meshes, [], environment);
  for (let i = 0; i < 48; i++) a.renderer.draw({pos: [Math.sin(i * .05) * .3, 1.6, 26 + Math.cos(i * .05) * .3], yaw: i * .02, pitch: 0, fov: 74}, [], {...fx, shadows: false});
  const cache = a.renderer.stats.cache;
  assert.ok(cache.viewFrames > 0, 'aucune image mesurée');
  assert.ok(cache.viewRebuilds * 2 < cache.viewFrames, `le cache est reconstruit trop souvent (${cache.viewRebuilds}/${cache.viewFrames})`);
});

test('une modification du monde invalide immédiatement la sélection de garde', () => {
  const a = gpu();
  a.renderer.setWorld(meshes, [], environment);
  const camera = {pos: [0, 1.6, 26], yaw: 0, pitch: 0, fov: 74};
  a.renderer.draw(camera, [], {...fx, shadows: false});
  const avant = a.renderer.stats.staticVisible;
  const ajoute = meshes.concat([box([0, 1.6, 8], [3, 3, 3])]);
  a.renderer.updateWorld(ajoute, 7);
  a.renderer.draw(camera, [], {...fx, shadows: false});
  assert.ok(a.renderer.stats.staticVisible > avant, 'l\'objet ajouté n\'apparaît pas dès l\'image suivante');
});

test('deux sélections différentes de même hash et même taille actualisent les instances GPU', () => {
  // H([1,63]) = H([2,32]) = 94 for H = 31*H + order.
  const scene = Array.from({length: 64}, (_, i) => box([1000 + i * 5, 1, -1000], [1, 1, 1]));
  scene[1] = box([-20, 1.6, -6], [1, 1, 1]);
  scene[63] = box([-18, 1.6, -7], [1, 1, 1]);
  scene[2] = box([20, 1.6, -6], [1, 1, 1]);
  scene[32] = box([22, 1.6, -7], [1, 1, 1]);
  const a = gpu(), fresh = gpu();
  a.renderer.setWorld(scene, []); fresh.renderer.setWorld(scene, []);
  const camera = x => ({pos: [x, 1.6, 0], yaw: 0, pitch: 0, fov: 45});
  a.renderer.draw(camera(-20), [], {...fx, shadows: false});
  assert.equal(a.renderer.stats.staticVisible, 2);
  const first = a.draws.length;
  a.renderer.draw(camera(20), [], {...fx, shadows: false});
  fresh.renderer.draw(camera(20), [], {...fx, shadows: false});
  assert.equal(a.renderer.stats.staticVisible, 2);
  const main = rows => rows.filter(d => d.framebuffer === null).map(({values, count}) => ({values, count}));
  assert.ok(main(fresh.draws).some(d => d.values.length > 0), 'le témoin doit contenir de vraies instances');
  assert.deepEqual(main(a.draws.slice(first)), main(fresh.draws), 'le second point de vue doit dessiner ses propres maillages');
});
