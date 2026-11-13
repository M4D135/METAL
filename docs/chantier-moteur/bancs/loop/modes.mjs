// Travail fait hors jeu (game.js:675-730) : pause, menu, boutique, résultat. Et temps CPU de preparePlay.
// node modes.mjs <ferro>
import {createHarness,realNow} from './harness.mjs';
const root=process.argv[2];
const t0=realNow();const H=await createHarness(root);const tInit=realNow()-t0;
// Temps CPU réel entre le clic « start » et le mode playing (attentes rAF virtuelles exclues)
let busy=0;const frame=H.frame;H.frame=(n)=>{const a=realNow();frame(n);busy+=realNow()-a;};
const s0=realNow();await H.startGame();const wall=realNow()-s0;
console.log('init page (load(0)+settings) ms',tInit.toFixed(0),'| clic start -> playing : CPU dans les rappels rAF ms',busy.toFixed(0),'mur ms',wall.toFixed(0));
let t=H.now;for(let i=0;i<60;i++){t+=1000/60;H.frame(t);}
for(const mode of ['paused','menu','shop','cleared']){
  H.G.setMode(mode);for(const k of Object.keys(H.C.probes))delete H.C.probes[k];const d0=H.C.drawCount;H.resetDom();
  const a=realNow();for(let i=0;i<120;i++){t+=1000/60;H.frame(t);}const ms=realNow()-a;
  console.log(mode.padEnd(8),'images',120,'draw() appelés',H.C.drawCount-d0,'maillages/draw',H.C.meshes,'CPU/image ms',(ms/120).toFixed(3),'models ms/image',((H.C.probes.models?.ms||0)/120).toFixed(3),'sim.step',H.C.probes['sim.step']?.n||0);
}
process.exit(0);
