// Component of each encounter trigger vs its spawn entries at t=0, and what each door joins.
import {loadSet,pickScen} from './lib.mjs';
const [root,filter='v2-w01']=process.argv.slice(2);const W=loadSet(root);
for(const [label,idx,opts] of pickScen(filter)){
  const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w);const N=sim.nav,s=sim.state,n=N.cells.length;
  const comp=new Int32Array(n).fill(-1),q=new Int32Array(n),size=[];
  for(let c=0;c<n;c++){if(!N.cells[c]||comp[c]>=0)continue;const id=size.length;let h=0,t=0;q[t++]=c;comp[c]=id;
    while(h<t){const i=q[h++],ix=i%N.nx;const [x,z]=N.coord(i);for(const j of [ix?i-1:-1,ix<N.nx-1?i+1:-1,i-N.nx,i+N.nx]){if(j<0||j>=n||!N.cells[j]||comp[j]>=0)continue;if(N.canTraverse(x,z,...N.coord(j),.4)){comp[j]=id;q[t++]=j;}}}size.push(t);}
  const near=(x,z)=>{let best=-1,bd=1e9;const c=N.idx(x,z),cx=c%N.nx,cz=Math.floor(c/N.nx);for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const j=(cz+dz)*N.nx+cx+dx;if(j<0||j>=n||!N.cells[j])continue;const [px,pz]=N.coord(j),d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best=j;}}return best<0?'none':comp[best]+'('+size[comp[best]]+')';};
  console.log(`=== ${label} spawn comp ${near(w.spawn.x,w.spawn.z)} doors=${s.doors.length}`);
  for(const d of s.doors){const a=[[d.x+2.4,d.z],[d.x-2.4,d.z],[d.x,d.z+2.4],[d.x,d.z-2.4]].map(([x,z])=>near(x,z));console.log(`  door ${d.id} at (${d.x.toFixed(1)},${d.z.toFixed(1)}) requires=${JSON.stringify(d.requires)} open=${d.open} sides=${[...new Set(a)].join(' | ')}`);}
  for(const e of s.encounters||[]){const ent=(e.spawnEntries||[]).map(c=>near(c.x,c.z));const cnt={};for(const c of ent)cnt[c]=(cnt[c]||0)+1;
    console.log(`  ${e.id} trig (${e.trigger.x.toFixed(1)},${e.trigger.z.toFixed(1)},y${e.trigger.y||0}) comp ${near(e.trigger.x,e.trigger.z)} natural=${!!e.naturalEntries} waves=${e.waves.length} entries=${JSON.stringify(cnt)} boss=${!!w.rooms?.[e.zoneId]?.bossArena} requiresTrophy=${e.requiresTrophy||''}`);}
  console.log('  mechanisms '+JSON.stringify((w.mechanisms||[]).map(m=>({id:m.id,kind:m.kind,x:+m.x?.toFixed(1),z:+m.z?.toFixed(1),comp:near(m.x,m.z)}))).slice(0,600));
}
