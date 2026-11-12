// FEEL-12 independent: sustained fire 10 s per weapon (current vs proposed heat), plus cadence vs step rate.
import {load,rep,flat} from './L.mjs';
const cur=load(['destruction','economy','simulation']).FSimulation;
const pro=load(['destruction','economy','simulation'],(n,src)=>{if(n!=='simulation')return src;
  src=rep(src,"(handgun?.06:rocket?.48:grenade?.38:shotgun?shells===2?.47:.32:.09)","(handgun?.06:rocket?.34:grenade?.28:shotgun?shells===2?.36:.26:.055)");
  src=rep(src,"p.heat=Math.max(0,p.heat-dt*(fireWait>0?.1:.35)*stats.coolingMultiplier);if(p.overheated&&p.heat<.3)","p.heat=Math.max(0,p.heat-dt*(fireWait>0?.22:.55)*stats.coolingMultiplier);if(p.overheated&&p.heat<.55)");return src;}).FSimulation;
function run(S,weapon,hz,{noHeat=false,T=10,left=null}={}){
  const sim=S.create(flat(),{equipment:{right:weapon,left,shieldEnergy:100}});const s=sim.state,p=s.player;let t=0,locked=0,first=null,n=0;const n0=s.shots;
  while(t<T-1e-9){sim.step(1/hz,{fire:true,fireLeft:Number.isInteger(left),weapon});t+=1/hz;n++;if(noHeat){p.heat=0;p.overheated=false;}if(p.overheated){locked++;if(first===null)first=t;}for(let k=0;k<4;k++)s.inventory.ammo[k]=99;s.events.length=0;}
  return {shots:s.shots-n0,first:first===null?'-':first.toFixed(2),lockedPct:Math.round(locked/n*100)};
}
const names=['SMG','pompe','roquette','grenade'];
console.log('--- 10 s gachette maintenue, 60 Hz');
for(let w=0;w<4;w++){const a=run(cur,w,60),b=run(pro,w,60);console.log(names[w],'actuel',JSON.stringify(a),'| propose',JSON.stringify(b));}
{const a=run(cur,0,60,{left:1}),b=run(pro,0,60,{left:1});console.log('SMG+pompe gauche actuel',JSON.stringify(a),'| propose',JSON.stringify(b));}
console.log('--- cadence sans chaleur (tirs/s) selon le pas de simulation');
for(let w=0;w<4;w++){const r={};for(const hz of [30,50,60,72,90,100,120,144,165,240])r[hz]=+(run(cur,w,hz,{noHeat:true}).shots/10).toFixed(2);console.log(names[w],JSON.stringify(r));}
console.log('--- avec chaleur: tirs en 10 s selon le pas');
for(const hz of [60,100,120,144,240])console.log(hz,'Hz SMG',JSON.stringify(run(cur,0,hz)));
