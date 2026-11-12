// Connected components of the A* graph at t=0 (exact predicate nav cell + segmentFree(.4)),
// classified by the floor that supports each cell (room floor vs fallback substrate).
// usage: node labels.mjs <repo> <scenarios>
import {loadSet,pickScen} from './lib.mjs';
const [root,filter='legacy-s0']=process.argv.slice(2);
const W=loadSet(root);
for(const [label,idx,opts] of pickScen(filter)){
  const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w);const N=sim.nav,s=sim.state;
  const floors=w.walkable,sub=floors.filter(f=>f.substrate||f.fallback),rooms=floors.filter(f=>!(f.substrate||f.fallback));
  const onRoom=(x,z)=>rooms.some(f=>Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7);
  const n=N.cells.length,comp=new Int32Array(n).fill(-1),q=new Int32Array(n),info=[];let tests=0;const t0=performance.now();
  for(let c=0;c<n;c++){if(!N.cells[c]||comp[c]>=0)continue;const id=info.length;let h=0,t=0;q[t++]=c;comp[c]=id;let subN=0;
    while(h<t){const i=q[h++],ix=i%N.nx;const [x,z]=N.coord(i);if(!onRoom(x,z))subN++;
      for(const j of [ix?i-1:-1,ix<N.nx-1?i+1:-1,i-N.nx,i+N.nx]){if(j<0||j>=n||!N.cells[j]||comp[j]>=0)continue;tests++;if(N.canTraverse(x,z,...N.coord(j),.4)){comp[j]=id;q[t++]=j;}}}
    info.push({id,size:t,sub:subN});}
  const ms=performance.now()-t0;
  const enemyComp=new Map();for(const e of s.enemies){const c=comp[N.idx(e.x,e.z)];enemyComp.set(c,(enemyComp.get(c)||0)+1);}
  const spawn=comp[N.idx(w.spawn.x,w.spawn.z)];
  const big=info.filter(c=>c.size>=50).sort((a,b)=>b.size-a.size);
  const walk=N.cells.reduce((a,b)=>a+b,0),subCells=info.reduce((a,c)=>a+c.sub,0);
  console.log(`=== ${label} cells=${n} walkable=${walk} substrateWalkable=${subCells} (${(subCells/walk*100).toFixed(0)}%) components=${info.length} (>=50 cells: ${big.length}, singletons ${info.filter(c=>c.size===1).length}) labelMs=${ms.toFixed(0)} tests=${tests}`);
  console.log('   big components: '+big.slice(0,12).map(c=>`${c.size}c/${Math.round(c.sub/c.size*100)}%sub/${enemyComp.get(c.id)||0}e${c.id===spawn?'/SPAWN':''}`).join('  '));
  const pureSub=info.filter(c=>c.sub===c.size),mixed=info.filter(c=>c.sub>0&&c.sub<c.size),interior=info.filter(c=>c.sub===0);
  console.log(`   pure-substrate components ${pureSub.length} (${pureSub.reduce((a,c)=>a+c.size,0)} cells), mixed ${mixed.length} (${mixed.reduce((a,c)=>a+c.size,0)} cells, sub ${mixed.reduce((a,c)=>a+c.sub,0)}), interior-only ${interior.length} (${interior.reduce((a,c)=>a+c.size,0)} cells)`);
  const eTot=s.enemies.length,eInSpawn=enemyComp.get(spawn)||0;console.log(`   enemies ${eTot}: in spawn component ${eInSpawn}, elsewhere ${eTot-eInSpawn} across ${[...enemyComp.keys()].filter(c=>c!==spawn).length} other components`);
}
