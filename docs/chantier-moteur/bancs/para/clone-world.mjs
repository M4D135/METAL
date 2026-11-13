// PARA : un monde passe par clonage structure (ce que fait postMessage) donne-t-il la meme simulation ?
import v8 from 'node:v8';import {loadMain,SCENARIOS,drive,digest} from './load.mjs';
const win=loadMain();const {FWorld,FSimulation,FBrain}=win;
for(const name of ['campaign2-w10','legacy-s0']){
  const [idx,opts]=SCENARIOS[name];const w1=FWorld.create(96,idx,opts);const bytes=v8.serialize(w1);const w2=v8.deserialize(bytes);
  // decoupe en tranches : maillages envoyes a part (references croisees perdues ?)
  const {meshes,...rest}=w1;const w3={...v8.deserialize(v8.serialize(rest)),meshes:[]};for(let i=0;i<meshes.length;i+=2000)w3.meshes.push(...v8.deserialize(v8.serialize(meshes.slice(i,i+2000))));
  const run=w=>{const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})}),s=sim.state,input={};let h=2166136261;for(let i=0;i<900;i++){drive(i,input);sim.step(1/60,input);s.player.hp=Math.max(s.player.hp,60);h=digest(s,h);s.events.length=0;}return (h>>>0)+':'+JSON.stringify(sim.snapshot()).length;};
  // identites partagees : un maillage du monde est-il aussi reference ailleurs dans le monde ?
  const set=new Set(w1.meshes);let shared=0;const seen=new Set();(function walk(o,d){if(o===null||typeof o!=='object'||seen.has(o)||d>6)return;seen.add(o);if(o===w1.meshes)return;for(const k in o){const v=o[k];if(v&&typeof v==='object'){if(set.has(v))shared++;else walk(v,d+1);}}})(w1,0);
  const a=run(w1),b=run(w2),c=run(w3);
  console.log(name,'octets',bytes.length,'| original',a,'| clone entier',b,b===a?'IDENTIQUE':'DIFFERENT','| clone en tranches',c,c===a?'IDENTIQUE':'DIFFERENT','| references partagees vers des maillages hors world.meshes :',shared);
}
