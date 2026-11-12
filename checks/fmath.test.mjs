// FMath (src/fmath.js): sin, cos, atan and atan2 identical on every platform.
// Expected bits come from checks/fmath-vectors.txt, produced by the C witness
// docs/chantier-moteur/preuves/lot-01s/t1/fdlibm-v8.c compiled without FMA
// contraction, never from the Math of the machine running the tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const sourcePath = fileURLToPath(new URL('../src/fmath.js', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const ANCHOR = 'G.FMath=Object.freeze({sin,cos,atan,atan2});';
const INTERNALS = 'G.FMathInternals={remPio2,yy,twoOverPi,npio2hw,PIo2,atanhi,atanlo,invpio2,pio2_1,pio2_1t,pio2_2,pio2_2t,pio2_3,pio2_3t,pi_o_4,pi_o_2,pi,pi_lo};';
function load(globals = {}, internals = false) {
  let text = source;
  if (internals) {
    assert.equal(text.split(ANCHOR).length, 2, 'the FMath export statement must appear exactly once');
    text = text.replace(ANCHOR, INTERNALS + ANCHOR);
  }
  const context = { window: {}, ...globals };
  vm.runInNewContext(text, context, { filename: sourcePath });
  return context.window;
}
const { FMath } = load();
const internals = load({}, true).FMathInternals;

