// FMath (src/fmath.js): sin, cos, atan, atan2 and hypot identical on every platform.
// Expected bits come from checks/fmath-vectors.txt, produced by the C witness
// docs/chantier-moteur/preuves/lot-01s/t1/fdlibm-v8.c compiled without FMA
// contraction, and from checks/fmath-hypot-vectors.txt, produced by Math.hypot of
// V8 (docs/chantier-moteur/preuves/lot-01s/t3/hypot-proof.mjs): never from FMath,
// never from JavaScriptCore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const sourcePath = fileURLToPath(new URL('../src/fmath.js', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const ANCHOR = 'G.FMath=Object.freeze({sin,cos,atan,atan2,hypot,hypot2,hypot3});';
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
const table = name => readFileSync(new URL(name, import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(' '));
const vectors = table('./fmath-vectors.txt');
const kinds = kind => vectors.filter(v => v[0] === kind);
// hypot GROUP A1 ... An R: the bits of Math.hypot of V8 for n = 0 to 6 arguments.
const hypotVectors = table('./fmath-hypot-vectors.txt').map(v => ({ group: v[1], args: v.slice(2, -1), want: v[v.length - 1] }));

// Every case of the tables as [label, thunk, expected bits]; rem cases check n, y0 and y1.
function cases(M, remPio2, yy) {
  const out = [];
  for (const v of vectors) {
    if (v[0] === 'sincos') { const x = val(v[1]); out.push([`sin(${v[1]})`, () => M.sin(x), v[2]], [`cos(${v[1]})`, () => M.cos(x), v[3]]); }
    else if (v[0] === 'atan') { const x = val(v[1]); out.push([`atan(${v[1]})`, () => M.atan(x), v[2]]); }
    else if (v[0] === 'atan2') { const y = val(v[1]), x = val(v[2]); out.push([`atan2(${v[1]}, ${v[2]})`, () => M.atan2(y, x), v[3]]); }
    else if (v[0] === 'rem' && remPio2) { const x = val(v[1]); out.push([`rem_pio2(${v[1]})`, () => { const n = remPio2(x); return `${n} ${bits(yy[0])} ${bits(yy[1])}`; }, v.slice(2).join(' ')]); }
  }
  for (const { args: hex, want } of hypotVectors) {
    const args = hex.map(val), list = hex.join(', ');
    out.push([`hypot(${list})`, () => M.hypot(...args), want]);
    if (args.length === 2) out.push([`hypot2(${list})`, () => M.hypot2(args[0], args[1]), want]);
    if (args.length === 3) out.push([`hypot3(${list})`, () => M.hypot3(args[0], args[1], args[2]), want]);
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

test('FMath exposes exactly sin, cos, atan, atan2, hypot, hypot2 and hypot3, frozen, and nothing else', () => {
  // Updated on purpose in lot 01 suite T3: hypot, hypot2 and hypot3 join the API,
  // and Math.sqrt (correctly rounded, an IEEE-754 basic operation) the helpers.
  const window = load();
  assert.deepEqual(Object.keys(window), ['FMath']);
  assert.ok(Object.isFrozen(window.FMath));
  assert.deepEqual(Object.keys(window.FMath), ['sin', 'cos', 'atan', 'atan2', 'hypot', 'hypot2', 'hypot3']);
  for (const name of Object.keys(window.FMath)) assert.equal(typeof window.FMath[name], 'function');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.deepEqual([...new Set(code.match(/\bMath\.\w+/g))].sort(), ['Math.abs', 'Math.floor', 'Math.sqrt'], 'only exact host helpers');
  assert.ok(!/\bDate\b|\bDataView\b|\bperformance\b/.test(code), 'no clock and no DataView');
  assert.ok(!/\bInfinity\b|\bNaN\b/.test(code), 'no global lookup of Infinity or NaN');
  // hypot2 and hypot3 are fixed-arity: no array, no arguments object, no rest
  // parameter, no allocation, no inner function.
  for (const [name, params] of [['hypot2', 'x,y'], ['hypot3', 'x,y,z']]) {
    const m = new RegExp(`function ${name}\\(([^)]*)\\)\\{([\\s\\S]*?)\\n  \\}`).exec(code);
    assert.ok(m, `${name} not found`);
    assert.equal(m[1], params, `${name} parameters`);
    assert.ok(!/\barguments\b|\.\.\.|\bnew\b|[[\]{}]|\bfunction\b|=>/.test(m[2]), `${name} must not allocate: ${m[2]}`);
  }
  assert.equal(window.FMath.hypot2.length, 2);
  assert.equal(window.FMath.hypot3.length, 3);
});

test('the hypot table covers every path, and its pairs show that order and arity matter', () => {
  const groups = {};
  for (const v of hypotVectors) groups[v.group] = (groups[v.group] || 0) + 1;
  for (const [group, least] of Object.entries({ special: 700, edge: 30, random: 300, kahan: 50, order: 40, arity: 40, world: 200, many: 100 })) assert.ok((groups[group] || 0) >= least, `${group}: ${groups[group] || 0} rows`);
  const arities = new Set(hypotVectors.map(v => v.args.length));
  for (let n = 0; n <= 6; n++) assert.ok(arities.has(n), `arity ${n}`);
  const has = test => hypotVectors.some(v => test(v.args.map(val), v.want === 'nan' ? NaN : val(v.want)));
  assert.ok(has(a => a.some(x => Object.is(x, -0))), '-0');
  assert.ok(has(a => a.some(x => x !== 0 && Math.abs(x) < 2.2250738585072014e-308)), 'subnormal argument');
  assert.ok(has((a, r) => a.length > 1 && a.every(Number.isFinite) && r === Infinity), 'finite arguments, infinite result');
  assert.ok(has((a, r) => a.length > 1 && a.some(x => x * x === Infinity) && Number.isFinite(r)), 'squares that overflow, finite result');
  assert.ok(has((a, r) => a.some(Number.isNaN) && r === Infinity), 'Infinity beside NaN');
  assert.ok(has((a, r) => a.some(Number.isNaN) && Number.isNaN(r)), 'NaN');
  // order: each triple is followed by a permutation of it; arity: (a, b) then (a, b, 0).
  for (const group of ['order', 'arity']) {
    const rows = hypotVectors.filter(v => v.group === group);
    assert.equal(rows.length % 2, 0);
    for (let i = 0; i < rows.length; i += 2) {
      const [p, q] = [rows[i], rows[i + 1]];
      if (group === 'order') assert.deepEqual([...p.args].sort(), [...q.args].sort(), 'a permutation');
      else assert.deepEqual([...p.args, '0000000000000000'], q.args, '(a, b) then (a, b, 0)');
      assert.notEqual(p.want, q.want, `${group} pair ${i / 2} gives the same result`);
    }
  }
});

test('hypot, hypot2 and hypot3 match the V8 table bit for bit', () => {
  check(cases(FMath).filter(c => /^hypot[23]?\(/.test(c[0])));
});

test('on this V8, the table is Math.hypot, and FMath agrees with it on 120 000 seeded inputs', () => {
  // The reference is V8's builtin (Node, Chrome: one algorithm in every V8 build),
  // never JavaScriptCore. Should a future V8 change Math.hypot, FMath must stay as
  // the table: worlds keep their bits, and this check says that V8 has moved.
  assert.ok(process.versions.v8, 'the reference is Math.hypot of V8');
  let moved = 0;
  for (const { args, want } of hypotVectors) if (!same(Math.hypot(...args.map(val)), want)) moved++;
  assert.equal(moved, 0, `Math.hypot of V8 ${process.versions.v8} differs from the table in ${moved} rows`);
  let s = 0x3a1f05e7;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
  const any = () => { // 1/16 zeros, 1/16 Infinity or NaN, 1/16 subnormals, 3/16 below 2, the rest any bits
    const r = next() % 16; if (r === 0) return next() & 1 ? -0 : 0; if (r === 1) return [Infinity, -Infinity, NaN][next() % 3];
    u64[0] = (BigInt((next() & (r === 2 ? 0x800fffff : r < 6 ? 0xbfffffff : 0xffffffff)) >>> 0) << 32n) | BigInt(next()); return f64[0];
  };
  const near = x => { if (!Number.isFinite(x) || x === 0) return any(); return x * ((next() % 2001) / 1000 - 1) + (next() % 3 - 1) * 1e-3; };
  let differences = 0;const first = [];
  const compare = (label, got, want) => { if (!Object.is(got, want) && !(Number.isNaN(got) && Number.isNaN(want))) { differences++; if (first.length < 5) first.push(label); } };
  for (let i = 0; i < 60000; i++) {
    const a = any(), b = next() & 1 ? near(a) : any(), c = next() & 1 ? near(b) : any();
    compare(`hypot2(${bits(a)}, ${bits(b)})`, FMath.hypot2(a, b), Math.hypot(a, b));
    compare(`hypot3(${bits(a)}, ${bits(b)}, ${bits(c)})`, FMath.hypot3(a, b, c), Math.hypot(a, b, c));
    if (i % 6 === 0) { const list = [a, b, c, near(c), any(), near(a)].slice(0, [0, 1, 4, 5, 6][i % 5]); compare(`hypot(${list.map(bits)})`, FMath.hypot(...list), Math.hypot(...list)); }
  }
  assert.equal(differences, 0, `${differences} differences from Math.hypot of V8:\n${first.join('\n')}`);
});

test('hypot converts its arguments once, in order, and keeps Math.hypot special values', () => {
  const { hypot, hypot2, hypot3 } = FMath, is = (a, b) => assert.ok(Object.is(a, b), `${a} is not ${b}`);
  const log = [], v = (name, x) => ({ valueOf() { log.push(name); return x; } });
  for (const [fn, n] of [[hypot2, 2], [hypot3, 3], [hypot, 2], [hypot, 3], [hypot, 5]]) {
    const names = ['a', 'b', 'c', 'd', 'e'].slice(0, n), values = [3, 4, 12, 84, 132].slice(0, n);
    log.length = 0; const got = fn(...names.map((k, i) => v(k, values[i])));
    const order = log.slice(); log.length = 0; const want = Math.hypot(...names.map((k, i) => v(k, values[i])));
    is(got, want); assert.deepEqual(order, names); assert.deepEqual(log, names);
  }
  const boom = { valueOf() { throw new Error('boom'); } };
  for (const call of [() => hypot2(v('a', 1), boom), () => hypot3(v('a', 1), boom, v('c', 1)), () => hypot(v('a', 1), boom, v('c', 1), v('d', 1))]) {
    log.length = 0; assert.throws(call, /boom/); assert.deepEqual(log, ['a'], 'conversion stops at the first exception');
  }
  for (const call of [() => hypot2(1n, 2), () => hypot3(1, 2n, 3), () => hypot(1, 2, 3, 4n)]) assert.throws(call, { name: 'TypeError' }); // TypeError of the FMath realm
  is(hypot2(0, -0), 0); is(hypot2(-0, -0), 0); is(hypot3(-0, 0, -0), 0); is(hypot(), 0); is(hypot(-0), 0); is(hypot(-3), 3); is(hypot(NaN), NaN);
  is(hypot2(3, 4), 5); is(hypot3(2, 3, 6), 7); is(hypot(1, 2, 2, 4), 5); is(hypot2('3', '4'), 5); is(hypot2(null, -4), 4);
  for (const nan of [NaN, undefined, 'x', {}]) { is(hypot2(nan, 1), NaN); is(hypot2(1, nan), NaN); is(hypot2(0, nan), NaN); is(hypot2(nan, 0), NaN); is(hypot3(0, 0, nan), NaN); is(hypot3(nan, 0, 0), NaN); is(hypot3(0, nan, 1), NaN); }
  for (const inf of [Infinity, -Infinity]) { is(hypot2(inf, NaN), Infinity); is(hypot2(NaN, inf), Infinity); is(hypot3(NaN, NaN, inf), Infinity); is(hypot3(inf, NaN, 0), Infinity); is(hypot3(0, inf, NaN), Infinity); is(hypot(NaN, 1, 2, inf), Infinity); }
  is(hypot2(5e-324, 0), 5e-324); is(hypot2(1e200, 1e200), Math.hypot(1e200, 1e200)); is(hypot2(1.7976931348623157e308, 1.7976931348623157e308), Infinity);
  is(hypot2(3), NaN); // fixed arity: hypot2 always reads two arguments, unlike Math.hypot(3) = 3
  is(hypot3(3, 4), NaN);
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

// Top-level arguments of the call whose '(' is at index open: strings and
// template literals are opaque, brackets nest.
function callArguments(code, open) {
  const args = [];let depth = 0, start = open + 1;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "'" || c === '"' || c === '`') { for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (--depth === 0) { args.push(code.slice(start, i).trim()); return args; } }
    else if (c === ',' && depth === 1) { args.push(code.slice(start, i).trim()); start = i + 1; }
  }
  throw new Error('unbalanced call at ' + open);
}

test('world.js takes sin, cos, atan, atan2 and hypot from FMath only and refuses to load without it', () => {
  const worldPath = fileURLToPath(new URL('../src/world.js', import.meta.url));
  const world = readFileSync(worldPath, 'utf8');
  const code = world.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Static guard: every Math function left in world.js is exact (IEEE-754 or
  // integral results), or a constant. Since lot 01 suite T3, hypot is FMath's.
  const allowed = new Set(['abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'min', 'max', 'sqrt', 'imul', 'fround', 'clz32',
    'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2']);
  const union = "Math[k.startsWith('min')?'min':'max']";
  const misuses = [];
  for (const m of code.matchAll(/\bMath\b(?:\s*\.\s*([A-Za-z_$][\w$]*))?/g)) {
    if (m[1] !== undefined) { if (!allowed.has(m[1])) misuses.push('Math.' + m[1]); }
    else if (!code.startsWith(union, m.index)) misuses.push(code.slice(m.index, m.index + 40));
  }
  assert.deepEqual(misuses, [], 'inexact or indirect use of Math in world.js');
  assert.equal(code.split(union).length, 2, 'the bounds union is the only computed Math access');
  assert.ok(!code.includes('**'), 'no exponentiation operator in world.js');
  // FMath is read once from window, never reassigned, and only these functions are called.
  assert.equal(code.split('const FMath = window.FMath;').length, 2, 'one alias, read at load');
  const names = [...code.matchAll(/\bFMath\b(\s*\.\s*([A-Za-z_$][\w$]*))?/g)].filter(m => m[1]).map(m => m[2]);
  assert.ok(names.length > 0 && names.every(name => ['sin', 'cos', 'atan', 'atan2', 'hypot2', 'hypot3'].includes(name)), 'FMath calls: ' + [...new Set(names)]);
  assert.ok(names.includes('hypot2') && names.includes('hypot3'), 'hypot2 and hypot3 are both used');
  assert.ok(!/\bFMath\s*=[^=]/.test(code.replace('const FMath = window.FMath;', '')), 'FMath is never reassigned');
  // hypot2 and hypot3 keep the arity of the Math.hypot calls they replace: two and
  // three plain arguments, never a spread (hypot(a, b) and hypot(a, b, 0) differ).
  const wrong = [];
  for (const m of code.matchAll(/\bFMath\.hypot([23])\s*\(/g)) {
    const args = callArguments(code, m.index + m[0].length - 1);
    if (args.length !== Number(m[1]) || args.some(a => !a || a.startsWith('...'))) wrong.push(`hypot${m[1]}(${args.join(', ')})`);
  }
  assert.deepEqual(wrong, [], 'hypot2 and hypot3 take exactly two and three arguments');
  // Without FMath, loading fails with an explicit message, before any world exists.
  const bare = { window: {} };
  assert.throws(() => vm.runInNewContext(world, bare, { filename: worldPath }), /charger src\/fmath\.js avant src\/world\.js/);
  assert.equal(bare.window.FWorld, undefined);
  // With the host trigonometry and hypot poisoned, a world is still generated: nothing reaches it.
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: sourcePath });
  vm.runInNewContext(world, context, { filename: worldPath });
  vm.runInNewContext('for (const name of ["sin", "cos", "atan", "atan2", "hypot"]) Math[name] = () => { throw new Error("host Math." + name); };', context);
  assert.throws(() => vm.runInNewContext('Math.atan2(1, 2)', context), /host Math\.atan2/);
  assert.throws(() => vm.runInNewContext('Math.hypot(1, 2)', context), /host Math\.hypot/);
  const generated = context.window.FWorld.create(1, 0);
  assert.equal(generated.generation, 6);
  assert.ok(generated.meshes.length > 1000 && generated.enemies.length > 0, 'a full world without host trigonometry or hypot');
});
