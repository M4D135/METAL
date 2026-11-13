// STAB — coût unitaire d'une sonde exclusive (entrée + sortie) selon l'horloge, et nombre de sondes par image.
import {createHarness, cpuNow, CNT, resetProbes} from './harness.mjs';
import {performance} from 'node:perf_hooks';
const H = await createHarness(process.argv[2]);
let t = 0; for (let i = 0; i < 30; i++) { t += 16.667; H.frame(t); }
await H.startGame(); H.now = 1e6; H.G.setMode('playing'); t = H.now; H.G.fire = true; const per = [];
for (let i = 0; i < 300; i++) { t += 1000 / 60; resetProbes(); H.frame(t); let n = 0; for (let k = 0; k < CNT.length; k++) n += CNT[k]; per.push(n); }
per.sort((a, b) => a - b);
function bench(clock) { const child = new Float64Array(8), EXC = new Float64Array(8); let sp = 0, best = Infinity; const enter = () => { child[++sp] = 0; return clock(); }, leave = (id, t0) => { const d = clock() - t0; EXC[id] += d - child[sp]; sp--; child[sp] += d; };
  for (let r = 0; r < 7; r++) { const a = performance.now(); for (let i = 0; i < 200000; i++) { const t0 = enter(); leave(1, t0); } best = Math.min(best, (performance.now() - a) / 200000 * 1e6); } return Math.round(best); }
console.log(JSON.stringify({probesPerFrame: {p50: per[150], p95: per[285], max: per[299]}, nsPerProbe: {performanceNow: bench(() => performance.now()), threadCpu: bench(cpuNow)}}));
process.exit(0);
