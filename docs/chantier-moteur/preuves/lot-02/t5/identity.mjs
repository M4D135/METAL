// Lot 02 / T5 (LOAD-06) : identité de FWorld.create entre deux arbres de sources.
// 46 mondes : 2 graines × 18 mondes V2, 2 graines × 3 mondes historiques, 4 indices de campagne V1.
// Comparaison octet pour octet du JSON complet et empreinte FNV.
// usage : node identity.mjs <racine-avant> <racine-après>
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const [rootA, rootB] = process.argv.slice(2).map(p => resolve(p));
if (!rootA || !rootB) throw new Error('usage: node identity.mjs <racine-avant> <racine-après>');
const A = loadRealm({root: rootA}), B = loadRealm({root: rootB});
const cases = [];
for (const seed of [96, 424242]) {
  for (let i = 0; i < 18; i++) cases.push([seed, i, {campaign: true, campaignVersion: 2}]);
  for (let i = 0; i < 3; i++) cases.push([seed, i, undefined]);
}
for (let i = 0; i < 18; i += 5) cases.push([96, i, {campaign: true}]);
let same = 0, diff = [], bytes = 0, ta = 0, tb = 0;
const hashA = createHash('sha256'), hashB = createHash('sha256');
for (const [seed, i, o] of cases) {
  let t = performance.now(); const a = JSON.stringify(A.window.FWorld.create(seed, i, o)); ta += performance.now() - t;
  t = performance.now(); const b = JSON.stringify(B.window.FWorld.create(seed, i, o)); tb += performance.now() - t;
  bytes = a.length; hashA.update(a); hashB.update(b);
  if (a === b) same++; else diff.push(`${seed}/${i}/${JSON.stringify(o)}`);
}
console.log(JSON.stringify({
  schema: 'lot02-t5-identity-v1', cases: cases.length, identical: same, different: diff,
  digest: {a: hashA.digest('hex'), b: hashB.digest('hex')}, bytesPerWorld: bytes,
  totalOriginalMs: Math.round(ta), totalPatchedMs: Math.round(tb),
  sourceSha256: {a: A.sourceSha256.world, b: B.sourceSha256.world},
}, null, 1));
