// Proof preload (lot 01 suite, MURS-V1): sin, cos, atan and atan2 of this whole
// Node process become those of FMath (src/fmath.js, fdlibm of V8 without FMA),
// as computed by Node on Linux x86-64. Since T2 the world generation already
// uses FMath; the simulation, the destruction and the proof driver still call
// Math, whose last bit differs on arm64 (Mac, Linux arm64). With this preload, a
// replay on arm64 can be compared with the x86-64 references of tools/proof:
//
//   node --import=./tools/proof/fmath-global.mjs tools/profile-steps.mjs . --reps 1 --warmups 1 --no-counters --out p.json
//   node tools/proof/reference-check.mjs p.json
//
// Only for proofs and measurements: the game itself never changes Math. Nothing
// is added to globalThis; the realm-loader's main realm shares this Math, its
// diagnostic vm realm does not. FMATH_ROOT=<root> takes src/fmath.js of another
// checkout.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = process.env.FMATH_ROOT ? resolve(process.env.FMATH_ROOT) : fileURLToPath(new URL('../../', import.meta.url));
const file = resolve(root, 'src/fmath.js'), holder = Object.create(null);
vm.runInThisContext(`(function(window){${readFileSync(file, 'utf8')}\n})`, {filename: file})(holder);
const {FMath} = holder;
if (!FMath) throw new Error(`fmath-global: ${file} did not define FMath`);
for (const name of ['sin', 'cos', 'atan', 'atan2']) {
  if (typeof FMath[name] !== 'function') throw new Error(`fmath-global: FMath.${name} is missing`);
  Object.defineProperty(Math, name, {...Object.getOwnPropertyDescriptor(Math, name), value: FMath[name]});
}
