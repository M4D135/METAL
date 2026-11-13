import {createHarness,realNow} from './harness.mjs';
const root=process.argv[2];const H=await createHarness(root);
for(const k of Object.keys(H.C.probes))delete H.C.probes[k];
const s0=realNow();await H.startGame();const wall=realNow()-s0;
console.log('mur clic->playing ms',wall.toFixed(0));for(const [k,v] of Object.entries(H.C.probes).sort((a,b)=>b[1].ms-a[1].ms).slice(0,8))console.log(k.padEnd(16),v.ms.toFixed(1),'ms n',v.n);
process.exit(0);
