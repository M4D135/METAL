// Égalité stricte de FMotion.place / FMotion mount après la réécriture sans allocation (RESTE-02).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source = readFileSync(new URL('../src/motion.js', import.meta.url), 'utf8');
const scope = {window: {}};
vm.runInNewContext(source, scope);
const FMotion = scope.window.FMotion;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function basis(yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const r = [cy, 0, sy], u = [-sy * sp, cp, cy * sp], b = [-sy * cp, -sp, cy * cp];
  return [r.map((v, k) => v * cr + u[k] * sr), u.map((v, k) => v * cr - r[k] * sr), b];
}
function rotation(x = 0, y = 0, z = 0) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return [[cz * cy, sz * cy, -sy], [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx], [cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]];
}
const vector = (axes, v) => [0, 1, 2].map(k => axes[0][k] * v[0] + axes[1][k] * v[1] + axes[2][k] * v[2]);
function referenceMount(camera, offset = [0, 0, 0], angles = [0, 0, 0]) {
  const axes = basis(camera.yaw || 0, camera.pitch || 0, camera.roll || 0), shift = vector(axes, offset);
  return {pos: camera.pos.map((v, k) => v + shift[k]), axes: rotation(...angles).map(v => vector(axes, v))};
}
function referencePlace(frame, offset, rx = 0) {
  const shift = vector(frame.axes, offset), c = Math.cos(rx), s = Math.sin(rx);
  const axes = [frame.axes[0], frame.axes[1].map((v, k) => v * c + frame.axes[2][k] * s), frame.axes[2].map((v, k) => v * c - frame.axes[1][k] * s)];
  const ry = Math.asin(clamp(-axes[0][2], -1, 1)), regular = Math.abs(Math.cos(ry)) > 1e-6;
  const r = regular ? [Math.atan2(axes[1][2], axes[2][2]), ry, Math.atan2(axes[0][1], axes[0][0])] : [Math.atan2(-axes[2][1], axes[1][1]), ry, 0];
  return {p: frame.pos.map((v, k) => v + shift[k]), r};
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const same = (a, b, label) => assert.equal(JSON.stringify(a), JSON.stringify(b), label);

test('mount et place restent bit à bit identiques sur 10 000 poses à graine fixe', () => {
  const random = mulberry(20261113);
  for (let i = 0; i < 10000; i++) {
    const camera = {pos: [random() * 200 - 100, random() * 40 - 5, random() * 200 - 100], yaw: random() * 8 - 4, pitch: random() * 3 - 1.5, roll: random() * 2 - 1};
    const offset = [random() * 6 - 3, random() * 6 - 3, random() * 6 - 3];
    const angles = [random() * 8 - 4, random() * 8 - 4, random() * 8 - 4];
    const rx = random() * 8 - 4;
    const fast = FMotion.mount(camera, offset, angles), reference = referenceMount(camera, offset, angles);
    same(fast.pos, reference.pos, `mount.pos ${i}`);
    same(fast.axes, reference.axes, `mount.axes ${i}`);
    const placed = FMotion.place(fast, offset, rx), expected = referencePlace(reference, offset, rx);
    same(placed.p, expected.p, `place.p ${i}`);
    same(placed.r, expected.r, `place.r ${i}`);
  }
});

test('la mémo par repère ne change pas le résultat quand rx varie', () => {
  const random = mulberry(7);
  for (let i = 0; i < 500; i++) {
    const camera = {pos: [random() * 20 - 10, random() * 6, random() * 20 - 10], yaw: random() * 6 - 3, pitch: random() * 2 - 1, roll: random() - .5};
    const angles = [random() * 6 - 3, random() * 6 - 3, random() * 6 - 3];
    const fast = FMotion.mount(camera, [0, 1, 0], angles);
    const reference = referenceMount(camera, [0, 1, 0], angles);
    for (const rx of [0, random() * 6 - 3, 0, Math.PI / 2, random() * 6 - 3]) {
      const placed = FMotion.place(fast, [random() * 4 - 2, random() * 4 - 2, random() * 4 - 2], rx);
      const expected = referencePlace(reference, [0, 0, 0], rx);
      same(placed.r, expected.r, `rx ${rx}`);
    }
  }
});

test('un repère fabriqué à la main sans champs de mémo fonctionne', () => {
  const frame = {pos: [1, 2, 3], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]};
  const placed = FMotion.place(frame, [1, 1, 1], .3);
  const expected = referencePlace({pos: [1, 2, 3], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]}, [1, 1, 1], .3);
  same(placed.p, expected.p);
  same(placed.r, expected.r);
});

test('place invalide sa mémo lorsque les axes du repère changent, même à rx constant', () => {
  const frame = FMotion.mount({pos: [1, 2, 3], yaw: 0, pitch: 0});
  const offset = [.2, .4, .8];
  FMotion.place(frame, offset, .3);
  frame.axes = referenceMount({pos: [1, 2, 3], yaw: .7, pitch: .1, roll: -.2}).axes;
  same(FMotion.place(frame, offset, .3), referencePlace(frame, offset, .3), 'axes remplacés');
  const changed = referenceMount({pos: [1, 2, 3], yaw: -.4, pitch: .3, roll: .25}).axes;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) frame.axes[i][j] = changed[i][j];
  same(FMotion.place(frame, offset, .3), referencePlace(frame, offset, .3), 'axes modifiés en place');
});

test('place accepte un repère gelé et conserve le signe des zéros du calcul de référence', () => {
  const frame = Object.freeze({pos: Object.freeze([1, 2, 3]), axes: Object.freeze([[1, 0, 0], [0, 1, -0], [0, 0, 1]].map(Object.freeze))});
  for (const rx of [0, -0, .3, 0]) {
    const got = FMotion.place(frame, [.1, .2, .3], rx), expected = referencePlace(frame, [.1, .2, .3], rx);
    assert.deepEqual(Array.from(got.p), expected.p);
    assert.deepEqual(Array.from(got.r), expected.r);
  }
});
