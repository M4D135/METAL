// TACT (5) : clavier, tactile et manette produisent-ils la même structure `input` ? À flux égal, hash d'état égal ?
// node equiv.mjs <racine METAL>
// K  = clavier (vrai game.js), T = tactile (vrai game.js, ?touch=1), K2 = clavier + Maj, P = manette (prototype
// bench/feel/gamepad-map.mjs branché sur le même format). Rejeux directs dans une simulation neuve : R(flux).
import {boot,stateHash} from './lib.mjs';
import {createPad} from '../feel/gamepad-map.mjs';
const root=process.argv[2];
const FIELDS=['moveX','moveY','lookX','lookY','fire','fireLeft','dash','pulse','melee','interact','weapon','sprint','assist'];
async function session(kind){
  const B=await boot(root,{touch:kind==='T'});B.record(true);const ev=[];
  if(kind==='T'){ev.push({t:0,fn:t=>{B.P.down(1,'move-zone',74,544,t);B.P.move(1,74,544-60,t);}},{t:2000,fn:t=>B.P.down(2,'fire-button',330,555,t)},{t:3000,fn:t=>B.P.up(2,t)},{t:3200,fn:t=>B.P.up(1,t)});}
  else{ev.push({t:0,fn:()=>{B.key('keydown','KeyW');if(kind==='K2')B.key('keydown','ShiftLeft');}},{t:2000,fn:()=>B.key('keydown','Enter')},{t:3000,fn:()=>B.key('keyup','Enter')},{t:3200,fn:()=>{B.key('keyup','KeyW');B.key('keyup','ShiftLeft');}});}
  B.play(3500,ev,16.6);
  return {rec:B.rec.map(r=>({...r})),hash:stateHash(B.sim),shots:B.sim.state.shots,x:B.sim.state.player.x,z:B.sim.state.player.z,speed:B.sim.state.locomotion.speed};
}
async function replay(rec,map=r=>r){const B=await boot(root,{touch:false});for(const r of rec)B.sim.step(r.dt,map({...r}));return {hash:stateHash(B.sim),shots:B.sim.state.shots};}
const diff=(a,b,fields=FIELDS)=>{const d={};const n=Math.min(a.length,b.length);for(let i=0;i<n;i++)for(const f of fields)if(!Object.is(a[i][f],b[i][f])&&!(a[i][f]===0&&b[i][f]===0))d[f]=(d[f]||0)+1;return {pas:[a.length,b.length],dtEgaux:a.length===b.length&&a.every((r,i)=>r.dt===b[i].dt),champsDifferents:d};};
const K=await session('K'),T=await session('T'),K2=await session('K2');
const out={};
out.structure={clavier:Object.keys(K.rec[0]).join(','),tactile:Object.keys(T.rec[0]).join(','),types:FIELDS.map(f=>f+':'+typeof K.rec[10][f]).join(' ')};
out.clavier_vs_tactile={...diff(K.rec,T.rec),hashClavier:K.hash,hashTactile:T.hash,tirs:[K.shots,T.shots]};
// rejeu direct du flux tactile dans une simulation neuve : l'état ne dépend que du flux
const RT=await replay(T.rec);out.rejeu_flux_tactile={hashSession:T.hash,hashRejeu:RT.hash,egal:T.hash===RT.hash};
const RK=await replay(K.rec);out.rejeu_flux_clavier={hashSession:K.hash,hashRejeu:RK.hash,egal:K.hash===RK.hash};
// même flux tactile avec assist forcé à false : égal au clavier ?
const RTa=await replay(T.rec,r=>(r.assist=false,r));out.flux_tactile_sans_assist={hash:RTa.hash,egalAuClavier:RTa.hash===K.hash};
// flux tactile rejoué avec les dt du clavier et assist=false : seul le pas de temps séparait les deux sessions ?
const RTd=await replay(T.rec.map((r,i)=>({...r,dt:K.rec[i].dt,assist:false})));out.flux_tactile_avec_dt_du_clavier={hash:RTd.hash,egalAuClavier:RTd.hash===K.hash,ecartDtMax:Math.max(...T.rec.map((r,i)=>Math.abs(r.dt-K.rec[i].dt)))};
const RTe=await replay(T.rec.map((r,i)=>({...r,dt:K.rec[i].dt})));out.flux_tactile_avec_dt_du_clavier.hashAvecAssist=RTe.hash;
// manette (prototype FEEL-10) : même intention, mêmes pas de temps que K2
const poll=createPad();let t=16.6;const P=K2.rec.map(r=>{const pad={axes:[0,t<3200?-1:0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:false,value:i===7&&t>=2000&&t<3000?1:0}))};const g=poll(pad,r.dt);t+=r.dt*1000;
  return {...r,moveX:g.moveX,moveY:g.moveY,lookX:g.lookX,lookY:g.lookY,fire:g.fire,fireLeft:g.fireLeft,sprint:g.sprint};});
out.manette_vs_clavierMaj={...diff(K2.rec,P,['moveX','moveY','lookX','lookY','fire','fireLeft','sprint'])};
const RP=await replay(P);out.manette_vs_clavierMaj.hashManette=RP.hash;out.manette_vs_clavierMaj.hashClavierMaj=K2.hash;out.manette_vs_clavierMaj.egal=RP.hash===K2.hash;
out.vitesses={clavier:+K.speed.toFixed(2),tactile:+T.speed.toFixed(2),clavierMaj:+K2.speed.toFixed(2)};
// champs réellement lus par la simulation mais absents du flux tactile actuel
out.note='Le tir part à 2000 ms : avec assist=true (tactile) le rayon gagne jusqu’à 0,38 m pour l’arme 0 et 0,16 m pour les autres (simulation.js:848).';
console.log(JSON.stringify(out,null,1));
