import {createHarness, realNow} from './harness.mjs';
const root=process.argv[2];
let t0=realNow();
const H=await createHarness(root);
console.log('created',(realNow()-t0).toFixed(0),'ms mode',H.G.mode);
t0=realNow();let t=0;for(let i=0;i<5;i++){t+=16.667;const a=realNow();H.frame(t);console.log('menu frame',i,(realNow()-a).toFixed(1));}
H.doc.getElementById('start').click();
for(let i=0;i<400&&H.G.mode!=='playing';i++){const a=realNow();H.frame(H.now+16.667);const d=realNow()-a;if(i<5||d>5||i%50===0)console.log('load frame',i,H.G.mode,d.toFixed(1),'ms');await new Promise(r=>setTimeout(r,0));}
console.log('mode',H.G.mode,(realNow()-t0).toFixed(0));
process.exit(0);
