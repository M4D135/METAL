import {mirrorPatch} from './mirror.mjs';
// Exact blocked()/segmentFree() rewrites for simulation.js (673d6b2).
//  blocked: no per-call [boxes,doors,traps] array; static bucket boxes mirrored as Float64Array SoA
//           (same values, boolean OR so order is irrelevant).
//  segmentFree: ground() at the endpoints computed once (was 2x: blocked default + groundAt),
//           slab test unrolled (no [[...],[...]] and [a,c]=[c,a] allocations per box).
const B=[];
B.push([`    function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){
      if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ||!Number.isFinite(y))return true;
      const boxes=staticBoxes===solids&&r>=0&&r<=bucketRadius?collisionBuckets[(Math.floor(z/bucketSize)-bucketZ)*bucketWidth+Math.floor(x/bucketSize)-bucketX]||staticBoxes:staticBoxes;
      for(const list of [boxes,doors,traps])for(const q of list){
        if(q.minY>=y+height-1e-7||q.maxY<=y+.06)continue;
        const dx=x<q.minX?x-q.minX:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?z-q.minZ:z>q.maxZ?z-q.maxZ:0;
        if(dx*dx+dz*dz<r*r)return true;
      }
      return false;
    }`,`    function blockedList(list,x,z,rr,top,bottom){
      for(let k=0;k<list.length;k++){const q=list[k];
        if(q.minY>=top||q.maxY<=bottom)continue;
        const dx=x<q.minX?x-q.minX:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?z-q.minZ:z>q.maxZ?z-q.maxZ:0;
        if(dx*dx+dz*dz<rr)return true;
      }
      return false;
    }
    function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){
      if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ||!Number.isFinite(y))return true;
      const top=y+height-1e-7,bottom=y+.06,rr=r*r;
      const cell=staticBoxes===solids&&r>=0&&r<=bucketRadius?(Math.floor(z/bucketSize)-bucketZ)*bucketWidth+Math.floor(x/bucketSize)-bucketX:-1;
      if(cell>=0&&cell<collisionBuckets.length){ensureMirror();const a=mirrorBox;for(let k=mirrorStart[cell]*6,end=mirrorStart[cell+1]*6;k<end;k+=6){
        if(a[k+2]>=top||a[k+3]<=bottom)continue;
        const minX=a[k],maxX=a[k+1],minZ=a[k+4],maxZ=a[k+5],dx=x<minX?x-minX:x>maxX?x-maxX:0,dz=z<minZ?z-minZ:z>maxZ?z-maxZ:0;
        if(dx*dx+dz*dz<rr)return true;
      }}else if(blockedList(staticBoxes,x,z,rr,top,bottom))return true;
      return blockedList(doors,x,z,rr,top,bottom)||blockedList(traps,x,z,rr,top,bottom);
    }`]);
export const blockedV2={simulation:B};
const S=[];
S.push([`      if(blocked(ax,az,r)||blocked(bx,bz,r))return false;
      const dx=bx-ax,dz=bz-az,ay=groundAt(ax,az),by=groundAt(bx,bz),minX=Math.min(ax,bx)-r-1e-7,maxX=Math.max(ax,bx)+r+1e-7,minZ=Math.min(az,bz)-r-1e-7,maxZ=Math.max(az,bz)+r+1e-7;`,
`      const ga=ground(ax,az);if(blocked(ax,az,r,ga))return false;const gb=ground(bx,bz);if(blocked(bx,bz,r,gb))return false;
      const dx=bx-ax,dz=bz-az,ay=Number.isFinite(ga)?ga:0,by=Number.isFinite(gb)?gb:0,minX=Math.min(ax,bx)-r-1e-7,maxX=Math.max(ax,bx)+r+1e-7,minZ=Math.min(az,bz)-r-1e-7,maxZ=Math.max(az,bz)+r+1e-7;`]);
S.push([`      for(const list of [local,doorBoxes])for(const q of list){
        if(q.maxY<=Math.min(ay,by)+.06||q.minY>=Math.max(ay,by)+1.8)continue;
        // Most A* edge checks are shorter than a metre: discard remote boxes
        // before building intervals, without approximating the remaining sweep.
        if(q.maxX<minX||q.minX>maxX||q.maxZ<minZ||q.minZ>maxZ)continue;
        let lo=0,hi=1;
        for(const [origin,delta,min,max] of [[ax,dx,q.minX-r,q.maxX+r],[az,dz,q.minZ-r,q.maxZ+r]]){
          if(Math.abs(delta)<1e-8){if(origin<min||origin>max){hi=-1;break;}}
          else {let a=(min-origin)/delta,c=(max-origin)/delta;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&hi>=0&&lo<=1)return false;
      }`,`      const low=Math.min(ay,by)+.06,high=Math.max(ay,by)+1.8;
      for(let pass=0;pass<2;pass++){const list=pass?doorBoxes:local;for(let n=0;n<list.length;n++){const q=list[n];
        if(q.maxY<=low||q.minY>=high)continue;
        if(q.maxX<minX||q.minX>maxX||q.maxZ<minZ||q.minZ>maxZ)continue;
        let lo=0,hi=1;
        {const min=q.minX-r,max=q.maxX+r;if(Math.abs(dx)<1e-8){if(ax<min||ax>max)hi=-1;}else{let a=(min-ax)/dx,c=(max-ax)/dx;if(a>c){const t=a;a=c;c=t;}lo=Math.max(lo,a);hi=Math.min(hi,c);}}
        if(hi>=lo){const min=q.minZ-r,max=q.maxZ+r;if(Math.abs(dz)<1e-8){if(az<min||az>max)hi=-1;}else{let a=(min-az)/dz,c=(max-az)/dz;if(a>c){const t=a;a=c;c=t;}lo=Math.max(lo,a);hi=Math.min(hi,c);}}
        if(hi>=lo&&hi>=0&&lo<=1)return false;
      }}`]);
export const segmentV2={simulation:S};
export const blockedPatch=()=>({simulation:[mirrorPatch,...B]});
export const segmentPatch=()=>segmentV2;
export const bothPatch=()=>({simulation:[mirrorPatch,...B,...S]});
