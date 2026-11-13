import {loadFast,med,BL} from './lib.mjs';
const {PATCHES}=await import(BL+'/patches.mjs');
const toMap=list=>{const m={};for(const [f,a,b] of list)(m[f]=m[f]||[]).push([a,b]);return m;};
const W0=loadFast({mods:['world']}),W1=loadFast({mods:['world'],patches:toMap(PATCHES.worldgen3)});
for(const spec of process.argv.slice(2)){const [k,i]=spec.split(':');const mk=W=>k==='c'?W.FWorld.create(96,+i,{campaign:true,campaignVersion:2}):W.FWorld.create(96,+i);
  const t=[[],[]],c=[[],[]];for(let r=0;r<7;r++){for(const v of (r%2?[1,0]:[0,1])){const c0=process.cpuUsage(),t0=performance.now();mk(v?W1:W0);t[v].push(performance.now()-t0);const u=process.cpuUsage(c0);c[v].push((u.user+u.system)/1000);}}
  const mn=a=>Math.min(...a);console.log(JSON.stringify({spec,cpuOrigMin:+mn(c[0]).toFixed(0),cpuFixMin:+mn(c[1]).toFixed(0),cpuGainMin:Math.round(100*(1-mn(c[1])/mn(c[0])))+"%",cpuOrigMed:+med(c[0]).toFixed(0),cpuFixMed:+med(c[1]).toFixed(0),cpuGainMed:Math.round(100*(1-med(c[1])/med(c[0])))+"%",origMin:+mn(t[0]).toFixed(0),fixMin:+mn(t[1]).toFixed(0),gainMin:Math.round(100*(1-mn(t[1])/mn(t[0])))+'%',origMed:+med(t[0]).toFixed(0),fixMed:+med(t[1]).toFixed(0),gainMed:Math.round(100*(1-med(t[1])/med(t[0])))+'%'}));}
