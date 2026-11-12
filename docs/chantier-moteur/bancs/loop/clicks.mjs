// Clics perdus : game.js:686 échantillonne `mouseFire` (état tenu) au début de chaque image ;
// un clic down+up entre deux images n'existe pas pour la simulation, et un clic pendant le
// délai d'arme (pistolet 0,32 s, simulation.js:1114) est ignoré s'il est relâché avant.
// Compare : actuel / appui verrouillé jusqu'à la prochaine image / tampon d'intention 150 ms.
// node clicks.mjs <ferro>
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation}=ctx.window;
const world=FWorld.create(96,0,{campaign:true,campaignVersion:2});
let seed=12345;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
function trial(frameMs,holdMs,mode,meanGap){
  seed=777;const sim=FSimulation.create(world,{armorSystem:true});const s=sim.state;s.player.pitch=-1.1;
  // clics : intervalle 120 ms + exponentielle (moyenne meanGap)
  const clicks=[];let t=500;while(t<60000){t+=120+(-Math.log(1-rnd()))*(meanGap-120);clicks.push({down:t,up:t+holdMs*(.7+rnd()*.6),shot:null});}
  let now=0,ci=0,latched=null,lastFrame=0,lastShot=-1e9;const F=frameMs;let shots0=s.shots;
  while(now<60500){
    // état au début de l'image
    const held=clicks.some(c=>c.down<=now&&now<c.up);
    let fire=held;
    const pressed=clicks.filter(c=>c.down>lastFrame&&c.down<=now);
    if(mode==='verrou'&&pressed.length)fire=true;
    if(mode==='tampon'){if(pressed.length)latched=pressed.at(-1);if(latched&&now-latched.down>150)latched=null;if(latched)fire=true;}
    const before=s.shots;
    const steps=Math.max(1,Math.ceil(F/1000*60));for(let i=0;i<steps;i++)sim.step(F/1000/steps,{fire,weapon:4});
    for(const c of pressed)c.ready=(c.down-lastShot)>=320;
    if(s.shots>before){// attribue le tir au clic le plus récent déjà enfoncé sans tir
      lastShot=now;const c=[...clicks].reverse().find(c=>c.down<=now&&c.shot===null);if(c)c.shot=now;if(mode==='tampon')latched=null;}
    lastFrame=now;now+=F;
  }
  const done=clicks.filter(c=>c.down<60000),ready=done.filter(c=>c.ready),early=done.filter(c=>!c.ready),fired=done.filter(c=>c.shot!==null);
  return {clicks:done.length,readyLost:+(ready.filter(c=>c.shot===null).length/Math.max(1,ready.length)*100).toFixed(1),earlyFired:+(early.filter(c=>c.shot!==null).length/Math.max(1,early.length)*100).toFixed(1),earlyShare:+(early.length/done.length*100).toFixed(1),delayMs:+(fired.reduce((a,c)=>a+c.shot-c.down,0)/Math.max(1,fired.length)).toFixed(1)};
}
const rows=[];
for(const [F,hold] of [[16.667,40],[16.667,80],[33.333,25],[33.333,60],[50,40]])for(const meanGap of [250,330]){
  const row={'image (ms)':F.toFixed(1),'appui (ms)':hold,'écart moyen clics (ms)':meanGap};
  for(const mode of ['actuel','verrou','tampon']){const r=trial(F,hold,mode,meanGap);if(mode==='actuel')row['% clics trop tôt']=r.earlyShare;row[mode+' prêts perdus %']=r.readyLost;row[mode+' tôt servis %']=r.earlyFired;row[mode+' délai']=r.delayMs;}
  rows.push(row);
}
console.log('Pistolet (cadence 0,32 s). prêts perdus = clic arrivé arme prête sans tir ; tôt servis = clic pendant le délai qui finit par tirer ; délai = clic -> tir (ms)');console.table(rows);
