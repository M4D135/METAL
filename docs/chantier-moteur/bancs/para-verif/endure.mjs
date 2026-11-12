// Contre-verification PARA-06/12 : cles des maillages rendus, et pente du tas sur une longue chaine de mondes (meme isolat).
import {loadMain,build,drive} from '../para/load.mjs';
const win=loadMain();
{const {world,sim}=build(win,'campaign-w10');const dm=sim.destruction?.meshes||[];const keys=m=>{const k={};for(const q of m)for(const [a,v] of Object.entries(q)){const t=Array.isArray(v)?'array'+v.length:v===null?'null':typeof v;(k[a]??={})[t]=(k[a][t]||0)+1;}return k;};
 const shared=dm.filter(q=>world.meshes.includes(q)).length;
 console.log(JSON.stringify({worldMeshes:world.meshes.length,destructionMeshes:dm.length,memesObjets:shared,memeTableau:dm===world.meshes,clesDestruction:keys(dm),lights:(sim.destruction?.lights||world.lights||[]).length}));}
const mem=()=>{globalThis.gc();globalThis.gc();return +(process.memoryUsage().heapUsed/1048576).toFixed(2);};
const names=['campaign2-w6','campaign2-w10','legacy-s0'];const rows=[];const N=+(process.argv[2]||24);
function one(name){const {sim}=build(win,name);const s=sim.state,input={};let maxDebris=0,maxPart=0;for(let i=0;i<600;i++){drive(i,input);sim.step(1/60,input);s.player.hp=Math.max(s.player.hp,60);s.events.length=0;if(s.debris.length>maxDebris)maxDebris=s.debris.length;if((s.particles||[]).length>maxPart)maxPart=s.particles.length;}sim.dispose?.();return {kills:s.kills,maxDebris,maxPart};}
const base=mem();
for(let c=0;c<N;c++){const r=one(names[c%3]);if(c%3===2)rows.push({apresMondes:c+1,tasMo:mem(),...r});}
const first=rows[0].tasMo,last=rows[rows.length-1].tasMo;
console.log(JSON.stringify({tasVideMo:base,rows,penteMoParMonde:+((last-first)/(rows[rows.length-1].apresMondes-rows[0].apresMondes)).toFixed(4)}));
