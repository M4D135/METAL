// Cadence de tir réelle selon le découpage du temps (game.js:690 steps=ceil(dt*60)).
// Tir maintenu 10 s avec munitions infinies simulées ; compte les tirs par arme.
// node firerate.mjs <ferro>
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation}=ctx.window;
// Schémas de pas : liste d'intervalles d'image (ms) puis découpage comme game.js frame().
const q01=()=>{let t=0;return ()=>{const a=Math.round(t*10)/10;t+=1000/60;return Math.round(t*10)/10-a;};};
const schemes={
  'exact 1/60 (1 pas)':()=>()=>[1/60],
  'q60 game.js (16,6/16,7 ms)':()=>{const n=q01();return ()=>{const dt=n()/1000,steps=Math.max(1,Math.ceil(dt*60));return Array(steps).fill(dt/steps);};},
  '59,94 Hz game.js':()=>()=>{const dt=1/59.94,steps=Math.ceil(dt*60);return Array(steps).fill(dt/steps);},
  '144 Hz game.js':()=>()=>[1/144],
  '100 Hz game.js':()=>()=>[1/100],
  '50 fps game.js':()=>()=>{const dt=.02,steps=Math.ceil(dt*60);return Array(steps).fill(dt/steps);},
  '30 fps game.js':()=>()=>{const dt=1/30,steps=Math.max(1,Math.ceil(dt*60));return Array(steps).fill(dt/steps);},
  'pas fixe 1/120':()=>()=>[1/120],
};
const world=FWorld.create(96,0);
const out={};
for(const [name,make] of Object.entries(schemes)){
  const row={};
  for(const weapon of [0,1,2]){
    const sim=FSimulation.create(world,{inventory:{weapons:[true,true,true],ammo:[180,36,12]}});const s=sim.state;sim.selectWeapon?.(weapon);
    s.player.pitch=-1.1;// vise le sol proche : pas de dépendance aux cibles
    const next=make();let t=0,shots=0;const start=s.shots;
    while(t<10){for(const dt of next()){s.inventory.ammo[weapon]=weapon===0?180:weapon===1?36:12;s.player.heat=0;s.player.overheated=false;sim.step(dt,{fire:true,weapon});t+=dt;}}
    row[['mitraillette','double pompe','lance-roquettes'][weapon]]=s.shots-start;
  }
  out[name]=row;
}
console.log('Tirs en 10 s (tir maintenu ; chaleur et munitions neutralisées). Théorique : mitraillette 80 (0,125 s), double pompe 10,2 (0,98 s), roquettes 8 (1,25 s)');
console.table(out);
