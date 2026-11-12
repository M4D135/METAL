// Identity of FWorld.create output (all campaign v2 worlds, legacy worlds, campaign v1, two seeds) original vs patched copy.
import {load, now} from './lib.mjs';
const [root, dir] = process.argv.slice(2);
const A = load(root), B = load(root, [], dir);
const fnv = s => { let f = 2166136261; for (let i = 0; i < s.length; i++) f = Math.imul(f ^ s.charCodeAt(i), 16777619); return (f >>> 0).toString(36); };
let same = 0, diff = [], ta = 0, tb = 0;
const cases = [];
for (const seed of [96, 424242]) { for (let i = 0; i < 18; i++) cases.push([seed, i, {campaign: true, campaignVersion: 2}]); for (let i = 0; i < 3; i++) cases.push([seed, i, undefined]); }
for (let i = 0; i < 18; i += 5) cases.push([96, i, {campaign: true}]);
for (const [seed, i, o] of cases) {
  let t = now(); const a = JSON.stringify(A.FWorld.create(seed, i, o)); ta += now() - t;
  t = now(); const b = JSON.stringify(B.FWorld.create(seed, i, o)); tb += now() - t;
  if (fnv(a) === fnv(b) && a.length === b.length) same++; else diff.push(seed + '/' + i + '/' + JSON.stringify(o));
}
console.log(JSON.stringify({cases: cases.length, identical: same, different: diff, totalOriginalMs: Math.round(ta), totalPatchedMs: Math.round(tb)}));
