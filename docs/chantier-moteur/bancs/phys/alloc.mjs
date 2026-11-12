// Allocation check: heap growth and GC events over 600 steps of the busiest scene (run with --expose-gc).
import {PerformanceObserver} from 'node:perf_hooks';import {SCENES} from './scenes.mjs';
let gcs=0;new PerformanceObserver(l=>{gcs+=l.getEntries().length;}).observe({entryTypes:['gc']});
for(const name of ['rubble300','blast200']){const {w}=SCENES[name]({});for(let i=0;i<300;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);w.step(1/120,1);}
  globalThis.gc();await new Promise(r=>setTimeout(r,50));const g0=gcs,h0=process.memoryUsage().heapUsed;for(let i=0;i<600;i++)w.step(1/120,1);const h1=process.memoryUsage().heapUsed;await new Promise(r=>setTimeout(r,50));
  console.log(`${name}: heapUsed delta over 600 steps ${h1-h0} bytes (${((h1-h0)/600).toFixed(1)} B/step), GC events during the window ${gcs-g0}`);}
