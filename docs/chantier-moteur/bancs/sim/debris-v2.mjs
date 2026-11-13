import {mirrorPatch} from './mirror.mjs';
// Exact debris optimisations for simulation.js (673d6b2):
//  (a) resting pieces supported by the floor or a STATIC collider sleep until the destruction revision changes
//      (dynamic boxes can only add support; disabled if the world has floor traps, which move ground());
//  (b) debrisBoxes without Set/Array.from (index buckets + stamps, identical order);
//  (c) 2-entry memo in debrisFloor (pure within updateDebris);
//  (d) foliage extents over the 38 unique points instead of 216 (same arithmetic order).
const R=[];
R.push(["if(debrisFoliage.length)return Math.max(...debrisFoliage.map(p=>Math.abs(p.reduce((n,x,k)=>n+x*v[k],0))));",
        "if(debrisFoliage.length){let m=-Infinity;for(let j=0;j<debrisFoliage.length;j++){const p=debrisFoliage[j],d=Math.abs(0+p[0]*v[0]+p[1]*v[1]+p[2]*v[2]);if(d>m)m=d;}return m;}"]);
R.push(["if(!debrisFoliage)debrisFoliage=G.FRender?.foliageTriangles?.().flat()||[];",
        "if(!debrisFoliage){const seen=new Set();debrisFoliage=(G.FRender?.foliageTriangles?.().flat()||[]).filter(p=>{if(p.length!==3)return true;const k=p.join(',');if(seen.has(k))return false;seen.add(k);return true;});}"]);
R.push([`    function debrisFloor(x,z,h){
      return Math.max(ground(x,z),ground(x-h[0],z-h[2]),ground(x+h[0],z-h[2]),ground(x-h[0],z+h[2]),ground(x+h[0],z+h[2]));
    }`,`    let dfX0=NaN,dfZ0=NaN,dfA0=NaN,dfC0=NaN,dfV0=0,dfX1=NaN,dfZ1=NaN,dfA1=NaN,dfC1=NaN,dfV1=0,dfTurn=0;
    function debrisFloor(x,z,h){
      const a=h[0],c=h[2];
      if(x===dfX0&&z===dfZ0&&a===dfA0&&c===dfC0)return dfV0;
      if(x===dfX1&&z===dfZ1&&a===dfA1&&c===dfC1)return dfV1;
      const v=Math.max(ground(x,z),ground(x-a,z-c),ground(x+a,z-c),ground(x-a,z+c),ground(x+a,z+c));
      if(dfTurn){dfX1=x;dfZ1=z;dfA1=a;dfC1=c;dfV1=v;}else{dfX0=x;dfZ0=z;dfA0=a;dfC0=c;dfV0=v;}dfTurn^=1;return v;
    }`]);
R.push([`      const x0=Math.max(0,Math.floor((q.x-h[0]-reach)/bucketSize)-bucketX),x1=Math.min(bucketWidth-1,Math.floor((q.x+h[0]+reach)/bucketSize)-bucketX),z0=Math.max(0,Math.floor((q.z-h[2]-reach)/bucketSize)-bucketZ),z1=Math.min(bucketDepth-1,Math.floor((q.z+h[2]+reach)/bucketSize)-bucketZ),found=new Set(dynamic);
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)for(const box of collisionBuckets[z*bucketWidth+x])found.add(box);
      return Array.from(found).filter(box=>box.minX<q.x+h[0]+reach+.02&&box.maxX>q.x-h[0]-reach-.02&&box.minZ<q.z+h[2]+reach+.02&&box.maxZ>q.z-h[2]-reach-.02);`,
`      const x0=Math.max(0,Math.floor((q.x-h[0]-reach)/bucketSize)-bucketX),x1=Math.min(bucketWidth-1,Math.floor((q.x+h[0]+reach)/bucketSize)-bucketX),z0=Math.max(0,Math.floor((q.z-h[2]-reach)/bucketSize)-bucketZ),z1=Math.min(bucketDepth-1,Math.floor((q.z+h[2]+reach)/bucketSize)-bucketZ),out=[];
      const ax=q.x+h[0]+reach+.02,bx=q.x-h[0]-reach-.02,az=q.z+h[2]+reach+.02,bz=q.z-h[2]-reach-.02;
      for(let k=0;k<dynamic.length;k++){const box=dynamic[k];if(box.minX<ax&&box.maxX>bx&&box.minZ<az&&box.maxZ>bz)out.push(box);}
      ensureMirror();if(++solidSerial>=4294967295){solidStamp.fill(0);solidSerial=1;}const stamp=solidSerial;
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const cell=z*bucketWidth+x;for(let o=mirrorStart[cell],end=mirrorStart[cell+1];o<end;o++){const n=mirrorIdx[o];if(solidStamp[n]===stamp)continue;solidStamp[n]=stamp;const box=solids[n];if(box.minX<ax&&box.maxX>bx&&box.minZ<az&&box.maxZ>bz)out.push(box);}}
      return out;`]);
R.push([`      for(const q of s.debris){
        q.age=Math.min(1e7,q.age+dt);q.impactWait=Math.max(0,(q.impactWait||0)-dt);if(!q.structural&&q.age>=q.life||dt<=0)continue;`,
`      dfX0=dfX1=NaN;
      for(const q of s.debris){
        q.age=Math.min(1e7,q.age+dt);q.impactWait=Math.max(0,(q.impactWait||0)-dt);if(!q.structural&&q.age>=q.life||dt<=0)continue;
        if(q.resting&&debrisSleep.get(q)===seenDestructionRevision)continue;`]);
R.push(["        if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes)))continue;q.resting=false;q.settleTime=0;}",
        "        if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes))){if(debrisSleepOK&&debrisStaticSupport(q,h,boxes,dynamic))debrisSleep.set(q,seenDestructionRevision);continue;}q.resting=false;q.settleTime=0;debrisSleep.delete(q);}"]);
R.push(["    function debrisSweep(q,h,delta,boxes){",
`    const debrisSleep=new WeakMap(),debrisSleepOK=!(world.traps||[]).some(t=>t.kind==='floor');
    function debrisStaticSupport(q,h,boxes,dynamic){
      // Same predicates as debrisSupport, restricted to the floor and static colliders.
      const bottom=q.y-h[1];if(Math.abs(bottom-debrisFloor(q.x,q.z,h))<.018)return true;
      for(const box of boxes)if(!dynamic.includes(box)&&Math.abs(bottom-box.maxY)<.018&&q.x+h[0]>box.minX+.002&&q.x-h[0]<box.maxX-.002&&q.z+h[2]>box.minZ+.002&&q.z-h[2]<box.maxZ-.002)return true;
      return false;
    }
    function debrisSweep(q,h,delta,boxes){`]);
export const debrisV2={simulation:R};
export const debrisPatch=()=>({simulation:[mirrorPatch,...R]});
