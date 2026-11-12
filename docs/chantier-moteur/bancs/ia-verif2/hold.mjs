// Who holds when the target is unreachable? circle pilot; samples awake enemies with memory.
import {loadSet,pickScen,makeDriver} from './lib.mjs';
const [root,filter='legacy-s2',stepsArg='1800',driver='circle']=process.argv.slice(2);const W=loadSet(root);
for(const [label,idx,opts] of pickScen(filter)){
  const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const N=sim.nav,s=sim.state,n=N.cells.length;
  const comp=new Int32Array(n).fill(-1),q=new Int32Array(n),size=[];
  for(let c=0;c<n;c++){if(!N.cells[c]||comp[c]>=0)continue;const id=size.length;let h=0,t=0;q[t++]=c;comp[c]=id;
    while(h<t){const i=q[h++],ix=i%N.nx;const [x,z]=N.coord(i);for(const j of [ix?i-1:-1,ix<N.nx-1?i+1:-1,i-N.nx,i+N.nx]){if(j<0||j>=n||!N.cells[j]||comp[j]>=0)continue;if(N.canTraverse(x,z,...N.coord(j),.4)){comp[j]=id;q[t++]=j;}}}size.push(t);}
  const near=(x,z)=>{let best=-1,bd=1e9;const c=N.idx(x,z),cx=c%N.nx,cz=Math.floor(c/N.nx);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const j=(cz+dz)*N.nx+cx+dx;if(j<0||j>=n||!N.cells[j])continue;const [px,pz]=N.coord(j),d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best=j;}}return best<0?-1:comp[best];};
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  const T={};let samples=0;const ids=new Map();
  for(let i=0;i<+stepsArg;i++){drive(i,input);sim.step(1/60,input);s.events.length=0;if(s.dead)break;
    if(i%30===29){const pc=near(s.player.x,s.player.z);for(const e of s.enemies){if(e.hp<=0||e.sleeping||!e.hasMemory)continue;samples++;const same=near(e.x,e.z)===pc;const hold=e.tactic==='hold'&&e.windup<=0;const k=(same?'sameComp':'otherComp')+'/'+(hold?'hold':'other')+(e.seen?'/seen':'/unseen');T[k]=(T[k]||0)+1;if(!same)ids.set(e.id,{type:e.type,ey:+e.baseY.toFixed(1),py:+s.player.y.toFixed(1),d:+Math.hypot(e.x-s.player.x,e.z-s.player.z).toFixed(1),ec:near(e.x,e.z)+'('+size[near(e.x,e.z)]+')',pc:pc+'('+size[pc]+')'});}}}
  console.log(`=== ${label} ${driver} samples=${samples} ${JSON.stringify(T)} doorsOpen=${s.doors.filter(d=>d.open).length}/${s.doors.length} dead=${s.dead} playerEnd=(${s.player.x.toFixed(1)},${s.player.y.toFixed(1)},${s.player.z.toFixed(1)})`);
  console.log('   otherComp enemies: '+JSON.stringify([...ids].slice(0,6)));
}
