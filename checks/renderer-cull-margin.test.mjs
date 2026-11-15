import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const box = (p, s, extra = {}) => ({shape: 'box', p, s, mat: 3, ...extra});
const environment = {biome: 'woodland', outdoorZones: [{x: 0, z: 0, w: 400, d: 400}], sunDirection: [.2, 1, .1], wind: .6};
const meshes = [box([0, -.12, 0], [400, .24, 400], {mat: 2, ground: true})];
for (let i = 0; i < 240; i++) meshes.push(box([(i % 40) * 4 - 80, .9 + (i % 5) * .5, Math.floor(i / 40) * 9 - 45], [1 + (i % 3), 1.8, 1 + (i % 4)]));

function gpu(options) {
  const buffers = new Map();
  let bound = null, serial = 0;
  const constants = {FRAMEBUFFER_COMPLETE: 36053, COLOR_BUFFER_BIT: 16384, DEPTH_BUFFER_BIT: 256};
  const gl = new Proxy(constants, {get(target, name) {
    if (name in target) return target[name];
    if (/^[A-Z_0-9]+$/.test(name)) return name;
    return (...args) => {
      if (name.startsWith('create')) return {kind: name, id: ++serial};
      if (name === 'getUniformLocation') return {program: args[0], name: args[1]};
      if (name === 'getShaderParameter' || name === 'getProgramParameter') return true;
      if (name === 'checkFramebufferStatus') return 36053;
      if (name === 'bindBuffer' && args[0] === 'ARRAY_BUFFER') bound = args[1];
      if (name === 'bufferData' && args[0] === 'ARRAY_BUFFER' && ArrayBuffer.isView(args[1])) buffers.set(bound, Array.from(args[1]));
      if (name === 'bufferSubData' && args[0] === 'ARRAY_BUFFER') {
        const target = buffers.get(bound) || [], src = Array.from(args[2]), start = args[1] / 4;
        for (let i = 0; i < src.length; i++) target[start + i] = src[i];
        buffers.set(bound, target);
      }
    };
  }});
  const canvas = {width: 960, height: 600, clientWidth: 960, clientHeight: 600, getContext: () => gl, addEventListener() {}, removeEventListener() {}};
  const scope = {window: {innerWidth: 960, innerHeight: 600, devicePixelRatio: 1}};
  vm.runInNewContext(source, scope);
  const renderer = scope.window.FRender.create(canvas, options);
  renderer.setWorld(meshes, [], environment);
  renderer.resize('auto');
  return renderer;
}

function sprint(renderer, {speed = 80, turn = 0, frames = 240, start = 0} = {}) {
  const dt = 1 / 60;
  for (let i = 0; i < frames; i++) {
    const t = (start + i) * dt;
    renderer.draw({pos: [t * speed, 1.62, Math.sin(t * 2) * 6], yaw: t * turn, pitch: -.05, fov: 74}, [], {time: t, shadows: false, adaptive: false});
  }
  return renderer.stats.cache;
}

test('les marges automatiques gardent le taux de reconstruction sous 15 % à 80 m/s', () => {
  const cache = sprint(gpu({cullMargin: 'auto'}), {speed: 80, turn: .4});
  assert.ok(cache.viewFrames > 200);
  const rate = cache.viewRebuilds / cache.viewFrames;
  assert.ok(rate < .15, `taux de reconstruction ${cache.viewRebuilds}/${cache.viewFrames}`);
  assert.ok(cache.marginDistance > 8, `la marge de distance devrait suivre la vitesse, mesurée ${cache.marginDistance}`);
});

test('une marge fixe impose la reconstruction et reste couvrante', () => {
  const tight = sprint(gpu({cullMargin: {distance: 1, angle: 4 * Math.PI / 180}}), {speed: 80, turn: .4});
  assert.ok(tight.viewRebuilds / tight.viewFrames > .5, 'une marge de 1 m doit être dépassée à 80 m/s');
  assert.equal(tight.marginDistance, 1);
  assert.equal(tight.marginAngle, 4);
});

test('cullMargin 0 reproduit exactement la sélection sans cache', () => {
  const exact = gpu({cullMargin: 0}), reference = gpu({cullMargin: {distance: 64, angle: 1}});
  const dt = 1 / 60, seen = [];
  for (let i = 0; i < 90; i++) {
    const t = i * dt, camera = {pos: [t * 40, 1.62, Math.sin(t) * 9], yaw: t * .8, pitch: -.05, fov: 74};
    exact.draw(camera, [], {time: t, shadows: false, adaptive: false});
    reference.draw(camera, [], {time: t, shadows: false, adaptive: false});
    seen.push([exact.stats.staticVisible, reference.stats.staticVisible, exact.stats.staticSuperset]);
  }
  for (const [a, b, superset] of seen) assert.equal(a, b, 'la sélection exacte diffère de la référence à large marge');
  assert.ok(seen.some(([, , superset]) => superset > seen[0][0]), 'la large marge doit produire un sur-ensemble');
});

test('la marge ne rétrécit jamais pendant la validité du cache', () => {
  const renderer = gpu({cullMargin: 'auto'});
  sprint(renderer, {speed: 80, frames: 120});
  const large = renderer.stats.cache.marginDistance;
  sprint(renderer, {speed: 0, frames: 120, start: 2});
  assert.ok(renderer.stats.cache.marginDistance <= large, 'la marge affichée doit pouvoir redescendre après un arrêt');
});
