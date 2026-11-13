// Progression sans percer : sur les 39 mondes, propagation depuis le départ avec TOUS les murs intacts et les
// portes fermées tant que leur mécanisme n'est pas atteint. Marche (|dénivelé| <= 0,42 m comme move()),
// ascenseurs alimentés, propulseurs. Aucun tir, aucune destruction.
import {loadFast,worldList} from './lib.mjs';
const W=loadFast();const SEEDS=(process.env.SEEDS||'96').split(',').map(Number),CELL=.4,R=.3;
function analyse(w){
  const b=w.bounds,nx=Math.ceil((b.maxX-b.minX)/CELL),nz=Math.ceil((b.maxZ-b.minZ)/CELL),N=nx*nz;
  const H=new Float32Array(N),px=i=>b.minX+(i%nx+.5)*CELL,pz=i=>b.minZ+(Math.floor(i/nx)+.5)*CELL,idx=(x,z)=>Math.min(nz-1,Math.max(0,Math.floor((z-b.minZ)/CELL)))*nx+Math.min(nx-1,Math.max(0,Math.floor((x-b.minX)/CELL)));
  const S=8,bx0=Math.floor(b.minX/S)-1,bz0=Math.floor(b.minZ/S)-1,bw=Math.floor(b.maxX/S)-bx0+2,bd=Math.floor(b.maxZ/S)-bz0+2,buckets=Array.from({length:bw*bd},()=>[]);
  for(const c of w.colliders)for(let z=Math.floor((c.minZ-1)/S)-bz0;z<=Math.floor((c.maxZ+1)/S)-bz0;z++)for(let x=Math.floor((c.minX-1)/S)-bx0;x<=Math.floor((c.maxX+1)/S)-bx0;x++)if(x>=0&&x<bw&&z>=0&&z<bd)buckets[z*bw+x].push(c);
  const local=(x,z)=>buckets[(Math.floor(z/S)-bz0)*bw+Math.floor(x/S)-bx0]||[];
  const hit=(q,x,z,y,r)=>!(q.minY>=y+1.8-1e-7||q.maxY<=y+.06)&&(()=>{const dx=x<q.minX?x-q.minX:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?z-q.minZ:z>q.maxZ?z-q.maxZ:0;return dx*dx+dz*dz<r*r;})();
  const base=new Uint8Array(N);
  for(let i=0;i<N;i++){const x=px(i),z=pz(i),y=W.FWorld.floorHeight(w,x,z);H[i]=y??NaN;if(y===null||y===undefined)continue;if(x-R<b.minX||x+R>b.maxX||z-R<b.minZ||z+R>b.maxZ)continue;base[i]=local(x,z).some(q=>hit(q,x,z,y,R))?0:1;}
  const doors=(w.doors||[]).map(d=>({id:d.id,requires:d.requires,minX:d.x-d.w/2,maxX:d.x+d.w/2,minY:d.y||0,maxY:(d.y||0)+d.h,minZ:d.z-d.d/2,maxZ:d.z+d.d/2}));
  const active=new Set(),order=[];let seen,rounds=0;
  const segClear=(ax,ay,az,bx,by,bz)=>{const dx=bx-ax,dy=by-ay,dz=bz-az,l=Math.hypot(dx,dy,dz);if(l<.01)return true;const far=Math.max(0,l-.55);
    for(const q of w.colliders.concat(doors.filter(d=>d.requires&&!active.has(d.requires)))){let lo=0,hi=far,ok=true;for(const [o,d,min,max] of [[ax,dx/l,q.minX,q.maxX],[ay,dy/l,q.minY,q.maxY],[az,dz/l,q.minZ,q.maxZ]]){if(Math.abs(d)<1e-7){if(o<min||o>max){ok=false;break;}}else{let a=(min-o)/d,c=(max-o)/d;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo){ok=false;break;}}}if(ok&&lo>=0&&lo<far)return false;}return true;};
  for(;;){
    rounds++;const closed=doors.filter(d=>d.requires&&!active.has(d.requires));
    const free=i=>base[i]&&!closed.some(q=>hit(q,px(i),pz(i),H[i],R));
    seen=new Uint8Array(N);const queue=new Int32Array(N);let head=0,tail=0;const push=i=>{if(i>=0&&!seen[i]&&free(i)){seen[i]=1;queue[tail++]=i;}};
    push(idx(w.spawn.x,w.spawn.z));
    const reachAt=(x,z,y,rad=.7)=>{for(let dz=-rad;dz<=rad;dz+=CELL)for(let dx=-rad;dx<=rad;dx+=CELL){const i=idx(x+dx,z+dz);if(seen[i]&&Math.abs(H[i]-y)<.45)return true;}return false;};
    let grew=true;
    while(grew){
      while(head<tail){const i=queue[head++],x=i%nx,z=Math.floor(i/nx);for(const j of [x>0?i-1:-1,x<nx-1?i+1:-1,z>0?i-nx:-1,z<nz-1?i+nx:-1])if(j>=0&&!seen[j]&&Math.abs(H[j]-H[i])<=.42)push(j);}
      grew=false;
      for(const l of w.lifts||[])if(active.has(l.requires)){const lo=reachAt(l.lowerCall.x,l.lowerCall.z,l.minY),up=reachAt(l.upperCall.x,l.upperCall.z,l.maxY);if(lo!==up){const t=lo?l.upperCall:l.lowerCall,y=lo?l.maxY:l.minY;for(let dz=-.8;dz<=.8;dz+=CELL)for(let dx=-.8;dx<=.8;dx+=CELL){const i=idx(t.x+dx,t.z+dz);if(!seen[i]&&Math.abs(H[i]-y)<.45&&free(i)){push(i);grew=true;}}}}
      for(const j of w.jumpPads||[])if(reachAt(j.x,j.z,j.y??W.FWorld.floorHeight(w,j.x,j.z),.5)){const t=j.target,y=t.y??W.FWorld.floorHeight(w,t.x,t.z);for(let dz=-.8;dz<=.8;dz+=CELL)for(let dx=-.8;dx<=.8;dx+=CELL){const i=idx(t.x+dx,t.z+dz);if(!seen[i]&&Math.abs(H[i]-y)<.45&&free(i)){push(i);grew=true;}}}
    }
    let gained=false;
    for(const m of w.mechanisms||[])if(!active.has(m.id)){
      let ok=false;for(let dz=-2.6;dz<=2.6&&!ok;dz+=CELL)for(let dx=-2.6;dx<=2.6&&!ok;dx+=CELL){if(Math.hypot(dx,dz)>2.6)continue;const i=idx(m.x+dx,m.z+dz);if(seen[i]&&Math.abs(H[i]-(m.y||0))<1.05&&segClear(px(i),H[i]+1.4,pz(i),m.x,H[i]+1.4,m.z))ok=true;}
      if(ok&&!process.env.NOMECH){active.add(m.id);order.push(m.id+'@'+rounds);gained=true;}
    }
    if(!gained)break;
  }
  const at=(p,rad=.7)=>{const y=p.y??W.FWorld.floorHeight(w,p.x,p.z);for(let dz=-rad;dz<=rad;dz+=CELL)for(let dx=-rad;dx<=rad;dx+=CELL){const i=idx(p.x+dx,p.z+dz);if(seen[i]&&Math.abs(H[i]-y)<.6)return true;}return false;};
  const targets=[['départ',w.spawn],...w.cores.map((c,i)=>['relais'+(i+1),c]),['sortie',w.exit],...w.pickups.map(p=>['objet:'+(p.id||p.kind||p.type),p]),...(w.shops||[]).map(s=>['atelier:'+s.id,s]),...(w.trophies||[]).map(t=>['trophée:'+t.id,t]),...(w.bossArena?[['arène',{x:w.bossArena.x-20,z:w.bossArena.z,y:w.bossArena.y}]]:[]),...(w.encounters||[]).map(e=>['rencontre:'+e.id,{x:e.trigger.x,z:e.trigger.z,y:e.trigger.y}])];
  const missing=targets.filter(([n,p])=>!at(p,n.startsWith('rencontre')?2.5:.9)).map(([n])=>n);
  const mech=(w.mechanisms||[]).filter(m=>!active.has(m.id)).map(m=>m.id);
  return {reachable:Array.from(seen).reduce((a,v)=>a+v,0),order,mechanismsMissing:mech,missing,targets:targets.length,doors:doors.length,rounds};
}
let bad=0;
for(const seed of SEEDS)for(const {label,index,opts} of worldList()){
  if(process.env.ONLY&&!label.includes(process.env.ONLY))continue;
  const w=W.FWorld.create(seed,index,opts),r=analyse(w);const ok=!r.missing.length&&!r.mechanismsMissing.length;if(!ok)bad++;
  console.log(('seed '+seed+' '+label).padEnd(18),ok?'OK ':'KO ','cases',r.reachable,'cibles',r.targets,'ordre des mécanismes',r.order.join('>'),ok?'':'| MANQUE: '+r.missing.join(',')+' | mécanismes hors d’atteinte: '+r.mechanismsMissing.join(','));
}
console.log('mondes en échec :',bad);
