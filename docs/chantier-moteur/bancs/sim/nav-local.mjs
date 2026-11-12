// Dirty-rectangle nav refresh (variant keeping the forced replan of every enemy, as the original does).
// Changed colliders are found by value (old vs new destruction.colliders), doors by their box.
const SYNC_OLD='solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;unsupportedBodies();';
const SYNC_NEW='{const navOld=solids;solids=destruction.colliders;navDiff(navOld,solids);}seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;unsupportedBodies();';
const DOOR_OLD="d.open=d.progress>=1;if(d.open&&!was){navDirty=true;";
const DOOR_NEW="d.open=d.progress>=1;if(d.open&&!was){navDirty=true;navMark(doorBoxes[s.doors.indexOf(d)]);";
const BREAK_OLD="d.destroyed=true;d.progress=1;d.open=true;navDirty=true;";
const BREAK_NEW="d.destroyed=true;d.progress=1;d.open=true;navDirty=true;navMark(doorBoxes[i]);";
const REFRESH_OLD=`        for(let i=0;i<nav.length;i++)if(!navQueued[i]){navQueued[i]=1;navQueue[navTail]=i;navTail=(navTail+1)%nav.length;navPending++;}
      }else{navHead=navTail=navPending=0;navQueued.fill(0);for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}}
      edgeKnown.fill(0);edgeOpen.fill(0);if(reset)`;
const REFRESH_NEW=`        // Only cells whose centre lies within 0.4 m of a changed box can change; an edge
        // (0.8 m long, swept with r=0.4) can only change within 1.2 m of its source cell.
        for(let k=0;k<navRects.length;k+=4){
          const ax=navRects[k],bx=navRects[k+1],az=navRects[k+2],bz=navRects[k+3];
          const ex0=clamp(Math.floor((ax-1.2-1e-6-b.minX)/cell),0,nx-1),ex1=clamp(Math.ceil((bx+1.2+1e-6-b.minX)/cell),0,nx-1),ez0=clamp(Math.floor((az-1.2-1e-6-b.minZ)/cell),0,nz-1),ez1=clamp(Math.ceil((bz+1.2+1e-6-b.minZ)/cell),0,nz-1);
          for(let iz=ez0;iz<=ez1;iz++)for(let ix=ex0;ix<=ex1;ix++){
            const i=iz*nx+ix,x=b.minX+ix*cell,z=b.minZ+iz*cell;edgeKnown[i]=0;edgeOpen[i]=0;
            if(!navQueued[i]&&x>=ax-.4-1e-6&&x<=bx+.4+1e-6&&z>=az-.4-1e-6&&z<=bz+.4+1e-6){navQueued[i]=1;navQueue[navTail]=i;navTail=(navTail+1)%nav.length;navPending++;}
          }
        }
        navRects.length=0;
      }else{navRects.length=0;navHead=navTail=navPending=0;navQueued.fill(0);for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}edgeKnown.fill(0);edgeOpen.fill(0);}
      if(reset)`;
const HELPERS_AT='    function refreshNav(reset=true){';
const HELPERS=`    const navRects=[];
    function navMark(q){if(q)navRects.push(q.minX,q.maxX,q.minZ,q.maxZ);}
    const navF64=new Float64Array(6),navU32=new Uint32Array(navF64.buffer);
    function navHash(q){navF64[0]=q.minX;navF64[1]=q.maxX;navF64[2]=q.minY;navF64[3]=q.maxY;navF64[4]=q.minZ;navF64[5]=q.maxZ;let h=2166136261;for(let k=0;k<12;k++)h=Math.imul(h^navU32[k],16777619);return h|0;}
    function navDiff(a,c){
      // Multiset difference by exact value (hash buckets, then field-by-field equality).
      if(a===c)return;const pool=new Map();
      for(const q of a){const h=navHash(q);let l=pool.get(h);if(!l)pool.set(h,l=[]);l.push(q);}
      for(const q of c){const l=pool.get(navHash(q));let k=-1;if(l)for(let j=0;j<l.length;j++){const o=l[j];if(o.minX===q.minX&&o.maxX===q.maxX&&o.minY===q.minY&&o.maxY===q.maxY&&o.minZ===q.minZ&&o.maxZ===q.maxZ){k=j;break;}}
        if(k>=0){l[k]=l[l.length-1];l.pop();}else navMark(q);}
      for(const l of pool.values())for(const q of l)navMark(q);
    }
`;
export const navLocal={simulation:[[SYNC_OLD,SYNC_NEW],[DOOR_OLD,DOOR_NEW],[BREAK_OLD,BREAK_NEW],[REFRESH_OLD,REFRESH_NEW],[HELPERS_AT,HELPERS+HELPERS_AT]]};
export const navLocalPatch=()=>navLocal;
