// Exact replacement of simulation.js ground() (commit 673d6b2): SoA typed arrays, a power-of-two
// sub-grid nested in the 8 m floorBuckets (candidate lists are subsets of the original bucket),
// a per-cell "dominant flat floor" constant, and a floor-trap prefilter. Same arithmetic, same order.
export const ORIGINAL_GROUND=`    function ground(x,z,activeTraps=trapStates){
      if(!floors.length)return 0;
      let y=-Infinity,flat=-Infinity,fallback=-Infinity;
      const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ,local=gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?floorBuckets[gz*floorGW+gx]:floors;
      for(const f of local)if(Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7){
        const h=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);
        if(f.substrate||f.fallback)fallback=Math.max(fallback,h);else if(!f.slopeX&&!f.slopeZ)flat=Math.max(flat,h);else y=Math.max(y,h);
      }
      let result=Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
      for(const t of activeTraps)if(t.kind==='floor'&&Math.abs(x-t.x)<t.w/2&&Math.abs(z-t.z)<t.d/2&&Math.abs(result-t.y)<.1)result=t.y-(t.travel||.85)*t.progress;
      return result;
    }`;
export function groundV2(GCS=2,{topCells=true}={}){
  if(![1,2,4,8].includes(GCS))throw new Error('GCS must divide 8 and be a power of two');
  return `    // ground v2: exact, see bench/sim/ground-v2.mjs
    const gN=floors.length,gFX=new Float64Array(gN),gFZ=new Float64Array(gN),gHW=new Float64Array(gN),gHD=new Float64Array(gN),gFY=new Float64Array(gN),gSX=new Float64Array(gN),gSZ=new Float64Array(gN),gFK=new Uint8Array(gN);
    for(let i=0;i<gN;i++){const f=floors[i];gFX[i]=f.x;gFZ[i]=f.z;gHW[i]=f.w/2+1e-7;gHD[i]=f.d/2+1e-7;gFY[i]=f.y||0;gSX[i]=f.slopeX||0;gSZ[i]=f.slopeZ||0;gFK[i]=f.substrate||f.fallback?2:!f.slopeX&&!f.slopeZ?0:1;}
    const gCS=${GCS},gRatio=8/gCS,gGW=floorGW*gRatio,gGD=floorGD*gRatio,gGX=floorGX*gRatio,gGZ=floorGZ*gRatio,gStart=new Int32Array(gGW*gGD+1),gTop=new Float64Array(gGW*gGD).fill(NaN),gIdx=new Map(floors.map((f,i)=>[f,i])),gList=[];
    for(let cz=0;cz<gGD;cz++)for(let cx=0;cx<gGW;cx++){
      const c=cz*gGW+cx,x0=(gGX+cx)*gCS,x1=x0+gCS,z0=(gGZ+cz)*gCS,z1=z0+gCS,m=1e-6;gStart[c]=gList.length;let top=-Infinity,cover=false;
      for(const f of floorBuckets[Math.floor(cz/gRatio)*floorGW+Math.floor(cx/gRatio)]){const i=gIdx.get(f);
        if(gFX[i]-gHW[i]-m>x1||gFX[i]+gHW[i]+m<x0||gFZ[i]-gHD[i]-m>z1||gFZ[i]+gHD[i]+m<z0)continue;gList.push(i);if(gFK[i]===0)top=Math.max(top,gFY[i]);}
      if(${topCells})for(let k=gStart[c];k<gList.length;k++){const i=gList[k];if(gFK[i]===0&&gFY[i]===top&&gFX[i]-gHW[i]+m<=x0&&x1<=gFX[i]+gHW[i]-m&&gFZ[i]-gHD[i]+m<=z0&&z1<=gFZ[i]+gHD[i]-m)cover=true;}
      if(cover)gTop[c]=top;
    }
    gStart[gGW*gGD]=gList.length;const gCells=Int32Array.from(gList),gAll=Int32Array.from(floors.map((f,i)=>i));
    let gTrapSource=null,gTrapLength=-1,gFloorTraps=[];
    function groundScan(x,z,list,from,to){
      let y=-Infinity,flat=-Infinity,fallback=-Infinity;
      for(let k=from;k<to;k++){const i=list[k],fx=gFX[i],fz=gFZ[i];if(Math.abs(x-fx)<=gHW[i]&&Math.abs(z-fz)<=gHD[i]){
        const h=gFY[i]+(x-fx)*gSX[i]+(z-fz)*gSZ[i],kind=gFK[i];
        if(kind===2)fallback=Math.max(fallback,h);else if(kind===0)flat=Math.max(flat,h);else y=Math.max(y,h);
      }}
      return Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
    }
    function ground(x,z,activeTraps=trapStates){
      if(!gN)return 0;
      const gx=Math.floor(x/gCS)-gGX,gz=Math.floor(z/gCS)-gGZ;let result;
      if(gx>=0&&gx<gGW&&gz>=0&&gz<gGD){const c=gz*gGW+gx,top=gTop[c];result=top===top?top:groundScan(x,z,gCells,gStart[c],gStart[c+1]);}
      else result=groundScan(x,z,gAll,0,gN);
      if(activeTraps!==gTrapSource||activeTraps.length!==gTrapLength){gTrapSource=activeTraps;gTrapLength=activeTraps.length;gFloorTraps=activeTraps.filter(t=>t.kind==='floor');}
      for(let k=0;k<gFloorTraps.length;k++){const t=gFloorTraps[k];if(Math.abs(x-t.x)<t.w/2&&Math.abs(z-t.z)<t.d/2&&Math.abs(result-t.y)<.1)result=t.y-(t.travel||.85)*t.progress;}
      return result;
    }`;
}
export const groundPatch=(GCS=2,o)=>({simulation:[[ORIGINAL_GROUND,groundV2(GCS,o)]]});
