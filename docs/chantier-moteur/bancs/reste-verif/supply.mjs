// RESTE-verif: what feeds supplyModel in the 400-frame and 1800-frame windows? pickups (static world) or loot (kills)?
import {scene} from './scene.mjs';
const S=scene({variant:'r1',world:['camp',6]});const s=S.sim.state,p=s.player;
const near=(c)=>(c.x-p.x)**2+(c.z-p.z)**2<73*73;
const vis=c=>!c.taken; // upper bound of supplyVisible
let acc={pick:0,loot:0,list:0,debris:0,n:0};const rows=[];
for(let i=0;i<2040;i++){const f=S.frame();if(i<240)continue;
  acc.pick+=s.pickups.filter(c=>vis(c)&&near(c)).length;acc.loot+=s.loot.filter(c=>vis(c)&&near(c)).length;acc.list+=f.dynamic;acc.debris+=s.debris.length;acc.n++;
  if(i===639||i===2039){rows.push({upto:i+1,...Object.fromEntries(Object.entries(acc).map(([k,v])=>[k,k==='n'?v:+(v/acc.n).toFixed(1)])),lootTotal:s.loot.length,kills:s.kills});}}
console.log(JSON.stringify(rows));
