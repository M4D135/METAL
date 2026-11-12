import {loadMain,build} from './load.mjs';import v8 from 'node:v8';
const win=loadMain();
for(const name of ['legacy-s0','campaign2-w10']){
  let t=performance.now();const {world,sim}=build(win,name);const dt=performance.now()-t;
  const keys=Object.keys(world).map(k=>{let n=0;try{n=v8.serialize(world[k]).length;}catch(e){n=-1;}return [k,Array.isArray(world[k])?world[k].length:typeof world[k],n];}).sort((a,b)=>b[2]-a[2]);
  console.log(name,'create world+sim ms',dt.toFixed(0),'world keys:',keys.slice(0,14).map(x=>x.join(':')).join(' | '));
  console.log(' mesh[0]:',JSON.stringify(world.meshes[0]).slice(0,400));
  console.log(' mesh keys union:',[...new Set(world.meshes.flatMap(m=>Object.keys(m)))].join(','));
  const d=sim.destruction;console.log(' destruction keys:',d?Object.keys(d).join(','):'none',' meshes:',d?.meshes?.length,'lights',d?.lights?.length);
  const s=sim.state;console.log(' state keys:',Object.keys(s).map(k=>k+(Array.isArray(s[k])?'['+s[k].length+']':'')).join(' '));
  console.log(' enemy keys:',s.enemies[0]?Object.keys(s.enemies[0]).join(','):'-');
  let whole=-1;try{whole=v8.serialize(s).length;}catch(e){whole='ERR '+e.message.slice(0,80);}
  console.log(' v8.serialize(state) =',whole);
}
