// Cost of cover() / peek() decisions (rays, time) on real campaign geometry.
// usage: node coverbench.mjs <repo> [vm|main]
import {load,rep} from './load.mjs'; import {loadMain} from './loadmain.mjs';
const [root,realm='main']=process.argv.slice(2);
globalThis.__R={ray:0};
const patch=src=>{src=rep(src,'function ray(o,d,far=80){','function ray(o,d,far=80){__R.ray++;');src=rep(src,'nav:{cells:nav,','__cover:cover,__peek:peek,__setBudget(n){routeBudget=n;},nav:{cells:nav,');return src;};
const G=realm==='vm'?load(root,{patch,extra:{__R:globalThis.__R}}):loadMain(root,{patch});const {FWorld,FSimulation}=G.window;
const R=realm==='vm'?G.__R:globalThis.__R;
const w=FWorld.create(96,9,{campaign:true,campaignVersion:2});const sim=FSimulation.create(w);const s=sim.state;
let seed=3;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;
const res={cover:{t:[],rays:[],ok:0},peek:{t:[],rays:[],ok:0}};
const actors=s.enemies.filter(e=>e.type===0).slice(0,40);
for(let rep=0;rep<3;rep++)for(const e of actors){
  // the player was last seen 9-14 m away, in a random direction
  const a=rnd()*Math.PI*2,d=9+rnd()*5;e.lastSeenX=e.x+Math.cos(a)*d;e.lastSeenZ=e.z+Math.sin(a)*d;e.lastSeenY=sim.ground(e.lastSeenX,e.lastSeenZ)+1.45;e.hasMemory=true;
  for(const k of ['cover','peek']){const x=e.x,z=e.z,path=e.path;sim.__setBudget(1e9);R.ray=0;const t=performance.now();const ok=sim['__'+k](e);res[k].t.push(performance.now()-t);res[k].rays.push(R.ray);if(ok)res[k].ok++;e.x=x;e.z=z;e.path=path;e.tactic='hold';}
}
const st=a=>{const b=a.slice().sort((x,y)=>x-y);return {mean:+(b.reduce((x,y)=>x+y,0)/b.length).toFixed(3),p50:+b[Math.floor(b.length/2)].toFixed(3),max:+b.at(-1).toFixed(3)};};
console.log(realm,JSON.stringify({solids:w.colliders.length,calls:res.cover.t.length,cover:{ms:st(res.cover.t),rays:st(res.cover.rays),success:res.cover.ok},peek:{ms:st(res.peek.t),rays:st(res.peek.rays),success:res.peek.ok}}));
