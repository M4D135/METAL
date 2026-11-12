// Exact broad phase for ray() and castProjectile() (simulation.js 673d6b2), reusing the 8 m collision
// buckets (boxes already expanded by 1.05 m). ray(): 2D DDA from the origin, stops once the next cell starts
// beyond the best hit (distance-only result, order-independent min). castProjectile(): gathers every box
// of the cells crossed up to `far`, then tests them IN ORIGINAL ARRAY ORDER (normal tie-breaks preserved).
import {mirrorPatch} from './mirror.mjs';
const R=[];
R.push([`    function ray(o,d,far=80){
      let best=far;
      for(const list of [solids,doorBoxes,trapBoxes])for(const q of list){`,`    function rayCells(o,d,far,visit){
      // Amanatides-Woo walk over collisionBuckets cells in XZ. visit(cell) returns the current bound.
      let ix=Math.floor(o[0]/bucketSize)-bucketX,iz=Math.floor(o[2]/bucketSize)-bucketZ;
      if(!(ix>=0&&ix<bucketWidth&&iz>=0&&iz<bucketDepth)||!Number.isFinite(d[0])||!Number.isFinite(d[2])||!(far>=0))return false;
      const sx=d[0]>0?1:d[0]<0?-1:0,sz=d[2]>0?1:d[2]<0?-1:0;
      let tx=sx>0?((bucketX+ix+1)*bucketSize-o[0])/d[0]:sx<0?((bucketX+ix)*bucketSize-o[0])/d[0]:Infinity,tz=sz>0?((bucketZ+iz+1)*bucketSize-o[2])/d[2]:sz<0?((bucketZ+iz)*bucketSize-o[2])/d[2]:Infinity;
      const dx=sx?bucketSize/Math.abs(d[0]):Infinity,dz=sz?bucketSize/Math.abs(d[2]):Infinity;
      for(let guard=0;guard<4096;guard++){
        const bound=visit(iz*bucketWidth+ix),next=Math.min(tx,tz);
        if(!(next<=bound))return true;
        if(tx<tz){ix+=sx;tx+=dx;}else{iz+=sz;tz+=dz;}
        if(ix<0||ix>=bucketWidth||iz<0||iz>=bucketDepth)return true;
      }
      return false;
    }
    let rayBest=0,rayO=null,rayD=null;
    function rayVisit(cell){
      const a=mirrorBox,o=rayO,d=rayD,stamp=solidSerial;
      for(let m=mirrorStart[cell],end=mirrorStart[cell+1];m<end;m++){
        const n=mirrorIdx[m];if(solidStamp[n]===stamp)continue;solidStamp[n]=stamp;
        let lo=0,hi=rayBest;
        for(let k=0;k<3;k++){
          const min=a[m*6+k*2],max=a[m*6+k*2+1];
          if(Math.abs(d[k])<1e-7){if(o[k]<min||o[k]>max){hi=-1;break;}}
          else {let p=(min-o[k])/d[k],c=(max-o[k])/d[k];if(p>c){const t=p;p=c;c=t;}lo=Math.max(lo,p);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&lo>=0&&lo<rayBest)rayBest=lo;
      }
      return rayBest;
    }
    function ray(o,d,far=80){
      let best=far;
      ensureMirror();if(++solidSerial>=4294967295){solidStamp.fill(0);solidSerial=1;}
      rayBest=best;rayO=o;rayD=d;const walked=rayCells(o,d,far,rayVisit);rayO=rayD=null;
      if(walked)best=rayBest;
      for(const list of walked?[doorBoxes,trapBoxes]:[solids,doorBoxes,trapBoxes])for(const q of list){`]);
// mirror stores [minX,maxX,minY,maxY,minZ,maxZ]; axis k uses (2k,2k+1): k=0 X, k=1 Y, k=2 Z.
R.push([`    function castProjectile(o,d,far,r=.12){
      let distance=far,normal=[0,1,0];
      const lifts=s.lifts.map(l=>({minX:l.x-l.w/2,maxX:l.x+l.w/2,minY:l.y-.2,maxY:l.y,minZ:l.z-l.d/2,maxZ:l.z+l.d/2}));
      for(const list of [solids,doorBoxes,trapBoxes,lifts])for(const q of list){`,`    const castFound=[];
    function castVisit(cell){const stamp=solidSerial;for(let m=mirrorStart[cell],end=mirrorStart[cell+1];m<end;m++){const n=mirrorIdx[m];if(solidStamp[n]!==stamp){solidStamp[n]=stamp;castFound.push(n);}}return castBound;}
    let castBound=0;
    function castProjectile(o,d,far,r=.12){
      let distance=far,normal=[0,1,0];
      const lifts=s.lifts.map(l=>({minX:l.x-l.w/2,maxX:l.x+l.w/2,minY:l.y-.2,maxY:l.y,minZ:l.z-l.d/2,maxZ:l.z+l.d/2}));
      ensureMirror();if(++solidSerial>=4294967295){solidStamp.fill(0);solidSerial=1;}castFound.length=0;castBound=far;
      // r <= bucketRadius: every box that can be hit is listed in a crossed cell; keep the original order.
      const walked=r<=bucketRadius&&rayCells(o,d,far,castVisit);const local=walked?castFound.sort((x,y)=>x-y).map(n=>solids[n]):solids;
      for(const list of [local,doorBoxes,trapBoxes,lifts])for(const q of list){`]);
// unrolled floor slab loop (no [0,2] array per floor), same arithmetic
R.push([`        let enter=0,leave=best;
        for(const k of [0,2]){
          const center=k===0?f.x:f.z,extent=(k===0?f.w:f.d)/2;
          if(Math.abs(d[k])<1e-9){if(Math.abs(o[k]-center)>extent){leave=-1;break;}}
          else{let a=(center-extent-o[k])/d[k],c=(center+extent-o[k])/d[k];if(a>c)[a,c]=[c,a];enter=Math.max(enter,a);leave=Math.min(leave,c);}
        }`,`        let enter=0,leave=best;
        for(let k=0;k<=2;k+=2){
          const center=k===0?f.x:f.z,extent=(k===0?f.w:f.d)/2;
          if(Math.abs(d[k])<1e-9){if(Math.abs(o[k]-center)>extent){leave=-1;break;}}
          else{let a=(center-extent-o[k])/d[k],c=(center+extent-o[k])/d[k];if(a>c){const t=a;a=c;c=t;}enter=Math.max(enter,a);leave=Math.min(leave,c);}
        }`]);
R.push(["move,ray,sight,hurt","move,ray,sight,hurt,__castProjectile:castProjectile"]);
export const rayV2={simulation:R};
export const rayPatch=()=>({simulation:[mirrorPatch,...R]});
export const exposeCast={simulation:[["move,ray,sight,hurt","move,ray,sight,hurt,__castProjectile:castProjectile"]]};
