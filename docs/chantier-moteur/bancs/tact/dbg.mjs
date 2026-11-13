import {boot} from './lib.mjs';
const root=process.argv[2];
const B=await boot(root,{touch:false});B.record(true);
const modes=[];let prev=0;
for(let f=0;f<210;f++){B.play(16.667);modes.push(B.H.G.mode+':'+(B.rec.length-prev));prev=B.rec.length;}
const h={};for(const m of modes)h[m]=(h[m]||0)+1;console.log(h);
const d={};for(const r of B.rec){const k=r.dt.toFixed(6);d[k]=(d[k]||0)+1;}console.log(d);
console.log(modes.slice(0,40).join(' '));