const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
const bits = x => { f64[0] = x; return u64[0].toString(16).padStart(16, '0'); };
const val = h => { u64[0] = BigInt('0x' + h); return f64[0]; };
const same = (got, want) => want === 'nan' ? Number.isNaN(got) : typeof got === 'number' && bits(got) === want;
const vectors = readFileSync(new URL('./fmath-vectors.txt', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(' '));
const kinds = kind => vectors.filter(v => v[0] === kind);

// Every case of the table as [label, thunk, expected bits]; rem cases check n, y0 and y1.
function cases(M, remPio2, yy) {
  const out = [];
  for (const v of vectors) {
    if (v[0] === 'sincos') { const x = val(v[1]); out.push([`sin(${v[1]})`, () => M.sin(x), v[2]], [`cos(${v[1]})`, () => M.cos(x), v[3]]); }
    else if (v[0] === 'atan') { const x = val(v[1]); out.push([`atan(${v[1]})`, () => M.atan(x), v[2]]); }
    else if (v[0] === 'atan2') { const y = val(v[1]), x = val(v[2]); out.push([`atan2(${v[1]}, ${v[2]})`, () => M.atan2(y, x), v[3]]); }
    else if (v[0] === 'rem' && remPio2) { const x = val(v[1]); out.push([`rem_pio2(${v[1]})`, () => { const n = remPio2(x); return `${n} ${bits(yy[0])} ${bits(yy[1])}`; }, v.slice(2).join(' ')]); }
  }
  return out;
}
function check(list) {
  let failures = 0;const first = [];
  for (const [label, run, want] of list) {
    const got = run();
    const ok = typeof got === 'string' ? got === want : same(got, want);
    if (!ok) { failures++; if (first.length < 5) first.push(`${label}: got ${typeof got === 'string' ? got : bits(got)}, want ${want}`); }
  }
  assert.equal(failures, 0, `${failures} of ${list.length} cases differ:\n${first.join('\n')}`);
}

test('FMath exposes exactly sin, cos, atan and atan2, frozen, and nothing else', () => {
  const window = load();
  assert.deepEqual(Object.keys(window), ['FMath']);
  assert.ok(Object.isFrozen(window.FMath));
  assert.deepEqual(Object.keys(window.FMath), ['sin', 'cos', 'atan', 'atan2']);
  for (const name of Object.keys(window.FMath)) assert.equal(typeof window.FMath[name], 'function');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.deepEqual([...new Set(code.match(/\bMath\.\w+/g))].sort(), ['Math.abs', 'Math.floor'], 'only exact host helpers');
  assert.ok(!/\bDate\b|\bDataView\b|\bperformance\b/.test(code), 'no clock and no DataView');
});

test('the vector table covers every path with enough cases', () => {
  assert.ok(kinds('sincos').length >= 1200, 'sin/cos cases');
  assert.ok(kinds('atan').length >= 400, 'atan cases');
  assert.ok(kinds('atan2').length >= 700, 'atan2 cases');
  assert.ok(kinds('rem').length >= 400, 'rem_pio2 cases');
  const large = kinds('sincos').filter(v => (parseInt(v[1].slice(0, 8), 16) & 0x7fffffff) > 0x413921fb && (parseInt(v[1].slice(0, 8), 16) & 0x7fffffff) < 0x7ff00000);
  assert.ok(large.length >= 200, 'arguments beyond 2^19*pi/2 (__kernel_rem_pio2)');
  const subnormal = kinds('sincos').filter(v => (parseInt(v[1].slice(0, 8), 16) & 0x7ff00000) === 0 && v[1] !== '0000000000000000' && v[1] !== '8000000000000000');
  assert.ok(subnormal.length >= 4, 'subnormal arguments');
});

test('sin and cos match the no-FMA C witness bit for bit', () => {
  check(cases(FMath).filter(c => /^(?:sin|cos)\(/.test(c[0])));
});

test('atan and atan2 match the no-FMA C witness bit for bit', () => {
  check(cases(FMath).filter(c => /^atan2?\(/.test(c[0])));
});

test('__ieee754_rem_pio2 and __kernel_rem_pio2 match the C witness (n, y0, y1)', () => {
  check(cases(FMath, internals.remPio2, internals.yy).filter(c => c[0].startsWith('rem_pio2(')));
});

test('results do not depend on call order or on the previous call', () => {
  const list = cases(FMath, internals.remPio2, internals.yy);
  let s = 0x2545f491;
  for (let i = list.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const j = s % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  check(list);
});

test('results do not depend on the byte order of the host (simulated big-endian words)', () => {
  function SwappedUint32Array(buffer) {
    const real = new Uint32Array(buffer);
    const swap = key => key === '0' ? '1' : key === '1' ? '0' : key;
    return new Proxy(real, { get: (t, k) => t[typeof k === 'string' ? swap(k) : k], set: (t, k, v) => { t[typeof k === 'string' ? swap(k) : k] = v; return true; } });
  }
  const swapped = load({ Uint32Array: SwappedUint32Array });
  check(cases(swapped.FMath));
  function Broken() { return new Uint32Array(2); }
  assert.throws(() => load({ Uint32Array: Broken }), /unsupported double layout/);
});

test('special values follow IEEE-754 and ECMAScript', () => {
  const { sin, cos, atan, atan2 } = FMath, PI = Math.PI, is = (a, b) => assert.ok(Object.is(a, b), `${a} is not ${b}`);
  is(sin(0), 0); is(sin(-0), -0); is(cos(0), 1); is(cos(-0), 1);
  for (const x of [Infinity, -Infinity, NaN]) { is(sin(x), NaN); is(cos(x), NaN); }
  is(sin(5e-324), 5e-324); is(sin(-5e-324), -5e-324); is(cos(5e-324), 1); is(atan(5e-324), 5e-324);
  is(atan(0), 0); is(atan(-0), -0); is(atan(NaN), NaN); is(atan(Infinity), PI / 2); is(atan(-Infinity), -PI / 2);
  is(atan2(NaN, 1), NaN); is(atan2(1, NaN), NaN);
  is(atan2(0, 0), 0); is(atan2(-0, 0), -0); is(atan2(0, -0), PI); is(atan2(-0, -0), -PI);
  is(atan2(0, -1), PI); is(atan2(-0, -1), -PI); is(atan2(0, 1), 0); is(atan2(-0, 1), -0);
  is(atan2(1, 0), PI / 2); is(atan2(1, -0), PI / 2); is(atan2(-1, 0), -PI / 2);
  is(atan2(Infinity, Infinity), PI / 4); is(atan2(-Infinity, Infinity), -PI / 4);
  is(atan2(Infinity, -Infinity), 3 * PI / 4); is(atan2(-Infinity, -Infinity), -3 * PI / 4);
  is(atan2(1, Infinity), 0); is(atan2(-1, Infinity), -0); is(atan2(1, -Infinity), PI); is(atan2(-1, -Infinity), -PI);
  is(atan2(Infinity, 1), PI / 2); is(atan2(-Infinity, -1), -PI / 2);
  is(sin('0.5'), sin(0.5)); is(cos(null), 1); is(sin(), NaN); is(atan2(), NaN); is(atan(true), atan(1));
  for (const x of [1e-300, 0.1, 1, 3, 1e3, 1e9, 1e22, 1e300, Number.MAX_VALUE]) { const s = sin(x), c = cos(x); assert.ok(Math.abs(s * s + c * c - 1) < 1e-15, `sin^2+cos^2 at ${x}`); is(sin(-x), -s); is(cos(-x), c); }
});

test('fdlibm constants match their hexadecimal words', () => {
  const found = [...source.matchAll(/(-?\d+\.\d+(?:[eE][-+]?\d+)?)[,;\])]*\s*\/\*[^*]*?0x([0-9A-Fa-f]{8}),\s*0x([0-9A-Fa-f]{8})\s*\*\//g)];
  assert.ok(found.length >= 52, `expected at least 52 annotated constants, found ${found.length}`);
  for (const [, literal, hi, lo] of found) assert.equal(bits(Number(literal)), (hi + lo).toLowerCase(), literal);
});

test('reduction tables and pi-derived constants are the digits of pi', () => {
  // pi with 1800 fractional bits (Machin), then every derived constant recomputed exactly.
  const P = 1800n, ONE = 1n << P;
  const arctanInv = k => { let sum = 0n, term = ONE / k, n = 1n, sign = 1n; while (term) { sum += sign * (term / n); term /= k * k; n += 2n; sign = -sign; } return sum; };
  const PI = 16n * arctanInv(5n) - 4n * arctanInv(239n), HALF_PI = PI >> 1n;
  const toFixed = x => { const b = BigInt('0x' + bits(x)), e = Number((b >> 52n) & 0x7ffn), m = (b & ((1n << 52n) - 1n)) | (1n << 52n), s = BigInt(e - 1075) + P; assert.ok(s >= 0n); return (b >> 63n ? -1n : 1n) * (m << s); };
  const pow2 = k => val(((BigInt(k) + 1023n) << 52n).toString(16).padStart(16, '0'));
  const fromParts = (m, k) => Number(m) * pow2(k); // m < 2^53: exact
  const len = v => v.toString(2).length;
  function nearest(v) { // round fixed-point v > 0 to the nearest double, refusing near-ties
    const shift = BigInt(len(v) - 53), rem = v & ((1n << shift) - 1n), half = 1n << (shift - 1n);
    assert.ok(rem < half - 1024n || rem > half + 1024n, 'rounding too close to a tie');
    return fromParts((v >> shift) + (rem > half ? 1n : 0n), Number(shift - P));
  }
  const truncate = (v, keep) => { const shift = BigInt(len(v) - keep); return fromParts(v >> shift, Number(shift - P)); };
  const I = internals;
  for (let i = 0; i < I.twoOverPi.length; i++) assert.equal(I.twoOverPi[i], Number(((2n * ONE * ONE / PI) >> (P - 24n * BigInt(i + 1))) & 0xffffffn), `two_over_pi[${i}]`);
  assert.equal(I.twoOverPi.length, 66);
  for (let n = 1; n <= 32; n++) assert.equal(I.npio2hw[n - 1], parseInt(bits(nearest(BigInt(n) * HALF_PI)).slice(0, 8), 16) | 0, `npio2_hw[${n - 1}]`);
  for (let i = 0; i < 8; i++) { const k = 23n + 24n * BigInt(i); assert.equal(bits(I.PIo2[i]), bits(fromParts((HALF_PI >> (P - k)) & 0xffffffn, -Number(k))), `PIo2[${i}]`); }
  assert.equal(bits(I.invpio2), bits(nearest(2n * ONE * ONE / PI)));
  let rest = HALF_PI;
  for (const [hi, tail] of [[I.pio2_1, I.pio2_1t], [I.pio2_2, I.pio2_2t], [I.pio2_3, I.pio2_3t]]) {
    assert.equal(bits(hi), bits(truncate(rest, 33)), '33-bit chunk of pi/2');
    rest -= toFixed(hi);
    assert.equal(bits(tail), bits(nearest(rest)), 'tail of pi/2');
  }
  const atanExact = [arctanInv(2n), PI >> 2n, (PI >> 2n) + arctanInv(5n), HALF_PI]; // atan(1/2), atan(1), atan(3/2) = pi/4 + atan(1/5), atan(inf)
  atanExact.forEach((v, i) => { assert.equal(bits(I.atanhi[i]), bits(nearest(v)), `atanhi[${i}]`); assert.equal(bits(I.atanlo[i]), bits(nearest(v - toFixed(I.atanhi[i]))), `atanlo[${i}]`); });
  assert.equal(bits(I.pi_o_4), bits(nearest(PI >> 2n))); assert.equal(bits(I.pi_o_2), bits(nearest(HALF_PI))); assert.equal(bits(I.pi), bits(nearest(PI)));
  assert.equal(bits(I.pi_lo), bits(nearest(PI - toFixed(I.pi))));
});
